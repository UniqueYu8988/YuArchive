import crypto from 'node:crypto';
import { once } from 'node:events';
import { readFile, rm, rmdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARCHIVE_DATA_V2_ROOT,
  ARCHIVE_SOURCE_ROOT,
} from './archive-data-v2-games-core.mjs';
import { createArchiveStudioServer } from './archive-studio-v0-server.mjs';
import { snapshotFileMetadata } from './archive-studio-v0-music-create-core.mjs';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';

const AUTHORIZATION_PHRASE = 'I authorize Archive Studio Games create rollback smoke test';
const EXPECTED_BASELINE_ENTRIES = 282;
const COVER_FIXTURE = path.resolve('public', 'icons', 'visions-character.webp');

function parseArgs(argv) {
  const result = { execute: false, authorization: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--execute') result.execute = true;
    else if (argv[index] === '--authorization') {
      result.authorization = argv[index + 1] || null;
      index += 1;
    }
  }
  return result;
}

async function exists(target) {
  try { await stat(target); return true } catch { return false }
}

function resolveInside(root, relativePath) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath) || relativePath.includes('\\') || relativePath.split('/').includes('..')) {
    throw new Error('unsafe_relative_path');
  }
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('path_escaped_root');
  return resolved;
}

async function removeIfEmpty(directory) {
  try { await rmdir(directory) } catch (error) { if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error }
}

