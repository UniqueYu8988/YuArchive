import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createArchiveStudioServer } from './archive-studio-v0-server.mjs';

function write(root, relativePath, value = 'fixture') {
  const target = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}

async function request(baseUrl, pathname, body = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'yuarchive-public-sync-'));
const projectRoot = path.join(sandbox, 'project');
const v2Root = path.join(sandbox, 'ArchiveData-v2');
const emptyPublic = {
  music: { key: 'music', display_name: 'Music', total_count: 0, sort_mode: 'music', items: [] },
  texts: { key: 'texts', display_name: 'Texts', total_count: 0, sort_mode: 'text', sections: [{ key: 'notes', title: 'Notes', description: '', icon: '', showcase_images: [], count: 0 }], items: [] },
  visions: { key: 'visions', display_name: 'Visions', total_count: 0, sort_mode: 'timeline', years: [{ year: 1, folder: 'current', items: [] }], showcase: { title: '', description: '', entries: [] } },
  games: { key: 'games', display_name: 'Games', total_count: 0, sort_mode: 'timeline', years: [] },
};

for (const [board, value] of Object.entries(emptyPublic)) {
  write(projectRoot, `public/data/${board}.json`, `${JSON.stringify(value, null, 2)}\n`);
}
write(v2Root, 'config/texts-sections.yaml', 'notes:\n  title: "Notes"\n  description: ""\n  icon: ""\n  aliases: ["notes"]\n  kind: article\n  cover_policy: none\n');
write(v2Root, 'entries/music/album/album-one/entry.yaml', 'id: "album-one"\nboard: music\nkind: album\ntitle: "Album One"\ndescription: "Description"\nlegacy: {}\n');
write(v2Root, 'entries/music/album/album-one/content.md', 'Album content\n');
write(v2Root, 'entries/music/album/album-one/cover.jpg');
write(v2Root, 'entries/music/album/album-one/audio.mp3');
write(v2Root, 'entries/texts/article/text-one/entry.yaml', 'id: "text-one"\nboard: texts\nkind: article\ntitle: "Text One"\nsection: notes\ndate: "2026-06-21"\nsummary: "Summary"\ntags: ["tag"]\nlegacy: {}\n');
write(v2Root, 'entries/texts/article/text-one/content.md', 'Text content\n');
write(v2Root, 'entries/visions/movie/vision-one/entry.yaml', 'id: "vision-one"\nboard: visions\nkind: movie\ntitle: "Vision One"\nperiod: current\ncinema: false\nquote: ""\nurl: ""\nlegacy: {}\n');
write(v2Root, 'entries/visions/movie/vision-one/poster.jpg');
write(v2Root, 'entries/games/normal_game/game-one/entry.yaml', 'id: "game-one"\nboard: games\nkind: normal_game\ntitle: "Game One"\nyear: 2026\nmetadata_enabled: false\nlegacy: {}\n');
write(v2Root, 'entries/games/normal_game/game-one/cover.jpg');

const server = createArchiveStudioServer({ v2Root, projectRoot, requireMigrationBaseline: false });
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  for (const board of Object.keys(emptyPublic)) {
    const preview = await request(baseUrl, `/api/studio/${board}/sync-preview`);
    if (preview.status !== 200 || preview.body.pendingEntries !== 1 || !preview.body.syncToken) {
      throw new Error(`${board}_preview_failed`);
    }
    const applied = await request(baseUrl, `/api/studio/${board}/sync-apply`, { syncToken: preview.body.syncToken });
    if (applied.status !== 200 || applied.body.state !== 'synced' || applied.body.nextEntries !== 1) {
      throw new Error(`${board}_apply_failed`);
    }
    const current = await request(baseUrl, `/api/studio/${board}/sync-preview`);
    if (current.status !== 200 || current.body.pendingEntries !== 0 || current.body.state !== 'current') {
      throw new Error(`${board}_idempotence_failed`);
    }
  }
  const rejected = await request(baseUrl, '/api/studio/games/sync-apply', { syncToken: 'invalid' });
  if (rejected.status !== 403) throw new Error('invalid_token_not_rejected');
  console.log('[PASS] Archive Studio public sync');
  console.log('  boards: 4');
  console.log('  preview/apply/current: passed');
  console.log('  invalidToken: rejected');
  console.log('  writeScope: system-temp only');
} catch (error) {
  console.log('[FAIL] Archive Studio public sync');
  console.log(`  error: ${error instanceof Error ? error.message : 'unknown_error'}`);
  process.exitCode = 1;
} finally {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(sandbox, { recursive: true, force: true });
}
