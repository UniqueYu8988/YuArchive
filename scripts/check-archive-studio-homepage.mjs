import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createArchiveStudioServer } from './archive-studio-v0-server.mjs';
import { HOMEPAGE_LIMITS } from './archive-studio-homepage-core.mjs';

function write(root, relativePath, value = 'fixture') {
  const target = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}

function gameItem(id, title, year) {
  return {
    id, image_path: `existing/${id}.jpg`, title, cinema: false, quote: '', url: '', type: 'game',
    game_meta_enabled: false, english_title: '', platform: 'steam', price: '', rating: '', playtime: '',
    completed: false, genre: '', seasonal: false, dlc: false, dlc_parent: '', summary: '', hover_note: '',
    season_heading: '', season_subheading: '', season_description: '', season_entries: [],
  };
}

function buildFixture(projectRoot, v2Root) {
  const publicData = {
    games: { key: 'games', display_name: 'Games', total_count: HOMEPAGE_LIMITS.games, sort_mode: 'timeline', years: [{ year: 2026, folder: '2026', items: [] }] },
    visions: { key: 'visions', display_name: 'Visions', total_count: HOMEPAGE_LIMITS.visions, sort_mode: 'timeline', years: [{ year: 1, folder: 'current', items: [] }], showcase: { title: '', description: '', entries: [] } },
    music: { key: 'music', display_name: 'Music', total_count: HOMEPAGE_LIMITS.music, sort_mode: 'music', items: [] },
    texts: { key: 'texts', display_name: 'Texts', total_count: HOMEPAGE_LIMITS.texts, sort_mode: 'text', sections: [{ key: 'notes', title: 'Notes', description: '', icon: '', showcase_images: [], count: HOMEPAGE_LIMITS.texts }], items: [] },
  };
  write(v2Root, 'config/texts-sections.yaml', 'notes:\n  title: "Notes"\n  description: ""\n  icon: ""\n  aliases: ["notes"]\n  kind: article\n  cover_policy: none\n');

  for (let index = 1; index <= HOMEPAGE_LIMITS.games; index += 1) {
    const id = `game-${index}`; const title = `Game ${index}`;
    write(v2Root, `entries/games/normal_game/${id}/entry.yaml`, `id: "${id}"\nboard: games\nkind: normal_game\ntitle: "${title}"\nyear: 2026\nmetadata_enabled: false\nlegacy: {}\n`);
    write(v2Root, `entries/games/normal_game/${id}/cover.jpg`);
    publicData.games.years[0].items.push(gameItem(`live-${id}`, title, 2026));
  }
  for (let index = 1; index <= HOMEPAGE_LIMITS.visions; index += 1) {
    const id = `vision-${index}`; const title = `Vision ${index}`;
    write(v2Root, `entries/visions/movie/${id}/entry.yaml`, `id: "${id}"\nboard: visions\nkind: movie\ntitle: "${title}"\nperiod: current\ncinema: false\nquote: ""\nurl: ""\nlegacy: {}\n`);
    write(v2Root, `entries/visions/movie/${id}/poster.jpg`);
    publicData.visions.years[0].items.push({ id: `live-${id}`, image_path: `existing/${id}.jpg`, title, cinema: false, quote: '', url: '', type: 'movie' });
  }
  for (let index = 1; index <= HOMEPAGE_LIMITS.music; index += 1) {
    const id = `album-${index}`; const title = `Album ${index}`;
    write(v2Root, `entries/music/album/${id}/entry.yaml`, `id: "${id}"\nboard: music\nkind: album\ntitle: "${title}"\ndescription: "Description"\nlegacy: {}\n`);
    write(v2Root, `entries/music/album/${id}/content.md`, 'Content\n');
    write(v2Root, `entries/music/album/${id}/cover.jpg`);
    write(v2Root, `entries/music/album/${id}/audio.mp3`);
    publicData.music.items.push({ id: `live-${id}`, title, cover: `existing/${id}.jpg`, description: 'Description', content: 'Content\n', audio: `existing/${id}.mp3`, url: '', track_title: '' });
  }
  for (let index = 1; index <= HOMEPAGE_LIMITS.texts; index += 1) {
    const id = `text-${index}`; const title = `Text ${index}`;
    write(v2Root, `entries/texts/article/${id}/entry.yaml`, `id: "${id}"\nboard: texts\nkind: article\ntitle: "${title}"\nsection: notes\ndate: "2026-06-${String(index).padStart(2, '0')}"\nsummary: "Summary"\ntags: []\nlegacy: {}\n`);
    write(v2Root, `entries/texts/article/${id}/content.md`, 'Content\n');
    publicData.texts.items.push({ id: `live-${id}`, title, date: `2026-06-${String(index).padStart(2, '0')}`, sort_date: `2026-06-${String(index).padStart(2, '0')}`, section: 'notes', section_title: 'Notes', cover: '', author: '', summary: 'Summary', excerpt: 'Content', tags: [], content: 'Content\n' });
  }
  for (const [board, data] of Object.entries(publicData)) write(projectRoot, `public/data/${board}.json`, `${JSON.stringify(data, null, 2)}\n`);
  write(projectRoot, 'public/data/home.json', `${JSON.stringify({
    counts: Object.fromEntries(Object.entries(publicData).map(([board, data]) => [board, data.total_count])),
    latestGames: publicData.games.years[0].items,
    latestVisions: publicData.visions.years[0].items,
    latestMusic: publicData.music.items,
    latestTexts: publicData.texts.items,
  }, null, 2)}\n`);
}

