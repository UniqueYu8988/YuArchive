import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createArchiveStudioServer } from './archive-studio-v0-server.mjs';

const validPayload = {
  mode: 'create',
  board: 'music',
  kind: 'album',
  id: 'archive-studio-api-check',
  fields: {
    title: 'Archive Studio API Check',
    date: '2026',
    url: '',
    note: '',
    legacy: {},
  },
  content: {
    markdown: 'Local API check content.',
  },
  assets: {
    cover: {
      source: 'selected-file',
      originalName: 'cover.jpg',
      extension: '.jpg',
    },
    audio: {
      source: 'selected-file',
      originalName: 'audio.mp3',
      extension: '.mp3',
    },
  },
  options: {
    allowOverwriteEntry: false,
    allowOverwriteAssets: false,
    runCheckAfterWrite: true,
    backupBeforeOverwrite: true,
  },
};

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

async function main() {
  const serverSource = await readFile(
    fileURLToPath(new URL('./archive-studio-v0-server.mjs', import.meta.url)),
    'utf8',
  );
  const forbiddenWriteMarkers = [
    'writeFile',
    'appendFile',
    'mkdir',
    'rename',
    'unlink',
    'rm(',
    'createWriteStream',
    'child_process',
    'git push',
    'build_archive.py',
  ];
  for (const marker of forbiddenWriteMarkers) {
    assert.equal(serverSource.includes(marker), false, `server contains forbidden write marker: ${marker}`);
  }

  const server = createArchiveStudioServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const profiles = await requestJson(baseUrl, '/api/studio/profiles');
    assert.equal(profiles.response.status, 200);
    assert.equal(profiles.body.writeEnabled, false);
    assert.equal(profiles.body.profiles[0].capabilities.create, false);

    const preview = await requestJson(baseUrl, '/api/studio/music/album/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.equal(preview.response.status, 200);
    assert.equal(preview.body.ok, true);
    assert.equal(preview.body.writeScope, 'none');

    const invalidPreview = await requestJson(baseUrl, '/api/studio/music/album/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        fields: { ...validPayload.fields, title: '' },
        assets: {},
      }),
    });
    assert.equal(invalidPreview.response.status, 422);
    assert.equal(invalidPreview.body.ok, false);
    assert(invalidPreview.body.errors.some((error) => error.code === 'missing_title'));
    assert(invalidPreview.body.errors.some((error) => error.code === 'missing_cover'));
    assert(invalidPreview.body.errors.some((error) => error.code === 'missing_audio'));

    const preflight = await requestJson(baseUrl, '/api/studio/music/album/preflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert([200, 409].includes(preflight.response.status));
    assert.equal(preflight.body.writeEnabled, false);
    assert.equal(preflight.body.writeScope, 'none');
    assert.equal(preflight.body.entryId, validPayload.id);

    const musicCheck = await requestJson(baseUrl, '/api/studio/checks/music-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert([200, 422].includes(musicCheck.response.status));
    assert.equal(typeof musicCheck.body.albumEntryDirs, 'number');
    assert.equal(musicCheck.body.writeScope, 'none');

    const notFound = await requestJson(baseUrl, '/api/studio/not-found');
    assert.equal(notFound.response.status, 404);
    assert.equal(notFound.body.error.code, 'not_found');

    console.log('[PASS] Archive Studio v0 read-only API check');
    console.log('  profiles: passed');
    console.log('  previewValid: passed');
    console.log('  previewInvalid: passed');
    console.log('  preflightReadOnly: passed');
    console.log('  musicV2Check: passed');
    console.log('  notFound: passed');
    console.log('  staticWriteGuard: passed');
    console.log('  writeScope: none');
  } finally {
    server.close();
    await once(server, 'close');
  }
}

await main();
