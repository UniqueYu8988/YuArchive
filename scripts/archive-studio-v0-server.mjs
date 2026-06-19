import http from 'node:http';
import { pathToFileURL } from 'node:url';
import {
  assertPreviewSafe,
  buildMusicAlbumPreview,
} from './archive-studio-v0-music-preview-core.mjs';
import { evaluateGate } from './check-archive-studio-v0-real-write-gate.mjs';
import { buildDryRunManifest } from './dry-run-archive-studio-v0-real-write-manifest.mjs';
import { evaluateMusicV2Shape } from './check-archive-data-v2-music-shape.mjs';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4176;
const MAX_BODY_BYTES = 1024 * 1024;

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function sendError(response, statusCode, code, message) {
  sendJson(response, statusCode, {
    ok: false,
    error: { code, message },
  });
}

function isLocalHostHeader(hostHeader = '') {
  const host = hostHeader.toLowerCase().split(':')[0];
  return host === '127.0.0.1' || host === 'localhost';
}

async function readJsonBody(request) {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    const error = new Error('Content-Type must be application/json');
    error.statusCode = 415;
    error.code = 'unsupported_media_type';
    throw error;
  }

  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large');
      error.statusCode = 413;
      error.code = 'request_too_large';
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON');
    error.statusCode = 400;
    error.code = 'invalid_json';
    throw error;
  }
}

function buildProfilesResponse() {
  return {
    ok: true,
    localOnly: true,
    writeEnabled: false,
    profiles: [
      {
        board: 'music',
        kind: 'album',
        modes: ['create'],
        capabilities: {
          preview: true,
          preflight: true,
          check: true,
          create: false,
          update: false,
          publish: false,
        },
      },
    ],
  };
}

function buildPreflightResponse(gate) {
  const manifest = buildDryRunManifest(gate);
  return {
    ok: gate.allowedToRequestWrite,
    entryId: gate.targetEntryId,
    targetEntryExists: gate.targetEntryExists,
    targetFilesExisting: gate.targetFilesExisting,
    blockedReasons: gate.blockedReasons,
    scope: gate.target.entryRelativeDir,
    operations: gate.operations,
    diff: gate.diff,
    dryRun: {
      status: manifest.status,
      writeItems: manifest.writeManifestDraft.items.length,
      backupItems: manifest.backupManifestDraft.items.length,
      rollbackDeletes: manifest.rollbackDraft.deletesCreatedFiles,
      rollbackRestores: manifest.rollbackDraft.restoresBackups,
    },
    writeEnabled: false,
    writeScope: 'none',
  };
}

async function routeRequest(request, response) {
  if (!isLocalHostHeader(request.headers.host)) {
    sendError(response, 403, 'local_host_required', 'Archive Studio API only accepts local requests');
    return;
  }

  const url = new URL(request.url || '/', `http://${HOST}`);

  if (request.method === 'GET' && url.pathname === '/api/studio/profiles') {
    sendJson(response, 200, buildProfilesResponse());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/music/album/preview') {
    const payload = await readJsonBody(request);
    const preview = buildMusicAlbumPreview(payload);
    assertPreviewSafe(preview);
    sendJson(response, preview.ok ? 200 : 422, {
      ...preview,
      writeEnabled: false,
      writeScope: 'none',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/music/album/preflight') {
    const payload = await readJsonBody(request);
    const gate = await evaluateGate(payload, 'studio-ui');
    sendJson(response, gate.allowedToRequestWrite ? 200 : 409, buildPreflightResponse(gate));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/checks/music-v2') {
    await readJsonBody(request);
    const result = evaluateMusicV2Shape();
    sendJson(response, result.ok ? 200 : 422, {
      ...result,
      writeEnabled: false,
      writeScope: 'none',
    });
    return;
  }

  sendError(response, 404, 'not_found', 'Archive Studio API route not found');
}

export function createArchiveStudioServer() {
  return http.createServer((request, response) => {
    routeRequest(request, response).catch((error) => {
      sendError(
        response,
        error.statusCode || 500,
        error.code || 'internal_error',
        error.statusCode ? error.message : 'Archive Studio API request failed',
      );
    });
  });
}

export function startArchiveStudioServer({ port = DEFAULT_PORT } = {}) {
  const server = createArchiveStudioServer();
  server.listen(port, HOST, () => {
    console.log(`[PASS] Archive Studio v0 read-only API`);
    console.log(`  host: ${HOST}`);
    console.log(`  port: ${port}`);
    console.log('  writeEnabled: false');
    console.log('  writeScope: none');
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const requestedPort = Number.parseInt(process.env.ARCHIVE_STUDIO_PORT || '', 10);
  startArchiveStudioServer({
    port: Number.isInteger(requestedPort) ? requestedPort : DEFAULT_PORT,
  });
}