function buildPayload() {
  const now = new Date();
  const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
  return {
    mode: 'create', board: 'games', kind: 'normal_game',
    id: `game-${day}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
    fields: {
      title: 'Archive Studio Games smoke test', year: now.getFullYear(), metadata_enabled: true,
      english_title: 'Archive Studio Games smoke test', url: '', platform: 'steam',
      price: '', rating: '', playtime: '', completed: false, genre: '',
    },
    assets: { cover: { source: 'selected-file', originalName: 'smoke-cover.webp', extension: '.webp' } },
  };
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

function jsonOptions(value) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}

async function createForm(token, payload) {
  const cover = await readFile(COVER_FIXTURE);
  const form = new FormData();
  form.set('payload', JSON.stringify(payload));
  form.set('preflightToken', token);
  form.set('cover', new Blob([cover], { type: 'image/webp' }), payload.assets.cover.originalName);
  return form;
}

async function rollbackCreatedGame({ result, v2Root, transactionsRootExisted, studioRootExisted }) {
  const transactionDir = resolveInside(v2Root, `migration/archive-studio-v0/transactions/${result.transactionId}`);
  const rollback = JSON.parse(await readFile(path.join(transactionDir, 'rollback.json'), 'utf8'));
  if (rollback.transactionId !== result.transactionId || !Array.isArray(rollback.deleteCreatedFiles) || rollback.removeEmptyEntryDirectory !== result.entryRelativeDir) {
    throw new Error('rollback_manifest_mismatch');
  }
  for (const relativePath of rollback.deleteCreatedFiles) await rm(resolveInside(v2Root, relativePath), { force: true });
  const entryDir = resolveInside(v2Root, result.entryRelativeDir);
  await removeIfEmpty(entryDir);
  await rm(transactionDir, { recursive: true, force: true });
  const transactionsRoot = path.dirname(transactionDir);
  const studioRoot = path.dirname(transactionsRoot);
  if (!transactionsRootExisted) await removeIfEmpty(transactionsRoot);
  if (!studioRootExisted) await removeIfEmpty(studioRoot);
}

export async function executeGamesCreateRollbackSmokeTest({
  v2Root = ARCHIVE_DATA_V2_ROOT,
  sourceRoot = ARCHIVE_SOURCE_ROOT,
} = {}) {
  const baseline = evaluateGamesV2Shape({ v2Root, expectedMinimumEntries: EXPECTED_BASELINE_ENTRIES });
  if (!baseline.ok || baseline.totalEntries !== EXPECTED_BASELINE_ENTRIES) throw new Error('unexpected_games_baseline');
  const sourceBefore = await snapshotFileMetadata(sourceRoot);
  const v2Before = await snapshotFileMetadata(v2Root);
  const transactionsRoot = resolveInside(v2Root, 'migration/archive-studio-v0/transactions');
  const studioRoot = path.dirname(transactionsRoot);
  const transactionsRootExisted = await exists(transactionsRoot);
  const studioRootExisted = await exists(studioRoot);
  const payload = buildPayload();
  const server = createArchiveStudioServer({ v2Root, sourceRoot, writeEnabled: true });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let createResult = null;
  try {
    const address = server.address();
    if (!address || typeof address !== 'object') throw new Error('server_address_unavailable');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const preview = await requestJson(baseUrl, '/api/studio/games/preview', jsonOptions(payload));
    if (preview.response.status !== 200 || !preview.body.ok) throw new Error('preview_failed');
    const preflight = await requestJson(baseUrl, '/api/studio/games/preflight', jsonOptions(payload));
    if (preflight.response.status !== 200 || !preflight.body.preflightToken) throw new Error('preflight_failed');
    const create = await requestJson(baseUrl, '/api/studio/games/create', {
      method: 'POST', body: await createForm(preflight.body.preflightToken, payload),
    });
    if (create.response.status !== 201 || !create.body.ok) throw new Error('create_failed');
    createResult = create.body;
    if (createResult.gamesEntries !== EXPECTED_BASELINE_ENTRIES + 1 || createResult.check?.ok !== true || createResult.sourceUnchanged !== true || createResult.publishTriggered !== false) {
      throw new Error('post_create_invariants_failed');
    }
  } finally {
    server.close();
    await once(server, 'close');
    if (createResult) await rollbackCreatedGame({ result: createResult, v2Root, transactionsRootExisted, studioRootExisted });
  }

  const postRollback = evaluateGamesV2Shape({ v2Root, expectedMinimumEntries: EXPECTED_BASELINE_ENTRIES });
  const sourceAfter = await snapshotFileMetadata(sourceRoot);
  const v2After = await snapshotFileMetadata(v2Root);
  const sourceUnchanged = sourceBefore.files === sourceAfter.files && sourceBefore.digest === sourceAfter.digest;
  const v2Restored = v2Before.files === v2After.files && v2Before.digest === v2After.digest;
  const entryResidual = await exists(resolveInside(v2Root, createResult.entryRelativeDir));
  const transactionResidual = await exists(resolveInside(v2Root, `migration/archive-studio-v0/transactions/${createResult.transactionId}`));
  if (!postRollback.ok || postRollback.totalEntries !== EXPECTED_BASELINE_ENTRIES) throw new Error('post_rollback_games_shape_failed');
  if (!sourceUnchanged) throw new Error('source_metadata_changed');
  if (!v2Restored) throw new Error('v2_metadata_not_restored');
  if (entryResidual || transactionResidual) throw new Error('rollback_residuals_remain');
  return {
    ok: true,
    createdEntryFiles: createResult.createdEntryFiles,
    createdTransactionFiles: createResult.createdTransactionFiles,
    postWriteEntries: createResult.gamesEntries,
    postRollbackEntries: postRollback.totalEntries,
    sourceFilesChecked: sourceBefore.files,
    sourceUnchanged,
    v2Restored,
    entryResiduals: Number(entryResidual),
    transactionResiduals: Number(transactionResidual),
    publishTriggered: createResult.publishTriggered,
    rollbackCompleted: true,
  };
}

export async function run(argv = []) {
  const options = parseArgs(argv);
  if (!options.execute) {
    console.log('[PASS] Archive Studio Games create + rollback smoke test plan');
    console.log('  mode: plan');
    console.log('  writeScope: none');
    console.log('  plannedEntryFiles: 2');
    console.log('  plannedTransactionFiles: 3');
    console.log('  expectedBaselineEntries: 282');
    console.log('  sourceWriteAllowed: false');
    console.log('  publishAllowed: false');
    return { ok: true, executed: false };
  }
  if (options.authorization !== AUTHORIZATION_PHRASE) {
    console.log('[WARN] Archive Studio Games create + rollback smoke test blocked');
    console.log('  reason: authorization_phrase_mismatch');
    console.log('  writeScope: none');
    return { ok: false, executed: false };
  }
  const result = await executeGamesCreateRollbackSmokeTest();
  console.log('[PASS] Archive Studio Games create + rollback smoke test');
  for (const [key, value] of Object.entries(result)) {
    if (key === 'ok') continue;
    console.log(`  ${key}: ${value}`);
  }
  console.log('  writeScope: single-temporary-game-entry-rolled-back');
  return { ok: true, executed: true, result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await run(process.argv.slice(2));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Archive Studio Games create + rollback smoke test');
    console.log(`  error: ${error.message || error}`);
    console.log('  rollback: attempted when create completed');
    process.exitCode = 1;
  }
}
