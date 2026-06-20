import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createArchiveStudioServer } from './archive-studio-v0-server.mjs';

const payload = {
  mode: 'create',
  board: 'visions',
  kind: 'movie',
  id: 'vision-20260620-a1b2c3d4',
  fields: {
    title: 'Visions API Check',
    period: '此岸',
    cinema: true,
    quote: 'Check only.',
    url: 'https://example.com/vision',
  },
  assets: {
    poster: {
      source: 'selected-file',
      originalName: 'poster.webp',
      extension: '.webp',
    },
  },
};

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

function jsonOptions(value) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  };
}

function createForm(token, value) {
  const form = new FormData();
  form.set('payload', JSON.stringify(value));
  form.set('preflightToken', token);
  form.set('poster', new Blob([Buffer.from('poster')], { type: 'image/webp' }), 'poster.webp');
  return form;
}

async function writePeriodsConfig(v2Root) {
  await mkdir(path.join(v2Root, 'entries', 'visions'), { recursive: true });
  await mkdir(path.join(v2Root, 'config'), { recursive: true });
  await writeFile(path.join(v2Root, 'config', 'visions-periods.yaml'), [
    '开端:',
    '  order: 1',
    '  synthetic_year: 2017',
    '前尘:',
    '  order: 2',
    '  synthetic_year: 2020',
    '旧影:',
    '  order: 3',
    '  synthetic_year: 2023',
    '未远:',
    '  order: 4',
    '  synthetic_year: 2025',
    '此岸:',
    '  order: 5',
    '  synthetic_year: 2026',
    '',
  ].join('\n'), 'utf8');
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-studio-visions-api-'));
  const v2Root = path.join(tempRoot, 'ArchiveData-v2');
  const sourceRoot = path.join(tempRoot, 'source-baseline');
  const sourceMarker = path.join(sourceRoot, 'baseline.txt');
  await writePeriodsConfig(v2Root);
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(sourceMarker, 'source baseline', 'utf8');
  const server = createArchiveStudioServer({
    v2Root,
    sourceRoot,
    writeEnabled: true,
    expectedMinimumEntries: 0,
    expectedMinimumTextsEntries: 0,
    expectedMinimumTextsKinds: { article: 0, book_note: 0, series_note: 0 },
    expectedMinimumVisionsEntries: 0,
    expectedMinimumVisionsKinds: { movie: 0, series: 0, showcase: 0 },
    expectedVisionsCharacters: 0,
    requireMigrationBaseline: false,
    requireTextsMigrationBaseline: false,
    requireVisionsMigrationBaseline: false,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const profiles = await requestJson(baseUrl, '/api/studio/profiles');
    const visionProfiles = profiles.body.profiles.filter(profile => profile.board === 'visions');
    assert.equal(visionProfiles.length, 2);
    assert(visionProfiles.every(profile => profile.capabilities.create && !profile.capabilities.publish));

    const preview = await requestJson(baseUrl, '/api/studio/visions/preview', jsonOptions(payload));
    assert.equal(preview.response.status, 200);
    assert.equal(preview.body.ok, true);
    assert.equal(preview.body.operations.length, 2);

    const invalid = await requestJson(baseUrl, '/api/studio/visions/preview', jsonOptions({
      ...payload,
      assets: {},
    }));
    assert.equal(invalid.response.status, 422);
    assert(invalid.body.errors.some(error => error.code === 'missing_poster'));

    const preflight = await requestJson(baseUrl, '/api/studio/visions/preflight', jsonOptions(payload));
    assert.equal(preflight.response.status, 200);
    assert.equal(typeof preflight.body.preflightToken, 'string');
    const create = await requestJson(baseUrl, '/api/studio/visions/create', {
      method: 'POST',
      body: createForm(preflight.body.preflightToken, payload),
    });
    assert.equal(create.response.status, 201, JSON.stringify(create.body));
    assert.equal(create.body.visionsEntries, 1);
    assert.equal(create.body.sourceUnchanged, true);
    assert.equal(create.body.publishTriggered, false);
    assert.equal(create.body.check.ok, true);
    const createdRoot = path.join(v2Root, 'entries', 'visions', 'movie', payload.id);
    assert.equal((await readFile(path.join(createdRoot, 'entry.yaml'), 'utf8')).includes('board: visions'), true);
    assert.equal(await readFile(sourceMarker, 'utf8'), 'source baseline');
    const transactionsRoot = path.join(v2Root, 'migration', 'archive-studio-v0', 'transactions');
    const transactions = await readdir(transactionsRoot, { withFileTypes: true });
    assert.equal(transactions.filter(entry => entry.isDirectory()).length, 1);

    const replay = await requestJson(baseUrl, '/api/studio/visions/create', {
      method: 'POST',
      body: createForm(preflight.body.preflightToken, payload),
    });
    assert.equal(replay.response.status, 403);
    assert.equal(replay.body.error.code, 'preflight_token_invalid');
    const conflict = await requestJson(baseUrl, '/api/studio/visions/preflight', jsonOptions(payload));
    assert.equal(conflict.response.status, 409);
    assert(conflict.body.blockedReasons.includes('create_target_exists'));

    await rm(transactionsRoot, { recursive: true, force: true });
    await mkdir(path.dirname(transactionsRoot), { recursive: true });
    await writeFile(transactionsRoot, 'intentional conflict', 'utf8');
    const failurePayload = { ...payload, id: 'vision-20260620-deadbeef' };
    const failurePreflight = await requestJson(baseUrl, '/api/studio/visions/preflight', jsonOptions(failurePayload));
    assert.equal(failurePreflight.response.status, 200);
    const failedCreate = await requestJson(baseUrl, '/api/studio/visions/create', {
      method: 'POST',
      body: createForm(failurePreflight.body.preflightToken, failurePayload),
    });
    assert.equal(failedCreate.response.status, 500);
    assert.equal(failedCreate.body.error.code, 'visions_create_transaction_failed');
    assert.equal(failedCreate.body.error.rollback.completed, true);
    await assert.rejects(readFile(path.join(v2Root, 'entries', 'visions', 'movie', failurePayload.id, 'entry.yaml')));

    const check = await requestJson(baseUrl, '/api/studio/checks/visions-v2', jsonOptions({}));
    assert.equal(check.response.status, 200);
    assert.equal(check.body.totalEntries, 1);
    assert.equal(check.body.malformedEntries, 0);
    const publish = await requestJson(baseUrl, '/api/studio/publish');
    assert.equal(publish.response.status, 404);

    console.log('[PASS] Archive Studio Visions API check');
    console.log('  profiles: passed');
    console.log('  preview: passed');
    console.log('  missingPosterBlocked: passed');
    console.log('  preflightToken: passed');
    console.log('  movieCreate: passed');
    console.log('  tokenReplayBlocked: passed');
    console.log('  createConflictBlocked: passed');
    console.log('  failedCreateRollback: passed');
    console.log('  visionsV2Check: passed');
    console.log('  sourceUnchanged: passed');
    console.log('  publishRouteAbsent: passed');
  } finally {
    server.close();
    await once(server, 'close');
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
