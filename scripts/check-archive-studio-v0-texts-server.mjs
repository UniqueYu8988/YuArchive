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

const articlePayload = {
  mode: 'create',
  board: 'texts',
  kind: 'article',
  id: 'text-20260620-a1b2c3d4',
  fields: {
    title: 'Texts API Check',
    section: 'miscellany',
    date: '2026-06-20',
    author: '',
    summary: 'Summary',
    tags: ['check'],
  },
  content: { markdown: 'Texts API check content.' },
  assets: {},
};

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

function jsonOptions(payload) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function createForm(token, payload, cover = null) {
  const form = new FormData();
  form.set('payload', JSON.stringify(payload));
  form.set('preflightToken', token);
  if (cover) form.set('cover', new Blob([cover.bytes], { type: 'image/jpeg' }), cover.name);
  return form;
}

async function writeTextsConfig(v2Root) {
  await mkdir(path.join(v2Root, 'entries', 'texts'), { recursive: true });
  await mkdir(path.join(v2Root, 'config'), { recursive: true });
  await writeFile(path.join(v2Root, 'config', 'texts-sections.yaml'), [
    'book-reviews:',
    '  title: "Books"',
    '  description: ""',
    '  icon: ""',
    '  aliases: []',
    '  kind: book_note',
    '  cover_policy: required',
    'headline:',
    '  title: "Headline"',
    '  description: ""',
    '  icon: ""',
    '  aliases: []',
    '  kind: series_note',
    '  cover_policy: none',
    'bedtime-news:',
    '  title: "Bedtime"',
    '  description: ""',
    '  icon: ""',
    '  aliases: []',
    '  kind: series_note',
    '  cover_policy: none',
    'reference-info:',
    '  title: "Reference"',
    '  description: ""',
    '  icon: ""',
    '  aliases: []',
    '  kind: article',
    '  cover_policy: none',
    'miscellany:',
    '  title: "Miscellany"',
    '  description: ""',
    '  icon: ""',
    '  aliases: []',
    '  kind: article',
    '  cover_policy: none',
    '',
  ].join('\n'), 'utf8');
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-studio-texts-api-'));
  const v2Root = path.join(tempRoot, 'Archive');
  const sourceRoot = path.join(tempRoot, 'source-baseline');
  const sourceMarker = path.join(sourceRoot, 'baseline.txt');
  await writeTextsConfig(v2Root);
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(sourceMarker, 'source baseline', 'utf8');

  const server = createArchiveStudioServer({
    v2Root,
    sourceRoot,
    writeEnabled: true,
    expectedMinimumEntries: 0,
    expectedMinimumTextsEntries: 0,
    expectedMinimumTextsKinds: { article: 0, book_note: 0, series_note: 0 },
    requireMigrationBaseline: false,
    requireTextsMigrationBaseline: false,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const profiles = await requestJson(baseUrl, '/api/studio/profiles');
    const textProfiles = profiles.body.profiles.filter(profile => profile.board === 'texts');
    assert.equal(textProfiles.length, 3);
    assert(textProfiles.every(profile => profile.capabilities.create && !profile.capabilities.publish));

    const preview = await requestJson(baseUrl, '/api/studio/texts/preview', jsonOptions(articlePayload));
    assert.equal(preview.response.status, 200);
    assert.equal(preview.body.ok, true);
    assert.equal(preview.body.operations.length, 2);

    const invalidBook = await requestJson(baseUrl, '/api/studio/texts/preview', jsonOptions({
      ...articlePayload,
      kind: 'book_note',
      fields: { ...articlePayload.fields, section: 'book-reviews', date: '' },
    }));
    assert.equal(invalidBook.response.status, 422);
    assert(invalidBook.body.errors.some(error => error.code === 'missing_cover'));

    const preflight = await requestJson(baseUrl, '/api/studio/texts/preflight', jsonOptions(articlePayload));
    assert.equal(preflight.response.status, 200);
    assert.equal(preflight.body.ok, true);
    assert.equal(typeof preflight.body.preflightToken, 'string');

    const create = await requestJson(baseUrl, '/api/studio/texts/create', {
      method: 'POST',
      body: createForm(preflight.body.preflightToken, articlePayload),
    });
    assert.equal(create.response.status, 201, JSON.stringify(create.body));
    assert.equal(create.body.ok, true);
    assert.equal(create.body.textsEntries, 1);
    assert.equal(create.body.sourceUnchanged, true);
    assert.equal(create.body.publishTriggered, false);
    assert.equal(create.body.check.ok, true);

    const createdRoot = path.join(v2Root, 'entries', 'texts', 'article', articlePayload.id);
    assert.equal((await readFile(path.join(createdRoot, 'content.md'), 'utf8')).trim(), articlePayload.content.markdown);
    assert.equal(await readFile(sourceMarker, 'utf8'), 'source baseline');
    const transactionsRoot = path.join(v2Root, 'migration', 'archive-studio-v0', 'transactions');
    const transactions = await readdir(transactionsRoot, { withFileTypes: true });
    assert.equal(transactions.filter(entry => entry.isDirectory()).length, 1);

    const replay = await requestJson(baseUrl, '/api/studio/texts/create', {
      method: 'POST',
      body: createForm(preflight.body.preflightToken, articlePayload),
    });
    assert.equal(replay.response.status, 403);
    assert.equal(replay.body.error.code, 'preflight_token_invalid');

    const conflict = await requestJson(baseUrl, '/api/studio/texts/preflight', jsonOptions(articlePayload));
    assert.equal(conflict.response.status, 409);
    assert(conflict.body.blockedReasons.includes('create_target_exists'));

    await rm(transactionsRoot, { recursive: true, force: true });
    await mkdir(path.dirname(transactionsRoot), { recursive: true });
    await writeFile(transactionsRoot, 'intentional conflict', 'utf8');
    const failurePayload = { ...articlePayload, id: 'text-20260620-deadbeef' };
    const failurePreflight = await requestJson(baseUrl, '/api/studio/texts/preflight', jsonOptions(failurePayload));
    assert.equal(failurePreflight.response.status, 200);
    const failedCreate = await requestJson(baseUrl, '/api/studio/texts/create', {
      method: 'POST',
      body: createForm(failurePreflight.body.preflightToken, failurePayload),
    });
    assert.equal(failedCreate.response.status, 500);
    assert.equal(failedCreate.body.error.code, 'texts_create_transaction_failed');
    assert.equal(failedCreate.body.error.stage, 'manifest-write');
    assert.equal(failedCreate.body.error.rollback.completed, true);
    await assert.rejects(readFile(path.join(v2Root, 'entries', 'texts', 'article', failurePayload.id, 'entry.yaml')));

    const check = await requestJson(baseUrl, '/api/studio/checks/texts-v2', jsonOptions({}));
    assert.equal(check.response.status, 200);
    assert.equal(check.body.totalEntries, 1);
    assert.equal(check.body.malformedEntries, 0);

    const publish = await requestJson(baseUrl, '/api/studio/publish');
    assert.equal(publish.response.status, 404);
    console.log('[PASS] Archive Studio Texts API check');
    console.log('  profiles: passed');
    console.log('  preview: passed');
    console.log('  invalidBookCoverBlocked: passed');
    console.log('  preflightToken: passed');
    console.log('  articleCreate: passed');
    console.log('  tokenReplayBlocked: passed');
    console.log('  createConflictBlocked: passed');
    console.log('  failedCreateRollback: passed');
    console.log('  textsV2Check: passed');
    console.log('  sourceUnchanged: passed');
    console.log('  publishRouteAbsent: passed');
  } finally {
    server.close();
    await once(server, 'close');
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
