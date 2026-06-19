import crypto from 'node:crypto';
import http from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import {
  assertPreviewSafe,
  buildMusicAlbumPreview,
} from './archive-studio-v0-music-preview-core.mjs';
import { evaluateGate } from './check-archive-studio-v0-real-write-gate.mjs';
import { buildDryRunManifest } from './dry-run-archive-studio-v0-real-write-manifest.mjs';
import { evaluateMusicV2Shape } from './check-archive-data-v2-music-shape.mjs';
import {
  ARCHIVE_DATA_V2_ROOT,
  ARCHIVE_SOURCE_ROOT,
  createMusicAlbumEntry,
} from './archive-studio-v0-music-create-core.mjs';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4176;
const MAX_JSON_BODY_BYTES = 1024 * 1024;
const MAX_UPLOAD_BODY_BYTES = 300 * 1024 * 1024;
const PREFLIGHT_TOKEN_TTL_MS = 5 * 60 * 1000;

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
    if (bytes > MAX_JSON_BODY_BYTES) {
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

async function readMultipartForm(request) {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    const error = new Error('Content-Type must be multipart/form-data');
    error.statusCode = 415;
    error.code = 'unsupported_media_type';
    throw error;
  }
  const contentLength = Number.parseInt(request.headers['content-length'] || '', 10);
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_UPLOAD_BODY_BYTES) {
    const error = new Error('Upload size is missing or exceeds the local limit');
    error.statusCode = 413;
    error.code = 'upload_size_invalid';
    throw error;
  }
  const webRequest = new Request(`http://${HOST}${request.url || '/'}`, {
    method: 'POST',
    headers: request.headers,
    body: Readable.toWeb(request),
    duplex: 'half',
  });
  return webRequest.formData();
}

function payloadFingerprint(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function buildProfilesResponse(writeEnabled) {
  return {
    ok: true,
    localOnly: true,
    writeEnabled,
    profiles: [
      {
        board: 'music',
        kind: 'album',
        modes: ['create'],
        capabilities: {
          preview: true,
          preflight: true,
          check: true,
          create: writeEnabled,
          update: false,
          publish: false,
        },
      },
    ],
  };
}

function buildPreflightResponse(gate, tokenRecord = null) {
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
    writeEnabled: Boolean(tokenRecord),
    writeScope: tokenRecord ? gate.target.entryRelativeDir : 'none',
    preflightToken: tokenRecord?.token || null,
    preflightExpiresAt: tokenRecord?.expiresAt || null,
  };
}

function requireFormText(form, name) {
  const value = form.get(name);
  if (typeof value !== 'string' || !value) {
    const error = new Error(`${name} is required`);
    error.statusCode = 400;
    error.code = 'multipart_field_missing';
    throw error;
  }
  return value;
}

function requireFormFile(form, name) {
  const value = form.get(name);
  if (!value || typeof value === 'string' || typeof value.arrayBuffer !== 'function') {
    const error = new Error(`${name} file is required`);
    error.statusCode = 400;
    error.code = 'multipart_file_missing';
    throw error;
  }
  return value;
}

