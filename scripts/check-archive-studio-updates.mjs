import assert from 'node:assert/strict';
import { once } from 'node:events';
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
  return target;
}

function writeJson(root, relativePath, value) {
  return write(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  return { status: response.status, body: await response.json() };
}

function postJson(value) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  };
}

function updateForm(payload, token, assets = {}) {
  const form = new FormData();
  form.set('payload', JSON.stringify(payload));
  form.set('updateToken', token);
  for (const [role, file] of Object.entries(assets)) {
    form.set(role, new Blob([file.bytes], { type: file.type }), file.name);
  }
  return { method: 'POST', body: form };
}

function boardPublicItem(board, title) {
  if (board === 'music') {
    return {
      id: 'public-music-1', title, cover: 'legacy/music-cover.jpg', audio: 'legacy/music-audio.mp3',
      description: 'Before', content: 'Before content', url: '', track_title: '',
    };
  }
  if (board === 'texts') {
    return {
      id: 'public-text-1', title, date: '2026-06-21', sort_date: '2026-06-21',
      section: 'reference-info', section_title: 'Reference', cover: '', author: '',
      summary: 'Before', excerpt: 'Before content', tags: ['check'], content: 'Before content',
    };
  }
  if (board === 'visions') {
    return {
      id: 'public-vision-1', title, image_path: 'legacy/vision-poster.jpg',
      cinema: false, quote: '', url: '', type: 'movie',
    };
  }
  return {
    id: 'public-game-1', title, image_path: 'legacy/game-cover.jpg',
    cinema: false, quote: '', url: '', type: 'game', game_meta_enabled: false,
    english_title: '', platform: 'steam', price: '', rating: '', playtime: '',
    completed: false, genre: '', seasonal: false, dlc: false, dlc_parent: '',
    summary: '', hover_note: '', season_heading: '', season_subheading: '',
    season_description: '', season_entries: [],
  };
}

function setupFixture(sandbox) {
  const projectRoot = path.join(sandbox, 'project');
  const v2Root = path.join(sandbox, 'Archive');
  const sourceRoot = path.join(sandbox, 'source-baseline');
  fs.mkdirSync(sourceRoot, { recursive: true });
  write(sourceRoot, 'baseline.txt', 'source baseline');

  const sectionConfig = [
    ['headline', 'series_note'],
    ['bedtime-news', 'series_note'],
    ['book-reviews', 'book_note'],
    ['reference-info', 'article'],
    ['miscellany', 'article'],
  ].map(([key, kind]) => (
    `${key}:\n  title: "${key}"\n  description: ""\n  icon: ""\n  aliases: []\n  kind: ${kind}\n  cover_policy: none\n`
  )).join('');
  write(v2Root, 'config/texts-sections.yaml', sectionConfig);
  write(v2Root, 'config/visions-periods.yaml', [
    '开端:\n  order: 1\n  synthetic_year: 2017',
    '前尘:\n  order: 2\n  synthetic_year: 2020',
    '旧影:\n  order: 3\n  synthetic_year: 2023',
    '未远:\n  order: 4\n  synthetic_year: 2025',
    '此岸:\n  order: 5\n  synthetic_year: 2026',
  ].join('\n'));
  write(v2Root, 'config/games.yaml', 'season_target_year: 2026\nseason_priority: ""\n');

  write(v2Root, 'entries/music/album/music-check/entry.yaml',
    'id: "music-check"\nboard: music\nkind: album\ntitle: "Music Before"\ndate: "2026"\nnote: "Before"\nlegacy:\n  source_label: "fixture"\n');
  write(v2Root, 'entries/music/album/music-check/content.md', 'Before content\n');
  write(v2Root, 'entries/music/album/music-check/cover.png', IMAGE_BYTES);
  write(v2Root, 'entries/music/album/music-check/audio.wav', wavBytes());

  write(v2Root, 'entries/texts/article/text-check/entry.yaml',
    'id: "text-check"\nboard: texts\nkind: article\ntitle: "Text Before"\nsection: reference-info\ndate: "2026-06-21"\nsummary: "Before"\ntags: ["check"]\nlegacy:\n  source_label: "fixture"\n');
  write(v2Root, 'entries/texts/article/text-check/content.md', 'Before content\n');

  write(v2Root, 'entries/visions/movie/vision-check/entry.yaml',
    'id: "vision-check"\nboard: visions\nkind: movie\ntitle: "Vision Before"\nperiod: "此岸"\ncinema: false\nquote: ""\nurl: ""\nlegacy:\n  source_label: "fixture"\n');
  write(v2Root, 'entries/visions/movie/vision-check/poster.png', IMAGE_BYTES);

  write(v2Root, 'entries/games/normal_game/game-20260621-a1b2c3d4/entry.yaml',
    'id: game-20260621-a1b2c3d4\nboard: games\nkind: normal_game\ntitle: "Game Before"\nyear: 2026\nmetadata_enabled: false\nlegacy:\n  source_label: "fixture"\n');
  write(v2Root, 'entries/games/normal_game/game-20260621-a1b2c3d4/cover.png', IMAGE_BYTES);

  writeJson(projectRoot, 'public/data/music.json', {
    key: 'music', display_name: 'Music', total_count: 1, sort_mode: 'music',
    items: [boardPublicItem('music', 'Music Before')],
  });
  writeJson(projectRoot, 'public/data/texts.json', {
    key: 'texts', display_name: 'Texts', total_count: 1, sort_mode: 'text',
    sections: [{ key: 'reference-info', title: 'Reference', description: '', icon: '', showcase_images: [], count: 1 }],
    items: [boardPublicItem('texts', 'Text Before')],
  });
  writeJson(projectRoot, 'public/data/visions.json', {
    key: 'visions', display_name: 'Visions', total_count: 1, sort_mode: 'timeline',
    years: [{ year: 2026, folder: '此岸', items: [boardPublicItem('visions', 'Vision Before')] }],
    showcase: { title: '', description: '', entries: [] },
  });
  writeJson(projectRoot, 'public/data/games.json', {
    key: 'games', display_name: 'Games', total_count: 1, sort_mode: 'timeline',
    years: [{ year: 2026, folder: '2026', items: [boardPublicItem('games', 'Game Before')] }],
  });

  return { projectRoot, v2Root, sourceRoot };
}