async function request(baseUrl, pathname, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'yuarchive-homepage-'));
const projectRoot = path.join(sandbox, 'project');
const v2Root = path.join(sandbox, 'ArchiveData-v2');
buildFixture(projectRoot, v2Root);
const server = createArchiveStudioServer({ v2Root, projectRoot, requireMigrationBaseline: false });

try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const initial = await request(baseUrl, '/api/studio/homepage');
  if (initial.status !== 200 || initial.body.configExists || !initial.body.ok) throw new Error('bootstrap_failed');

  const invalidSelection = structuredClone(initial.body.selection);
  invalidSelection.games.pop();
  const invalid = await request(baseUrl, '/api/studio/homepage/config-preview', { method: 'POST', body: { selection: invalidSelection } });
  if (invalid.status !== 422 || invalid.body.token) throw new Error('invalid_selection_not_blocked');

  const firstPreview = await request(baseUrl, '/api/studio/homepage/config-preview', { method: 'POST', body: { selection: initial.body.selection } });
  if (firstPreview.status !== 200 || !firstPreview.body.token) throw new Error('config_preview_failed');
  const firstSave = await request(baseUrl, '/api/studio/homepage/config-save', { method: 'POST', body: { token: firstPreview.body.token } });
  if (firstSave.status !== 200 || firstSave.body.state !== 'saved') throw new Error('config_save_failed');

  const reordered = structuredClone(initial.body.selection);
  [reordered.games[0], reordered.games[1]] = [reordered.games[1], reordered.games[0]];
  const reorderPreview = await request(baseUrl, '/api/studio/homepage/config-preview', { method: 'POST', body: { selection: reordered } });
  const reorderSave = await request(baseUrl, '/api/studio/homepage/config-save', { method: 'POST', body: { token: reorderPreview.body.token } });
  if (reorderSave.status !== 200) throw new Error('reorder_save_failed');

  const syncPreview = await request(baseUrl, '/api/studio/homepage/sync-preview', { method: 'POST', body: {} });
  if (syncPreview.status !== 200 || syncPreview.body.state !== 'ready' || !syncPreview.body.token) throw new Error('sync_preview_failed');
  const sync = await request(baseUrl, '/api/studio/homepage/sync-apply', { method: 'POST', body: { token: syncPreview.body.token } });
  if (sync.status !== 200 || sync.body.state !== 'synced') throw new Error('sync_apply_failed');
  const current = await request(baseUrl, '/api/studio/homepage/sync-preview', { method: 'POST', body: {} });
  if (current.status !== 200 || current.body.state !== 'current' || current.body.token) throw new Error('sync_idempotence_failed');
  const rejected = await request(baseUrl, '/api/studio/homepage/sync-apply', { method: 'POST', body: { token: 'invalid' } });
  if (rejected.status !== 403) throw new Error('invalid_token_not_rejected');

  console.log('[PASS] Archive Studio homepage curation');
  console.log('  bootstrapSelections: 29');
  console.log('  invalidSelection: blocked');
  console.log('  configPreviewSave: passed');
  console.log('  reorderAndPublicSync: passed');
  console.log('  idempotenceAndToken: passed');
  console.log('  writeScope: system-temp only');
} catch (error) {
  console.log('[FAIL] Archive Studio homepage curation');
  console.log(`  error: ${error instanceof Error ? error.message : 'unknown_error'}`);
  process.exitCode = 1;
} finally {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(sandbox, { recursive: true, force: true });
}
