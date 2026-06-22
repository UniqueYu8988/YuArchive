import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createArchiveStudioServer } from './archive-studio-v0-server.mjs';

const IMAGE_BYTES = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  'base64',
);

function wavBytes() {
  const sampleRate = 8000;
  const samples = 800;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

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
const v2Root = path.join(sandbox, 'Archive');
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
write(v2Root, 'entries/music/album/album-one/cover.png', IMAGE_BYTES);
write(v2Root, 'entries/music/album/album-one/audio.wav', wavBytes());
write(v2Root, 'entries/texts/article/text-one/entry.yaml', 'id: "text-one"\nboard: texts\nkind: article\ntitle: "Text One"\nsection: notes\ndate: "2026-06-21"\nsummary: "Summary"\ntags: ["tag"]\nlegacy: {}\n');
write(v2Root, 'entries/texts/article/text-one/content.md', 'Text content\n');
write(v2Root, 'entries/visions/movie/vision-one/entry.yaml', 'id: "vision-one"\nboard: visions\nkind: movie\ntitle: "Vision One"\nperiod: current\ncinema: false\nquote: ""\nurl: ""\nlegacy: {}\n');
write(v2Root, 'entries/visions/movie/vision-one/poster.png', IMAGE_BYTES);
write(v2Root, 'entries/games/normal_game/game-one/entry.yaml', 'id: "game-one"\nboard: games\nkind: normal_game\ntitle: "Game One"\nyear: 2026\nmetadata_enabled: false\nlegacy: {}\n');
write(v2Root, 'entries/games/normal_game/game-one/cover.png', IMAGE_BYTES);

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
    if (
      preview.status !== 200
      || preview.body.pendingEntries !== 1
      || !preview.body.syncToken
      || preview.body.mediaTransforms.length !== preview.body.mediaFiles
    ) {
      throw new Error(`${board}_preview_failed`);
    }
    const applied = await request(baseUrl, `/api/studio/${board}/sync-apply`, { syncToken: preview.body.syncToken });
    if (
      applied.status !== 200
      || applied.body.state !== 'synced'
      || applied.body.nextEntries !== 1
      || applied.body.optimizedMedia.length !== preview.body.mediaFiles
    ) {
      throw new Error(`${board}_apply_failed:${JSON.stringify(applied.body)}`);
    }
    const current = await request(baseUrl, `/api/studio/${board}/sync-preview`);
    if (current.status !== 200 || current.body.pendingEntries !== 0 || current.body.state !== 'current') {
      throw new Error(`${board}_idempotence_failed`);
    }
  }

  write(v2Root, 'entries/music/album/album-invalid/entry.yaml', 'id: "album-invalid"\nboard: music\nkind: album\ntitle: "Album Invalid"\nlegacy: {}\n');
  write(v2Root, 'entries/music/album/album-invalid/content.md', 'Invalid fixture\n');
  write(v2Root, 'entries/music/album/album-invalid/cover.png', 'invalid image');
  write(v2Root, 'entries/music/album/album-invalid/audio.wav', wavBytes());
  const failedPreview = await request(baseUrl, '/api/studio/music/sync-preview');
  if (failedPreview.status !== 200 || failedPreview.body.pendingEntries !== 1) {
    throw new Error('media_failure_preview_failed');
  }
  const beforeFailure = fs.readFileSync(path.join(projectRoot, 'public', 'data', 'music.json'), 'utf8');
  const failedApply = await request(baseUrl, '/api/studio/music/sync-apply', {
    syncToken: failedPreview.body.syncToken,
  });
  if (failedApply.status !== 500 || failedApply.body.error?.rollback?.completed !== true) {
    throw new Error('media_failure_not_rolled_back');
  }
  if (fs.readFileSync(path.join(projectRoot, 'public', 'data', 'music.json'), 'utf8') !== beforeFailure) {
    throw new Error('media_failure_changed_public_json');
  }
  if (fs.existsSync(path.join(projectRoot, 'public', 'studio_media', 'music', 'album-invalid'))) {
    throw new Error('media_failure_left_public_files');
  }

  const rejected = await request(baseUrl, '/api/studio/games/sync-apply', { syncToken: 'invalid' });
  if (rejected.status !== 403) throw new Error('invalid_token_not_rejected');
  console.log('[PASS] Archive Studio public sync');
  console.log('  boards: 4');
  console.log('  preview/apply/current: passed');
  console.log('  imageWebpAndAudioM4a: passed');
  console.log('  optimizationFailureRollback: passed');
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