function payloadFor(board, detail) {
  return {
    mode: 'update',
    board,
    kind: detail.kind,
    id: detail.id,
    fields: { ...detail.fields, title: `${detail.fields.title} Updated` },
    content: {
      markdown: ['music', 'texts'].includes(board) ? `${detail.content.trim()} updated\n` : '',
    },
    assets: Object.fromEntries(
      Object.keys(detail.assets).map(role => [role, { source: 'keep-existing' }]),
    ),
  };
}

function findPublicItem(board, publicData) {
  if (board === 'music' || board === 'texts') return publicData.items[0];
  return publicData.years.flatMap(group => group.items)[0];
}

async function main() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'yuarchive-updates-'));
  const { projectRoot, v2Root, sourceRoot } = setupFixture(sandbox);
  const server = createArchiveStudioServer({
    v2Root, sourceRoot, projectRoot, writeEnabled: true,
    requireMigrationBaseline: false,
    requireTextsMigrationBaseline: false,
    requireVisionsMigrationBaseline: false,
    requireGamesMigrationBaseline: false,
  });
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const ids = {
      music: 'music-check',
      texts: 'text-check',
      visions: 'vision-check',
      games: 'game-20260621-a1b2c3d4',
    };

    for (const [board, id] of Object.entries(ids)) {
      const list = await requestJson(baseUrl, `/api/studio/${board}/entries`);
      assert.equal(list.status, 200);
      assert.equal(list.body.entries.length, 1);
      assert.equal(list.body.entries[0].synced, true);

      const detail = await requestJson(baseUrl, `/api/studio/${board}/entries/${id}`);
      assert.equal(detail.status, 200);
      assert.equal(detail.body.publiclySynced, true);
      const payload = payloadFor(board, detail.body);

      const preview = await requestJson(baseUrl, `/api/studio/${board}/update-preview`, postJson(payload));
      assert.equal(preview.status, 200);
      assert.deepEqual(preview.body.summary.fieldsChanged, ['title']);
      assert.equal(preview.body.summary.contentChanged, ['music', 'texts'].includes(board));
      assert.equal(preview.body.summary.replacedAssets.length, 0);

      const preflight = await requestJson(baseUrl, `/api/studio/${board}/update-preflight`, postJson(payload));
      assert.equal(preflight.status, 200);
      assert.equal(typeof preflight.body.updateToken, 'string');

      const applied = await requestJson(
        baseUrl,
        `/api/studio/${board}/update-apply`,
        updateForm(payload, preflight.body.updateToken),
      );
      assert.equal(applied.status, 200, JSON.stringify(applied.body));
      assert.equal(applied.body.sourceUnchanged, true);
      assert.equal(applied.body.publishTriggered, false);
      assert.equal(applied.body.check.ok, true);

      const replay = await requestJson(
        baseUrl,
        `/api/studio/${board}/update-apply`,
        updateForm(payload, preflight.body.updateToken),
      );
      assert.equal(replay.status, 403);

      const syncPreview = await requestJson(baseUrl, `/api/studio/${board}/sync-preview`, postJson({}));
      assert.equal(syncPreview.status, 200);
      assert.equal(syncPreview.body.pendingUpdates, 1);
      assert.equal(syncPreview.body.pendingCreates, 0);
      const syncApply = await requestJson(
        baseUrl,
        `/api/studio/${board}/sync-apply`,
        postJson({ syncToken: syncPreview.body.syncToken }),
      );
      assert.equal(syncApply.status, 200, JSON.stringify(syncApply.body));
      const publicData = JSON.parse(fs.readFileSync(path.join(projectRoot, 'public', 'data', `${board}.json`), 'utf8'));
      const publicItem = findPublicItem(board, publicData);
      assert.equal(publicItem.id, `public-${board === 'texts' ? 'text' : board === 'visions' ? 'vision' : board === 'games' ? 'game' : 'music'}-1`);
      assert.match(publicItem.title, /Updated$/);
      assert.equal(publicData.total_count, 1);
    }

    const replaceDetail = await requestJson(baseUrl, '/api/studio/music/entries/music-check');
    const replacePayload = payloadFor('music', replaceDetail.body);
    replacePayload.fields.title = replaceDetail.body.fields.title;
    replacePayload.content.markdown = replaceDetail.body.content;
    replacePayload.assets.cover = {
      source: 'selected-file',
      originalName: 'replacement.png',
      extension: '.png',
    };
    const replacePreflight = await requestJson(
      baseUrl,
      '/api/studio/music/update-preflight',
      postJson(replacePayload),
    );
    assert.equal(replacePreflight.status, 200);
    const replaced = await requestJson(
      baseUrl,
      '/api/studio/music/update-apply',
      updateForm(replacePayload, replacePreflight.body.updateToken, {
        cover: { bytes: IMAGE_BYTES, type: 'image/png', name: 'replacement.png' },
      }),
    );
    assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
    assert.deepEqual(replaced.body.replacedAssets, ['cover']);
    const musicRoot = path.join(v2Root, 'entries', 'music', 'album', 'music-check');
    assert.equal(fs.existsSync(path.join(musicRoot, 'cover.png')), true);
    assert.equal(fs.existsSync(path.join(musicRoot, 'audio.wav')), true);
    const replaceSyncPreview = await requestJson(baseUrl, '/api/studio/music/sync-preview', postJson({}));
    assert.equal(replaceSyncPreview.status, 200);
    assert.equal(replaceSyncPreview.body.pendingUpdates, 1);
    assert.equal(replaceSyncPreview.body.mediaFiles, 1);
    const replaceSync = await requestJson(
      baseUrl,
      '/api/studio/music/sync-apply',
      postJson({ syncToken: replaceSyncPreview.body.syncToken }),
    );
    assert.equal(replaceSync.status, 200, JSON.stringify(replaceSync.body));
    const replacedPublic = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'public', 'data', 'music.json'), 'utf8'),
    ).items[0];
    assert.match(replacedPublic.cover, /^studio_media\/music\/music-check\/cover\.webp$/);
    assert.equal(replacedPublic.audio, 'legacy/music-audio.mp3');

    const musicDetail = await requestJson(baseUrl, '/api/studio/music/entries/music-check');
    const rollbackPayload = payloadFor('music', musicDetail.body);
    rollbackPayload.fields.title = 'Title That Must Roll Back';
    const rollbackPreflight = await requestJson(
      baseUrl,
      '/api/studio/music/update-preflight',
      postJson(rollbackPayload),
    );
    assert.equal(rollbackPreflight.status, 200);
    const beforeYaml = fs.readFileSync(
      path.join(v2Root, 'entries', 'music', 'album', 'music-check', 'entry.yaml'),
      'utf8',
    );
    const pendingMusicRoot = path.join(v2Root, 'migration', 'archive-studio-v0', 'pending-public', 'music');
    fs.rmSync(pendingMusicRoot, { recursive: true, force: true });
    write(v2Root, 'migration/archive-studio-v0/pending-public/music', 'intentional conflict');
    const rollback = await requestJson(
      baseUrl,
      '/api/studio/music/update-apply',
      updateForm(rollbackPayload, rollbackPreflight.body.updateToken),
    );
    assert.equal(rollback.status, 500);
    assert.equal(rollback.body.error.rollback.completed, true);
    const afterYaml = fs.readFileSync(
      path.join(v2Root, 'entries', 'music', 'album', 'music-check', 'entry.yaml'),
      'utf8',
    );
    assert.equal(afterYaml, beforeYaml);

    console.log('[PASS] Archive Studio lightweight updates');
    console.log('  boards: 4');
    console.log('  list/detail/preview/preflight/apply: passed');
    console.log('  stablePublicIdSync: passed');
    console.log('  replaceOneAssetKeepOthers: passed');
    console.log('  tokenReplayBlocked: passed');
    console.log('  failedUpdateRollback: passed');
    console.log('  sourceUnchanged: passed');
    console.log('  writeScope: system-temp only');
  } catch (error) {
    console.log('[FAIL] Archive Studio lightweight updates');
    console.log(`  error: ${error instanceof Error ? error.message : 'unknown_error'}`);
    process.exitCode = 1;
  } finally {
    server.close();
    await once(server, 'close');
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

await main();
