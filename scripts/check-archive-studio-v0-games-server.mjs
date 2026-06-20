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
  mode: 'create', board: 'games', kind: 'normal_game', id: 'game-20260620-a1b2c3d4',
  fields: {
    title: 'Games API Check', year: 2026, metadata_enabled: true,
    english_title: 'Games API Check', url: 'https://example.com/game',
    platform: 'steam', price: '', rating: 4, playtime: '<50h', completed: true, genre: 'action',
  },
  assets: { cover: { source: 'selected-file', originalName: 'cover.webp', extension: '.webp' } },
};

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

function jsonOptions(value) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}

function createForm(token, value) {
  const form = new FormData();
  form.set('payload', JSON.stringify(value));
  form.set('preflightToken', token);
  form.set('cover', new Blob([Buffer.from('cover')], { type: 'image/webp' }), 'cover.webp');
  return form;
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-studio-games-api-'));
  const v2Root = path.join(tempRoot, 'ArchiveData-v2');
  const sourceRoot = path.join(tempRoot, 'source-baseline');
  await mkdir(path.join(v2Root, 'entries', 'games'), { recursive: true });
  await mkdir(path.join(v2Root, 'config'), { recursive: true });
  await writeFile(path.join(v2Root, 'config', 'games.yaml'), 'season_target_year: 2026\nseason_priority:\n');
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(path.join(sourceRoot, 'baseline.txt'), 'source baseline');
  const server = createArchiveStudioServer({
    v2Root, sourceRoot, writeEnabled: true,
    expectedMinimumEntries: 0,
    expectedMinimumTextsEntries: 0,
    expectedMinimumTextsKinds: { article: 0, book_note: 0, series_note: 0 },
    expectedMinimumVisionsEntries: 0,
    expectedMinimumVisionsKinds: { movie: 0, series: 0, showcase: 0 },
    expectedVisionsCharacters: 0,
    expectedMinimumGamesEntries: 0,
    expectedMinimumGamesKinds: { normal_game: 0, dlc: 0, live_game: 0 },
    expectedGamesSeasons: 0,
    expectedMinimumGamesMetadataDisabled: 0,
    expectedGamesLiveParentCovers: 0,
    requireMigrationBaseline: false,
    requireTextsMigrationBaseline: false,
    requireVisionsMigrationBaseline: false,
    requireGamesMigrationBaseline: false,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const profiles = await requestJson(baseUrl, '/api/studio/profiles');
    const profilesForGames = profiles.body.profiles.filter(profile => profile.board === 'games');
    assert.equal(profilesForGames.length, 1);
    assert.equal(profilesForGames[0].kind, 'normal_game');
    assert.equal(profilesForGames[0].capabilities.publish, false);

    const preview = await requestJson(baseUrl, '/api/studio/games/preview', jsonOptions(payload));
    assert.equal(preview.response.status, 200);
    const missing = await requestJson(baseUrl, '/api/studio/games/preview', jsonOptions({ ...payload, assets: {} }));
    assert.equal(missing.response.status, 422);
    const preflight = await requestJson(baseUrl, '/api/studio/games/preflight', jsonOptions(payload));
    assert.equal(preflight.response.status, 200);
    assert.equal(typeof preflight.body.preflightToken, 'string');
    const create = await requestJson(baseUrl, '/api/studio/games/create', {
      method: 'POST', body: createForm(preflight.body.preflightToken, payload),
    });
    assert.equal(create.response.status, 201, JSON.stringify(create.body));
    assert.equal(create.body.gamesEntries, 1);
    assert.equal(create.body.sourceUnchanged, true);
    assert.equal(create.body.publishTriggered, false);
    assert.equal(create.body.check.ok, true);
    const createdRoot = path.join(v2Root, 'entries', 'games', 'normal_game', payload.id);
    assert((await readFile(path.join(createdRoot, 'entry.yaml'), 'utf8')).includes('board: games'));

    const replay = await requestJson(baseUrl, '/api/studio/games/create', {
      method: 'POST', body: createForm(preflight.body.preflightToken, payload),
    });
    assert.equal(replay.response.status, 403);
    const conflict = await requestJson(baseUrl, '/api/studio/games/preflight', jsonOptions(payload));
    assert.equal(conflict.response.status, 409);

    const transactionsRoot = path.join(v2Root, 'migration', 'archive-studio-v0', 'transactions');
    await rm(transactionsRoot, { recursive: true, force: true });
    await mkdir(path.dirname(transactionsRoot), { recursive: true });
    await writeFile(transactionsRoot, 'intentional conflict');
    const failurePayload = { ...payload, id: 'game-20260620-deadbeef' };
    const failurePreflight = await requestJson(baseUrl, '/api/studio/games/preflight', jsonOptions(failurePayload));
    assert.equal(failurePreflight.response.status, 200);
    const failedCreate = await requestJson(baseUrl, '/api/studio/games/create', {
      method: 'POST', body: createForm(failurePreflight.body.preflightToken, failurePayload),
    });
    assert.equal(failedCreate.response.status, 500);
    assert.equal(failedCreate.body.error.rollback.completed, true);
    await assert.rejects(readFile(path.join(v2Root, 'entries', 'games', 'normal_game', failurePayload.id, 'entry.yaml')));

    const check = await requestJson(baseUrl, '/api/studio/checks/games-v2', jsonOptions({}));
    assert.equal(check.response.status, 200);
    assert.equal(check.body.totalEntries, 1);
    const publish = await requestJson(baseUrl, '/api/studio/publish');
    assert.equal(publish.response.status, 404);
    const transactions = await readdir(path.dirname(transactionsRoot), { withFileTypes: true });
    assert(transactions.length >= 1);

    console.log('[PASS] Archive Studio Games API check');
    console.log('  profile: passed');
    console.log('  preview: passed');
    console.log('  missingCoverBlocked: passed');
    console.log('  preflightToken: passed');
    console.log('  normalGameCreate: passed');
    console.log('  tokenReplayBlocked: passed');
    console.log('  createConflictBlocked: passed');
    console.log('  failedCreateRollback: passed');
    console.log('  gamesV2Check: passed');
    console.log('  sourceUnchanged: passed');
    console.log('  publishRouteAbsent: passed');
  } finally {
    server.close();
    await once(server, 'close');
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
