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

const coverBytes = Buffer.from('archive-studio-cover-check');
const audioBytes = Buffer.from('archive-studio-audio-check');

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

function buildCreateForm(token, payload = validPayload) {
  const form = new FormData();
  form.set('payload', JSON.stringify(payload));
  form.set('preflightToken', token);
  form.set('cover', new Blob([coverBytes], { type: 'image/jpeg' }), payload.assets.cover.originalName);
  form.set('audio', new Blob([audioBytes], { type: 'audio/mpeg' }), payload.assets.audio.originalName);
  return form;
}

async function main() {
  const serverSource = await readFile(
    fileURLToPath(new URL('./archive-studio-v0-server.mjs', import.meta.url)),
    'utf8',
  );
  for (const marker of ['child_process', 'git push', 'build_archive.py', '一键发布到云端']) {
    assert.equal(serverSource.includes(marker), false, `server contains forbidden command marker: ${marker}`);
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-studio-v0-api-check-'));
  const v2Root = path.join(tempRoot, 'ArchiveData-v2');
  const sourceRoot = path.join(tempRoot, 'source-read-only-baseline');
  const entryRoot = path.join(v2Root, 'entries', 'music', 'album');
  const sourceMarker = path.join(sourceRoot, 'baseline.txt');
  await mkdir(entryRoot, { recursive: true });
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(sourceMarker, 'source baseline', 'utf8');

  const server = createArchiveStudioServer({
    v2Root,
    sourceRoot,
    writeEnabled: true,
    expectedMinimumEntries: 0,
    requireMigrationBaseline: false,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const profiles = await requestJson(baseUrl, '/api/studio/profiles');
    assert.equal(profiles.response.status, 200);
    assert.equal(profiles.body.writeEnabled, true);
    assert.equal(profiles.body.profiles[0].capabilities.create, true);
    assert.equal(profiles.body.profiles[0].capabilities.publish, false);

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
    assert.equal(preflight.response.status, 200);
    assert.equal(preflight.body.ok, true);
    assert.equal(preflight.body.writeEnabled, true);
    assert.equal(typeof preflight.body.preflightToken, 'string');
    assert(preflight.body.preflightToken.length > 0);

    const create = await requestJson(baseUrl, '/api/studio/music/album/create', {
      method: 'POST',
      body: buildCreateForm(preflight.body.preflightToken),
    });
    assert.equal(create.response.status, 201);
    assert.equal(create.body.ok, true);
    assert.equal(create.body.sourceUnchanged, true);
    assert.equal(create.body.publishTriggered, false);
    assert.equal(create.body.check.ok, true);
    assert.equal(create.body.musicEntries, 1);

    const createdRoot = path.join(entryRoot, validPayload.id);
    assert.equal(await readFile(path.join(createdRoot, 'content.md'), 'utf8'), validPayload.content.markdown);
    assert.deepEqual(await readFile(path.join(createdRoot, 'cover.jpg')), coverBytes);
    assert.deepEqual(await readFile(path.join(createdRoot, 'audio.mp3')), audioBytes);
    assert.equal(await readFile(sourceMarker, 'utf8'), 'source baseline');

    const transactionRoot = path.join(v2Root, 'migration', 'archive-studio-v0', 'transactions');
    const transactions = await readdir(transactionRoot, { withFileTypes: true });
    assert.equal(transactions.filter((entry) => entry.isDirectory()).length, 1);
    const transactionFiles = await readdir(path.join(transactionRoot, transactions[0].name));
    assert.deepEqual(transactionFiles.sort(), ['preview.json', 'rollback.json', 'write.json']);

    const replay = await requestJson(baseUrl, '/api/studio/music/album/create', {
      method: 'POST',
      body: buildCreateForm(preflight.body.preflightToken),
    });
    assert.equal(replay.response.status, 403);
    assert.equal(replay.body.error.code, 'preflight_token_invalid');

    const conflict = await requestJson(baseUrl, '/api/studio/music/album/preflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.body.ok, false);
    assert(conflict.body.blockedReasons.includes('create_target_exists'));

    await rm(transactionRoot, { recursive: true, force: true });
    await mkdir(path.dirname(transactionRoot), { recursive: true });
    await writeFile(transactionRoot, 'intentional manifest-path conflict', 'utf8');
    const failurePayload = {
      ...validPayload,
      id: 'archive-studio-api-rollback-check',
    };
    const failurePreflight = await requestJson(baseUrl, '/api/studio/music/album/preflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(failurePayload),
    });
    assert.equal(failurePreflight.response.status, 200);
    const failedCreate = await requestJson(baseUrl, '/api/studio/music/album/create', {
      method: 'POST',
      body: buildCreateForm(failurePreflight.body.preflightToken, failurePayload),
    });
    assert.equal(failedCreate.response.status, 500);
    assert.equal(failedCreate.body.error.code, 'create_transaction_failed');
    assert.equal(failedCreate.body.error.stage, 'manifest-write');
    assert.equal(failedCreate.body.error.rollback.completed, true);
    await assert.rejects(readFile(path.join(entryRoot, failurePayload.id, 'entry.yaml')));
    assert.equal(await readFile(sourceMarker, 'utf8'), 'source baseline');

    const musicCheck = await requestJson(baseUrl, '/api/studio/checks/music-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(musicCheck.response.status, 200);
    assert.equal(musicCheck.body.albumEntryDirs, 1);
    assert.equal(musicCheck.body.writeScope, 'none');

    const publish = await requestJson(baseUrl, '/api/studio/publish');
    assert.equal(publish.response.status, 404);
    assert.equal(publish.body.error.code, 'not_found');

    console.log('[PASS] Archive Studio v0 create API check');
    console.log('  profiles: passed');
    console.log('  preview: passed');
    console.log('  preflightToken: passed');
    console.log('  multipartCreate: passed');
    console.log('  sourceUnchanged: passed');
    console.log('  transactionManifest: passed');
    console.log('  tokenReplayBlocked: passed');
    console.log('  createConflictBlocked: passed');
    console.log('  failedCreateRollback: passed');
    console.log('  musicV2Check: passed');
    console.log('  publishRouteAbsent: passed');
  } finally {
    server.close();
    await once(server, 'close');
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