async function routeRequest(request, response, context) {
  if (!isLocalHostHeader(request.headers.host)) {
    sendError(response, 403, 'local_host_required', 'Archive Studio API only accepts local requests');
    return;
  }

  const url = new URL(request.url || '/', `http://${HOST}`);

  if (request.method === 'GET' && url.pathname === '/api/studio/profiles') {
    sendJson(response, 200, buildProfilesResponse(context.writeEnabled));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/music/album/preview') {
    const payload = await readJsonBody(request);
    const preview = buildMusicAlbumPreview(payload);
    assertPreviewSafe(preview);
    sendJson(response, preview.ok ? 200 : 422, {
      ...preview,
      writeEnabled: context.writeEnabled,
      writeScope: 'none',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/music/album/preflight') {
    const payload = await readJsonBody(request);
    const gate = await evaluateGate(payload, 'studio-ui', {
      v2Root: context.v2Root,
      requireMigrationRoot: context.requireMigrationBaseline,
    });
    let tokenRecord = null;
    if (gate.allowedToRequestWrite && context.writeEnabled) {
      const token = crypto.randomUUID();
      tokenRecord = {
        token,
        fingerprint: payloadFingerprint(payload),
        entryId: payload.id,
        expiresAt: Date.now() + PREFLIGHT_TOKEN_TTL_MS,
      };
      context.preflightTokens.set(token, tokenRecord);
    }
    sendJson(response, gate.allowedToRequestWrite ? 200 : 409, buildPreflightResponse(gate, tokenRecord));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/music/album/create') {
    if (!context.writeEnabled) {
      sendError(response, 403, 'create_disabled', 'Archive Studio create is disabled');
      return;
    }
    const form = await readMultipartForm(request);
    const payloadText = requireFormText(form, 'payload');
    const token = requireFormText(form, 'preflightToken');
    const coverFile = requireFormFile(form, 'cover');
    const audioFile = requireFormFile(form, 'audio');
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      const error = new Error('payload must be valid JSON');
      error.statusCode = 400;
      error.code = 'invalid_payload_json';
      throw error;
    }

    const tokenRecord = context.preflightTokens.get(token);
    context.preflightTokens.delete(token);
    if (
      !tokenRecord
      || tokenRecord.expiresAt < Date.now()
      || tokenRecord.entryId !== payload.id
      || tokenRecord.fingerprint !== payloadFingerprint(payload)
    ) {
      sendError(response, 403, 'preflight_token_invalid', 'Preflight token is invalid or expired');
      return;
    }

    const gate = await evaluateGate(payload, 'studio-create', {
      v2Root: context.v2Root,
      requireMigrationRoot: context.requireMigrationBaseline,
    });
    if (!gate.allowedToRequestWrite) {
      sendJson(response, 409, buildPreflightResponse(gate));
      return;
    }
    if (
      coverFile.name !== payload.assets?.cover?.originalName
      || audioFile.name !== payload.assets?.audio?.originalName
    ) {
      sendError(response, 422, 'asset_name_mismatch', 'Selected asset names no longer match preview');
      return;
    }

    const result = await createMusicAlbumEntry({
      payload,
      coverBuffer: Buffer.from(await coverFile.arrayBuffer()),
      audioBuffer: Buffer.from(await audioFile.arrayBuffer()),
      v2Root: context.v2Root,
      sourceRoot: context.sourceRoot,
      expectedMinimumEntries: context.expectedMinimumEntries,
      requireMigrationBaseline: context.requireMigrationBaseline,
    });
    sendJson(response, 201, {
      ...result,
      check: evaluateMusicV2Shape({
        v2Root: context.v2Root,
        expectedMinimumEntries: result.musicEntries,
        requireMigrationBaseline: context.requireMigrationBaseline,
      }),
      publishTriggered: false,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/checks/music-v2') {
    await readJsonBody(request);
    const result = evaluateMusicV2Shape({
      v2Root: context.v2Root,
      expectedMinimumEntries: context.expectedMinimumEntries,
      requireMigrationBaseline: context.requireMigrationBaseline,
    });
    sendJson(response, result.ok ? 200 : 422, {
      ...result,
      writeEnabled: false,
      writeScope: 'none',
    });
    return;
  }

  sendError(response, 404, 'not_found', 'Archive Studio API route not found');
}

export function createArchiveStudioServer({
  v2Root = ARCHIVE_DATA_V2_ROOT,
  sourceRoot = ARCHIVE_SOURCE_ROOT,
  writeEnabled = true,
  expectedMinimumEntries = 33,
  requireMigrationBaseline = true,
} = {}) {
  const context = {
    v2Root,
    sourceRoot,
    writeEnabled,
    expectedMinimumEntries,
    requireMigrationBaseline,
    preflightTokens: new Map(),
  };
  return http.createServer((request, response) => {
    routeRequest(request, response, context).catch((error) => {
      if (error.code === 'create_transaction_failed') {
        sendJson(response, 500, {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            stage: error.stage,
            rollback: error.rollback,
          },
        });
        return;
      }
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
    console.log(`[PASS] Archive Studio v0 local API`);
    console.log(`  host: ${HOST}`);
    console.log(`  port: ${port}`);
    console.log('  writeEnabled: true');
    console.log('  writeScope: music/album/create');
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const requestedPort = Number.parseInt(process.env.ARCHIVE_STUDIO_PORT || '', 10);
  startArchiveStudioServer({
    port: Number.isInteger(requestedPort) ? requestedPort : DEFAULT_PORT,
  });
}
