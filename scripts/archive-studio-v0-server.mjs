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
import {
  assertTextsPreviewSafe,
  buildTextsPreview,
} from './archive-studio-v0-texts-preview-core.mjs';
import { evaluateTextsWriteGate } from './check-archive-studio-v0-texts-write-gate.mjs';
import { createTextEntry } from './archive-studio-v0-texts-create-core.mjs';
import { evaluateTextsV2Shape } from './check-archive-data-v2-texts-shape.mjs';
import {
  assertVisionsPreviewSafe,
  buildVisionsPreview,
} from './archive-studio-v0-visions-preview-core.mjs';
import { evaluateVisionsWriteGate } from './check-archive-studio-v0-visions-write-gate.mjs';
import { createVisionEntry } from './archive-studio-v0-visions-create-core.mjs';
import { evaluateVisionsV2Shape } from './check-archive-data-v2-visions-shape.mjs';
import {
  assertGamesPreviewSafe,
  buildGamesPreview,
} from './archive-studio-v0-games-preview-core.mjs';
import { evaluateGamesWriteGate } from './check-archive-studio-v0-games-write-gate.mjs';
import { createGameEntry } from './archive-studio-v0-games-create-core.mjs';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';
import {
  applyPublicSync,
  buildPublicSyncPreview,
} from './archive-studio-public-sync-core.mjs';
import {
  applyHomepagePublicSync,
  buildHomepageConfigPreview,
  buildHomepagePublicPreview,
  loadHomepageState,
  saveHomepageConfig,
} from './archive-studio-homepage-core.mjs';
import {
  applyEntryUpdate,
  buildUpdatePreview,
  listEditableEntries,
  loadEditableEntry,
} from './archive-studio-update-core.mjs';

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
          sync: writeEnabled,
          update: writeEnabled,
          publish: false,
        },
      },
      ...['article', 'book_note', 'series_note'].map(kind => ({
        board: 'texts',
        kind,
        modes: ['create'],
        capabilities: {
          preview: true,
          preflight: true,
          check: true,
          create: writeEnabled,
          sync: writeEnabled,
          update: writeEnabled,
          publish: false,
        },
      })),
      ...['movie', 'series'].map(kind => ({
        board: 'visions',
        kind,
        modes: ['create'],
        capabilities: {
          preview: true,
          preflight: true,
          check: true,
          create: writeEnabled,
          sync: writeEnabled,
          update: writeEnabled,
          publish: false,
        },
      })),
      {
        board: 'games',
        kind: 'normal_game',
        modes: ['create'],
        capabilities: {
          preview: true,
          preflight: true,
          check: true,
          create: writeEnabled,
          sync: writeEnabled,
          update: writeEnabled,
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

function optionalFormFile(form, name) {
  const value = form.get(name);
  if (!value) return null;
  if (typeof value === 'string' || typeof value.arrayBuffer !== 'function') {
    const error = new Error(`${name} must be a file`);
    error.statusCode = 400;
    error.code = 'multipart_file_invalid';
    throw error;
  }
  return value;
}

function issuePreflightToken(context, payload) {
  const token = crypto.randomUUID();
  const tokenRecord = {
    token,
    fingerprint: payloadFingerprint(payload),
    entryId: payload.id,
    board: payload.board,
    expiresAt: Date.now() + PREFLIGHT_TOKEN_TTL_MS,
  };
  context.preflightTokens.set(token, tokenRecord);
  return tokenRecord;
}

function consumePreflightToken(context, token, payload) {
  const tokenRecord = context.preflightTokens.get(token);
  context.preflightTokens.delete(token);
  return Boolean(
    tokenRecord
    && tokenRecord.expiresAt >= Date.now()
    && tokenRecord.entryId === payload.id
    && tokenRecord.board === payload.board
    && tokenRecord.fingerprint === payloadFingerprint(payload)
  );
}

function buildTextsPreflightResponse(gate, tokenRecord = null) {
  return {
    ok: gate.allowedToRequestWrite,
    entryId: gate.target.entryId,
    targetEntryExists: gate.targetEntryExists,
    targetFilesExisting: gate.targetFilesExisting,
    blockedReasons: gate.blockedReasons,
    scope: gate.target.entryRelativeDir,
    operations: gate.operations,
    dryRun: {
      status: gate.allowedToRequestWrite ? 'ready' : 'blocked',
      writeItems: gate.operations.length,
      backupItems: 0,
      rollbackDeletes: gate.operations.length,
      rollbackRestores: 0,
    },
    baseline: gate.baseline,
    writeEnabled: Boolean(tokenRecord),
    writeScope: tokenRecord ? gate.target.entryRelativeDir : 'none',
    preflightToken: tokenRecord?.token || null,
    preflightExpiresAt: tokenRecord?.expiresAt || null,
  };
}

function buildVisionsPreflightResponse(gate, tokenRecord = null) {
  return {
    ok: gate.allowedToRequestWrite,
    entryId: gate.target.entryId,
    targetEntryExists: gate.targetEntryExists,
    targetFilesExisting: gate.targetFilesExisting,
    blockedReasons: gate.blockedReasons,
    scope: gate.target.entryRelativeDir,
    operations: gate.operations,
    dryRun: {
      status: gate.allowedToRequestWrite ? 'ready' : 'blocked',
      writeItems: gate.operations.length,
      backupItems: 0,
      rollbackDeletes: gate.operations.length,
      rollbackRestores: 0,
    },
    baseline: gate.baseline,
    writeEnabled: Boolean(tokenRecord),
    writeScope: tokenRecord ? gate.target.entryRelativeDir : 'none',
    preflightToken: tokenRecord?.token || null,
    preflightExpiresAt: tokenRecord?.expiresAt || null,
  };
}

function buildGamesPreflightResponse(gate, tokenRecord = null) {
  return {
    ok: gate.allowedToRequestWrite,
    entryId: gate.target.entryId,
    targetEntryExists: gate.targetEntryExists,
    targetFilesExisting: gate.targetFilesExisting,
    blockedReasons: gate.blockedReasons,
    scope: gate.target.entryRelativeDir,
    operations: gate.operations,
    dryRun: {
      status: gate.allowedToRequestWrite ? 'ready' : 'blocked',
      writeItems: gate.operations.length,
      backupItems: 0,
      rollbackDeletes: gate.operations.length,
      rollbackRestores: 0,
    },
    baseline: gate.baseline,
    writeEnabled: Boolean(tokenRecord),
    writeScope: tokenRecord ? gate.target.entryRelativeDir : 'none',
    preflightToken: tokenRecord?.token || null,
    preflightExpiresAt: tokenRecord?.expiresAt || null,
  };
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

  const updateListMatch = url.pathname.match(/^\/api\/studio\/(music|texts|visions|games)\/entries$/);
  if (request.method === 'GET' && updateListMatch) {
    const board = updateListMatch[1];
    sendJson(response, 200, {
      ok: true,
      board,
      entries: listEditableEntries({ board, v2Root: context.v2Root, projectRoot: context.projectRoot }),
    });
    return;
  }

  const updateDetailMatch = url.pathname.match(/^\/api\/studio\/(music|texts|visions|games)\/entries\/([a-z0-9-]+)$/);
  if (request.method === 'GET' && updateDetailMatch) {
    const [, board, id] = updateDetailMatch;
    sendJson(response, 200, loadEditableEntry({
      board, id, v2Root: context.v2Root, projectRoot: context.projectRoot,
    }));
    return;
  }

  const updateActionMatch = url.pathname.match(/^\/api\/studio\/(music|texts|visions|games)\/update-(preview|preflight|apply)$/);
  if (request.method === 'POST' && updateActionMatch) {
    const [, board, action] = updateActionMatch;
    if (action === 'apply') {
      if (!context.writeEnabled) {
        sendError(response, 403, 'update_disabled', 'Archive Studio update is disabled');
        return;
      }
      const form = await readMultipartForm(request);
      const payload = JSON.parse(requireFormText(form, 'payload'));
      const token = requireFormText(form, 'updateToken');
      const record = context.updateTokens.get(token);
      context.updateTokens.delete(token);
      if (
        !record || record.board !== board || record.expiresAt < Date.now()
        || record.fingerprint !== payloadFingerprint(payload)
      ) {
        sendError(response, 403, 'update_token_invalid', 'Update token is invalid or expired');
        return;
      }
      const assetBuffers = {};
      for (const role of ['cover', 'audio', 'poster']) {
        const file = form.get(role);
        if (file instanceof File && file.size > 0) assetBuffers[role] = Buffer.from(await file.arrayBuffer());
      }
      const result = await applyEntryUpdate({
        payload,
        expectedDigest: record.digest,
        assetBuffers,
        v2Root: context.v2Root,
        sourceRoot: context.sourceRoot,
        projectRoot: context.projectRoot,
      });
      sendJson(response, 200, {
        ...result,
        entryRelativeDir: `entries/${result.board}/${result.kind}/${result.entryId}`,
        createdEntryFiles: result.changedFields.length + (result.contentChanged ? 1 : 0) + result.replacedAssets.length,
        createdTransactionFiles: 3,
        musicEntries: result.check.albumEntryDirs,
        textsEntries: result.check.totalEntries,
        visionsEntries: result.check.totalEntries,
        gamesEntries: result.check.totalEntries,
        publishTriggered: false,
      });
      return;
    }
    const payload = await readJsonBody(request);
    if (payload.board !== board) {
      sendError(response, 422, 'update_board_mismatch', 'Update board does not match route');
      return;
    }
    const preview = buildUpdatePreview({
      payload, v2Root: context.v2Root, projectRoot: context.projectRoot,
    });
    let token = null;
    let expiresAt = null;
    if (action === 'preflight' && preview.ok && context.writeEnabled) {
      token = crypto.randomUUID();
      expiresAt = Date.now() + PREFLIGHT_TOKEN_TTL_MS;
      context.updateTokens.set(token, {
        board, digest: preview.digest, fingerprint: payloadFingerprint(payload), expiresAt,
      });
    }
    const { internal, digest, normalized, publicId, ...safePreview } = preview;
    sendJson(response, preview.ok ? 200 : 422, {
      ...safePreview,
      warnings: safePreview.warnings ?? [],
      updateToken: token,
      updateExpiresAt: expiresAt,
      writeEnabled: Boolean(token),
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/studio/homepage') {
    const state = loadHomepageState({ v2Root: context.v2Root, projectRoot: context.projectRoot });
    const { internal, ...safeState } = state;
    sendJson(response, state.ok ? 200 : 422, safeState);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/homepage/config-preview') {
    const body = await readJsonBody(request);
    const preview = buildHomepageConfigPreview({
      selection: body.selection,
      v2Root: context.v2Root,
      projectRoot: context.projectRoot,
    });
    const token = preview.ok && context.writeEnabled ? crypto.randomUUID() : null;
    const expiresAt = token ? Date.now() + PREFLIGHT_TOKEN_TTL_MS : null;
    if (token) context.homepageTokens.set(token, {
      action: 'config-save', digest: preview.digest, selection: preview.selection, expiresAt,
    });
    const { internal, digest, ...safePreview } = preview;
    sendJson(response, preview.ok ? 200 : 422, { ...safePreview, token, expiresAt });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/homepage/config-save') {
    const body = await readJsonBody(request);
    const token = String(body.token ?? '');
    const record = context.homepageTokens.get(token);
    context.homepageTokens.delete(token);
    if (!record || record.action !== 'config-save' || record.expiresAt < Date.now()) {
      sendError(response, 403, 'homepage_token_invalid', 'Homepage configuration token is invalid or expired');
      return;
    }
    const result = saveHomepageConfig({
      selection: record.selection,
      expectedDigest: record.digest,
      v2Root: context.v2Root,
      projectRoot: context.projectRoot,
    });
    sendJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/homepage/sync-preview') {
    await readJsonBody(request);
    const preview = buildHomepagePublicPreview({ v2Root: context.v2Root, projectRoot: context.projectRoot });
    const token = preview.ok && preview.homeChanged && context.writeEnabled ? crypto.randomUUID() : null;
    const expiresAt = token ? Date.now() + PREFLIGHT_TOKEN_TTL_MS : null;
    if (token) context.homepageTokens.set(token, {
      action: 'public-sync', digest: preview.digest, expiresAt,
    });
    const { internal, digest, ...safePreview } = preview;
    sendJson(response, preview.ok ? 200 : 422, { ...safePreview, token, expiresAt });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/homepage/sync-apply') {
    const body = await readJsonBody(request);
    const token = String(body.token ?? '');
    const record = context.homepageTokens.get(token);
    context.homepageTokens.delete(token);
    if (!record || record.action !== 'public-sync' || record.expiresAt < Date.now()) {
      sendError(response, 403, 'homepage_token_invalid', 'Homepage sync token is invalid or expired');
      return;
    }
    const result = applyHomepagePublicSync({
      expectedDigest: record.digest,
      v2Root: context.v2Root,
      projectRoot: context.projectRoot,
    });
    sendJson(response, 200, result);
    return;
  }

  const syncMatch = url.pathname.match(/^\/api\/studio\/(music|texts|visions|games)\/sync-(preview|apply)$/);
  if (request.method === 'POST' && syncMatch) {
    const [, board, action] = syncMatch;
    const body = await readJsonBody(request);
    if (action === 'preview') {
      const preview = buildPublicSyncPreview({
        board,
        v2Root: context.v2Root,
        projectRoot: context.projectRoot,
      });
      const token = preview.pendingEntries && context.writeEnabled ? crypto.randomUUID() : null;
      const expiresAt = token ? Date.now() + PREFLIGHT_TOKEN_TTL_MS : null;
      if (token) context.syncTokens.set(token, { board, digest: preview.digest, expiresAt });
      const { internal, digest, ...safePreview } = preview;
      sendJson(response, 200, {
        ...safePreview,
        syncEnabled: context.writeEnabled,
        syncToken: token,
        syncExpiresAt: expiresAt,
      });
      return;
    }
    if (!context.writeEnabled) {
      sendError(response, 403, 'sync_disabled', 'Archive Studio public sync is disabled');
      return;
    }
    const token = String(body.syncToken ?? '');
    const record = context.syncTokens.get(token);
    context.syncTokens.delete(token);
    if (!record || record.board !== board || record.expiresAt < Date.now()) {
      sendError(response, 403, 'sync_token_invalid', 'Public sync token is invalid or expired');
      return;
    }
    const result = applyPublicSync({
      board,
      v2Root: context.v2Root,
      projectRoot: context.projectRoot,
      expectedDigest: record.digest,
    });
    sendJson(response, 200, result);
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
      tokenRecord = issuePreflightToken(context, payload);
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

    if (!consumePreflightToken(context, token, payload)) {
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

  if (request.method === 'POST' && url.pathname === '/api/studio/texts/preview') {
    const payload = await readJsonBody(request);
    const preview = buildTextsPreview(payload);
    assertTextsPreviewSafe(preview);
    sendJson(response, preview.ok ? 200 : 422, {
      ...preview,
      writeEnabled: context.writeEnabled,
      writeScope: 'none',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/texts/preflight') {
    const payload = await readJsonBody(request);
    const gate = evaluateTextsWriteGate(payload, {
      v2Root: context.v2Root,
      expectedMinimumEntries: context.expectedMinimumTextsEntries,
      expectedMinimumKinds: context.expectedMinimumTextsKinds,
      requireMigrationBaseline: context.requireTextsMigrationBaseline,
    });
    const tokenRecord = gate.allowedToRequestWrite && context.writeEnabled
      ? issuePreflightToken(context, payload)
      : null;
    sendJson(response, gate.allowedToRequestWrite ? 200 : 409, buildTextsPreflightResponse(gate, tokenRecord));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/texts/create') {
    if (!context.writeEnabled) {
      sendError(response, 403, 'create_disabled', 'Archive Studio create is disabled');
      return;
    }
    const form = await readMultipartForm(request);
    const payloadText = requireFormText(form, 'payload');
    const token = requireFormText(form, 'preflightToken');
    const coverFile = optionalFormFile(form, 'cover');
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      const error = new Error('payload must be valid JSON');
      error.statusCode = 400;
      error.code = 'invalid_payload_json';
      throw error;
    }
    if (!consumePreflightToken(context, token, payload)) {
      sendError(response, 403, 'preflight_token_invalid', 'Preflight token is invalid or expired');
      return;
    }
    const gate = evaluateTextsWriteGate(payload, {
      v2Root: context.v2Root,
      expectedMinimumEntries: context.expectedMinimumTextsEntries,
      expectedMinimumKinds: context.expectedMinimumTextsKinds,
      requireMigrationBaseline: context.requireTextsMigrationBaseline,
    });
    if (!gate.allowedToRequestWrite) {
      sendJson(response, 409, buildTextsPreflightResponse(gate));
      return;
    }
    if (payload.kind === 'book_note') {
      if (!coverFile) {
        sendError(response, 422, 'cover_file_missing', 'Book note cover file is required');
        return;
      }
      if (coverFile.name !== payload.assets?.cover?.originalName) {
        sendError(response, 422, 'asset_name_mismatch', 'Selected cover no longer matches preview');
        return;
      }
    } else if (coverFile) {
      sendError(response, 422, 'unexpected_cover_file', 'Cover is not supported for this text kind');
      return;
    }
    const result = await createTextEntry({
      payload,
      coverBuffer: coverFile ? Buffer.from(await coverFile.arrayBuffer()) : null,
      v2Root: context.v2Root,
      sourceRoot: context.sourceRoot,
      expectedMinimumEntries: context.expectedMinimumTextsEntries,
      expectedMinimumKinds: context.expectedMinimumTextsKinds,
      requireMigrationBaseline: context.requireTextsMigrationBaseline,
    });
    sendJson(response, 201, {
      ...result,
      check: evaluateTextsV2Shape({
        v2Root: context.v2Root,
        expectedMinimumEntries: result.textsEntries,
        expectedMinimumKinds: context.expectedMinimumTextsKinds,
        requireMigrationBaseline: context.requireTextsMigrationBaseline,
      }),
      publishTriggered: false,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/checks/texts-v2') {
    await readJsonBody(request);
    const result = evaluateTextsV2Shape({
      v2Root: context.v2Root,
      expectedMinimumEntries: context.expectedMinimumTextsEntries,
      expectedMinimumKinds: context.expectedMinimumTextsKinds,
      requireMigrationBaseline: context.requireTextsMigrationBaseline,
    });
    sendJson(response, result.ok ? 200 : 422, {
      ...result,
      writeEnabled: false,
      writeScope: 'none',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/visions/preview') {
    const payload = await readJsonBody(request);
    const preview = buildVisionsPreview(payload);
    assertVisionsPreviewSafe(preview);
    sendJson(response, preview.ok ? 200 : 422, {
      ...preview,
      writeEnabled: context.writeEnabled,
      writeScope: 'none',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/visions/preflight') {
    const payload = await readJsonBody(request);
    const gate = evaluateVisionsWriteGate(payload, {
      v2Root: context.v2Root,
      expectedMinimumEntries: context.expectedMinimumVisionsEntries,
      expectedMinimumKinds: context.expectedMinimumVisionsKinds,
      expectedCharacters: context.expectedVisionsCharacters,
      requireMigrationBaseline: context.requireVisionsMigrationBaseline,
    });
    const tokenRecord = gate.allowedToRequestWrite && context.writeEnabled
      ? issuePreflightToken(context, payload)
      : null;
    sendJson(response, gate.allowedToRequestWrite ? 200 : 409, buildVisionsPreflightResponse(gate, tokenRecord));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/visions/create') {
    if (!context.writeEnabled) {
      sendError(response, 403, 'create_disabled', 'Archive Studio create is disabled');
      return;
    }
    const form = await readMultipartForm(request);
    const payloadText = requireFormText(form, 'payload');
    const token = requireFormText(form, 'preflightToken');
    const posterFile = requireFormFile(form, 'poster');
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      const error = new Error('payload must be valid JSON');
      error.statusCode = 400;
      error.code = 'invalid_payload_json';
      throw error;
    }
    if (!consumePreflightToken(context, token, payload)) {
      sendError(response, 403, 'preflight_token_invalid', 'Preflight token is invalid or expired');
      return;
    }
    const gate = evaluateVisionsWriteGate(payload, {
      v2Root: context.v2Root,
      expectedMinimumEntries: context.expectedMinimumVisionsEntries,
      expectedMinimumKinds: context.expectedMinimumVisionsKinds,
      expectedCharacters: context.expectedVisionsCharacters,
      requireMigrationBaseline: context.requireVisionsMigrationBaseline,
    });
    if (!gate.allowedToRequestWrite) {
      sendJson(response, 409, buildVisionsPreflightResponse(gate));
      return;
    }
    if (posterFile.name !== payload.assets?.poster?.originalName) {
      sendError(response, 422, 'asset_name_mismatch', 'Selected poster no longer matches preview');
      return;
    }
    const result = await createVisionEntry({
      payload,
      posterBuffer: Buffer.from(await posterFile.arrayBuffer()),
      v2Root: context.v2Root,
      sourceRoot: context.sourceRoot,
      expectedMinimumEntries: context.expectedMinimumVisionsEntries,
      expectedMinimumKinds: context.expectedMinimumVisionsKinds,
      expectedCharacters: context.expectedVisionsCharacters,
      requireMigrationBaseline: context.requireVisionsMigrationBaseline,
    });
    sendJson(response, 201, {
      ...result,
      check: evaluateVisionsV2Shape({
        v2Root: context.v2Root,
        expectedMinimumEntries: result.visionsEntries,
        expectedMinimumKinds: context.expectedMinimumVisionsKinds,
        expectedCharacters: context.expectedVisionsCharacters,
        requireMigrationBaseline: context.requireVisionsMigrationBaseline,
      }),
      publishTriggered: false,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/checks/visions-v2') {
    await readJsonBody(request);
    const result = evaluateVisionsV2Shape({
      v2Root: context.v2Root,
      expectedMinimumEntries: context.expectedMinimumVisionsEntries,
      expectedMinimumKinds: context.expectedMinimumVisionsKinds,
      expectedCharacters: context.expectedVisionsCharacters,
      requireMigrationBaseline: context.requireVisionsMigrationBaseline,
    });
    sendJson(response, result.ok ? 200 : 422, {
      ...result,
      writeEnabled: false,
      writeScope: 'none',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/games/preview') {
    const payload = await readJsonBody(request);
    const preview = buildGamesPreview(payload);
    assertGamesPreviewSafe(preview);
    sendJson(response, preview.ok ? 200 : 422, {
      ...preview,
      writeEnabled: context.writeEnabled,
      writeScope: 'none',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/games/preflight') {
    const payload = await readJsonBody(request);
    const gate = evaluateGamesWriteGate(payload, {
      v2Root: context.v2Root,
      expectedMinimumEntries: context.expectedMinimumGamesEntries,
      expectedMinimumKinds: context.expectedMinimumGamesKinds,
      expectedSeasons: context.expectedGamesSeasons,
      expectedMinimumMetadataDisabled: context.expectedMinimumGamesMetadataDisabled,
      expectedLiveParentCovers: context.expectedGamesLiveParentCovers,
      requireMigrationBaseline: context.requireGamesMigrationBaseline,
    });
    const tokenRecord = gate.allowedToRequestWrite && context.writeEnabled
      ? issuePreflightToken(context, payload)
      : null;
    sendJson(response, gate.allowedToRequestWrite ? 200 : 409, buildGamesPreflightResponse(gate, tokenRecord));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/games/create') {
    if (!context.writeEnabled) {
      sendError(response, 403, 'create_disabled', 'Archive Studio create is disabled');
      return;
    }
    const form = await readMultipartForm(request);
    const payloadText = requireFormText(form, 'payload');
    const token = requireFormText(form, 'preflightToken');
    const coverFile = requireFormFile(form, 'cover');
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      const error = new Error('payload must be valid JSON');
      error.statusCode = 400;
      error.code = 'invalid_payload_json';
      throw error;
    }
    if (!consumePreflightToken(context, token, payload)) {
      sendError(response, 403, 'preflight_token_invalid', 'Preflight token is invalid or expired');
      return;
    }
    const gate = evaluateGamesWriteGate(payload, {
      v2Root: context.v2Root,
      expectedMinimumEntries: context.expectedMinimumGamesEntries,
      expectedMinimumKinds: context.expectedMinimumGamesKinds,
      expectedSeasons: context.expectedGamesSeasons,
      expectedMinimumMetadataDisabled: context.expectedMinimumGamesMetadataDisabled,
      expectedLiveParentCovers: context.expectedGamesLiveParentCovers,
      requireMigrationBaseline: context.requireGamesMigrationBaseline,
    });
    if (!gate.allowedToRequestWrite) {
      sendJson(response, 409, buildGamesPreflightResponse(gate));
      return;
    }
    if (coverFile.name !== payload.assets?.cover?.originalName) {
      sendError(response, 422, 'asset_name_mismatch', 'Selected cover no longer matches preview');
      return;
    }
    const result = await createGameEntry({
      payload,
      coverBuffer: Buffer.from(await coverFile.arrayBuffer()),
      v2Root: context.v2Root,
      sourceRoot: context.sourceRoot,
      expectedMinimumEntries: context.expectedMinimumGamesEntries,
      expectedMinimumKinds: context.expectedMinimumGamesKinds,
      expectedSeasons: context.expectedGamesSeasons,
      expectedMinimumMetadataDisabled: context.expectedMinimumGamesMetadataDisabled,
      expectedLiveParentCovers: context.expectedGamesLiveParentCovers,
      requireMigrationBaseline: context.requireGamesMigrationBaseline,
    });
    sendJson(response, 201, {
      ...result,
      check: evaluateGamesV2Shape({
        v2Root: context.v2Root,
        expectedMinimumEntries: result.gamesEntries,
        expectedMinimumKinds: context.expectedMinimumGamesKinds,
        expectedSeasons: context.expectedGamesSeasons,
        expectedMinimumMetadataDisabled: context.expectedMinimumGamesMetadataDisabled,
        expectedLiveParentCovers: context.expectedGamesLiveParentCovers,
        requireMigrationBaseline: context.requireGamesMigrationBaseline,
      }),
      publishTriggered: false,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/studio/checks/games-v2') {
    await readJsonBody(request);
    const result = evaluateGamesV2Shape({
      v2Root: context.v2Root,
      expectedMinimumEntries: context.expectedMinimumGamesEntries,
      expectedMinimumKinds: context.expectedMinimumGamesKinds,
      expectedSeasons: context.expectedGamesSeasons,
      expectedMinimumMetadataDisabled: context.expectedMinimumGamesMetadataDisabled,
      expectedLiveParentCovers: context.expectedGamesLiveParentCovers,
      requireMigrationBaseline: context.requireGamesMigrationBaseline,
    });
    sendJson(response, result.ok ? 200 : 422, {
      ...result,
      writeEnabled: false,
      writeScope: 'none',
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
  expectedMinimumTextsEntries = 132,
  expectedMinimumTextsKinds,
  expectedMinimumVisionsEntries = 112,
  expectedMinimumVisionsKinds,
  expectedVisionsCharacters = 20,
  expectedMinimumGamesEntries = 282,
  expectedMinimumGamesKinds,
  expectedGamesSeasons = 40,
  expectedMinimumGamesMetadataDisabled = 93,
  expectedGamesLiveParentCovers = 2,
  requireMigrationBaseline = true,
  requireTextsMigrationBaseline = requireMigrationBaseline,
  requireVisionsMigrationBaseline = requireMigrationBaseline,
  requireGamesMigrationBaseline = requireMigrationBaseline,
  projectRoot = process.cwd(),
} = {}) {
  const context = {
    v2Root,
    sourceRoot,
    writeEnabled,
    expectedMinimumEntries,
    expectedMinimumTextsEntries,
    expectedMinimumTextsKinds,
    expectedMinimumVisionsEntries,
    expectedMinimumVisionsKinds,
    expectedVisionsCharacters,
    expectedMinimumGamesEntries,
    expectedMinimumGamesKinds,
    expectedGamesSeasons,
    expectedMinimumGamesMetadataDisabled,
    expectedGamesLiveParentCovers,
    requireMigrationBaseline,
    requireTextsMigrationBaseline,
    requireVisionsMigrationBaseline,
    requireGamesMigrationBaseline,
    projectRoot,
    preflightTokens: new Map(),
    syncTokens: new Map(),
    homepageTokens: new Map(),
    updateTokens: new Map(),
  };
  return http.createServer((request, response) => {
    routeRequest(request, response, context).catch((error) => {
      if (error.rollback) {
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
    console.log('  writeScope: music/album/create, texts/*/create, visions/movie|series/create, games/normal_game/create');
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const requestedPort = Number.parseInt(process.env.ARCHIVE_STUDIO_PORT || '', 10);
  startArchiveStudioServer({
    port: Number.isInteger(requestedPort) ? requestedPort : DEFAULT_PORT,
  });
}
