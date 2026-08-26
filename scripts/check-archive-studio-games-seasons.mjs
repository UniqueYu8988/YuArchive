import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createArchiveStudioServer } from './archive-studio-v0-server.mjs';

const parentId = 'game-aaaaaaaaaaaa';
const existingSeasonId = 'season-111111111111';
const newSeasonId = 'season-222222222222';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function write(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function jsonOptions(value) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

function seasonForm(payload, token) {
  const form = new FormData();
  form.set('payload', JSON.stringify(payload));
  form.set('preflightToken', token);
  form.set('cover', new Blob([png], { type: 'image/png' }), 'season.png');
  return form;
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-studio-seasons-'));
  const v2Root = path.join(tempRoot, 'Archive');
  const sourceRoot = path.join(tempRoot, 'legacy-source');
  const projectRoot = path.join(tempRoot, 'project');
  const parentRoot = path.join(v2Root, 'entries', 'games', 'live_game', parentId);
  const existingSeasonRoot = path.join(parentRoot, 'seasons', existingSeasonId);
  write(path.join(v2Root, 'config', 'games.yaml'), 'season_target_year: 2026\nseason_priority:\n');
  write(path.join(sourceRoot, 'baseline.txt'), 'unchanged');
  write(path.join(parentRoot, 'entry.yaml'), [
    `id: ${parentId}`, 'board: games', 'kind: live_game', 'title: "Live Parent"',
    'metadata_enabled: true', 'english_title: ""', 'url: ""', 'platform: "others"',
    'price: ""', 'rating: ""', 'playtime: ""', 'completed: false', 'genre: ""',
    'season_heading: ""', 'season_subheading: ""', 'season_description: ""', 'legacy: {}', '',
  ].join('\n'));
  write(path.join(existingSeasonRoot, 'season.yaml'), [
    `id: ${existingSeasonId}`, 'title: "S1"', 'label: "赛季"', 'order: 1', 'period: "2025"', 'legacy: {}', '',
  ].join('\n'));
  write(path.join(existingSeasonRoot, 'cover.png'), png);
  write(path.join(projectRoot, 'public', 'data', 'games.json'), `${JSON.stringify({
    total_count: 1,
    years: [{ year: 2026, folder: '2026', items: [{
      id: 'public-live-parent', image_path: 'legacy-parent.webp', title: 'Live Parent', cinema: false, quote: '', url: '', type: 'game',
      game_meta_enabled: true, english_title: '', platform: 'others', price: '', rating: '', playtime: '', completed: false, genre: '',
      seasonal: true, dlc: false, dlc_parent: '', summary: '', hover_note: '', season_heading: '', season_subheading: '', season_description: '',
      season_entries: [{ id: 'legacy-season-1', image_path: 'legacy-season.webp', icon_path: '', title: 'S1', label: '赛季', champion: '', note: '', period: '2025', theme: '', feature: '', build: '', source_year: 2026, order: 1 }],
    }] }],
  }, null, 2)}\n`);

  const payload = {
    mode: 'create', board: 'games', kind: 'season', id: newSeasonId, parentId,
    fields: { title: 'S2', label: '赛季', order: 2, period: '2026' },
    assets: { cover: { source: 'selected-file', originalName: 'season.png', extension: '.png' } },
  };
  const server = createArchiveStudioServer({
    v2Root, sourceRoot, projectRoot, writeEnabled: true,
    expectedMinimumEntries: 0,
    expectedMinimumTextsEntries: 0,
    expectedMinimumTextsKinds: { article: 0, book_note: 0, series_note: 0 },
    expectedMinimumVisionsEntries: 0,
    expectedMinimumVisionsKinds: { movie: 0, series: 0, showcase: 0 },
    expectedVisionsCharacters: 0,
    expectedMinimumGamesEntries: 1,
    expectedMinimumGamesKinds: { normal_game: 0, dlc: 0, live_game: 1 },
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
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const profiles = await request(baseUrl, '/api/studio/profiles');
    assert(profiles.body.profiles.some(profile => profile.board === 'games' && profile.kind === 'season' && profile.capabilities.create));
    const parents = await request(baseUrl, '/api/studio/games/live-parents');
    assert.equal(parents.body.parents.length, 1);
    assert.equal(parents.body.parents[0].nextOrder, 2);
    assert.deepEqual(parents.body.parents[0].supportedFields, ['period']);

    const preview = await request(baseUrl, '/api/studio/games/season-preview', jsonOptions(payload));
    assert.equal(preview.response.status, 200, JSON.stringify(preview.body));
    const preflight = await request(baseUrl, '/api/studio/games/season-preflight', jsonOptions(payload));
    assert.equal(preflight.response.status, 200, JSON.stringify(preflight.body));
    const created = await request(baseUrl, '/api/studio/games/season-create', {
      method: 'POST', body: seasonForm(payload, preflight.body.preflightToken),
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.seasons, 2);
    assert.equal(created.body.sourceUnchanged, true);
    assert(fs.existsSync(path.join(parentRoot, 'seasons', newSeasonId, 'season.yaml')));

    const duplicate = await request(baseUrl, '/api/studio/games/season-preflight', jsonOptions({ ...payload, id: 'season-333333333333' }));
    assert.equal(duplicate.response.status, 409);
    assert(duplicate.body.blockedReasons.includes('season_title_conflict'));

    const syncPreview = await request(baseUrl, '/api/studio/games/sync-preview', jsonOptions({}));
    assert.equal(syncPreview.response.status, 200, JSON.stringify(syncPreview.body));
    assert.equal(syncPreview.body.pendingUpdates, 1);
    assert.equal(syncPreview.body.mediaFiles, 1);
    assert.equal(syncPreview.body.nextEntries, 1);
    const syncApply = await request(baseUrl, '/api/studio/games/sync-apply', jsonOptions({ syncToken: syncPreview.body.syncToken }));
    assert.equal(syncApply.response.status, 200, JSON.stringify(syncApply.body));
    const currentSync = await request(baseUrl, '/api/studio/games/sync-preview', jsonOptions({}));
    assert.equal(currentSync.response.status, 200);
    assert.equal(currentSync.body.pendingEntries, 0);
    assert.equal(currentSync.body.state, 'current');
    const publicData = JSON.parse(fs.readFileSync(path.join(projectRoot, 'public', 'data', 'games.json'), 'utf8'));
    const liveItem = publicData.years[0].items[0];
    assert.equal(liveItem.id, 'public-live-parent');
    assert.equal(liveItem.season_entries.length, 2);
    assert.equal(liveItem.season_entries[0].id, 'legacy-season-1');
    assert.equal(liveItem.season_entries[0].image_path, 'legacy-season.webp');
    assert.equal(liveItem.season_entries[1].id, newSeasonId);
    assert(String(liveItem.season_entries[1].image_path).endsWith('/cover.webp'));

    const nextPayload = {
      ...payload,
      id: 'season-444444444444',
      fields: { ...payload.fields, title: 'S3', order: 3 },
    };
    const nextPreflight = await request(baseUrl, '/api/studio/games/season-preflight', jsonOptions(nextPayload));
    assert.equal(nextPreflight.response.status, 200, JSON.stringify(nextPreflight.body));

    console.log('[PASS] Archive Studio game season create and sync check');
    console.log('  liveParentDiscovery: passed');
    console.log('  previewAndPreflight: passed');
    console.log('  seasonCreate: passed');
    console.log('  duplicateTitleBlocked: passed');
    console.log('  sourceBoundary: unchanged');
    console.log('  publicSync: passed');
    console.log('  existingSeasonIdentityAndMedia: preserved');
    console.log('  dynamicSeasonBaseline: passed');
  } finally {
    server.close();
    await once(server, 'close');
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

await main();
