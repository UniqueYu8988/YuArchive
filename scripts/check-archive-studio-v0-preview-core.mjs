import {
  assertPreviewSafe,
  buildMusicAlbumPreview,
  normalizeRelativePath,
} from './archive-studio-v0-music-preview-core.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const basePayload = {
  mode: 'create',
  board: 'music',
  kind: 'album',
  id: 'archive-studio-self-check-album',
  fields: {
    title: 'Archive Studio Self Check Album',
    description: 'Preview core self-check payload.',
    legacy: {},
  },
  content: {
    markdown: 'Preview core self-check content.',
  },
  assets: {
    cover: {
      source: 'selected-file',
      extension: '.jpg',
    },
    audio: {
      source: 'selected-file',
      extension: '.mp3',
    },
  },
};

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function expectError(fn, messagePart, label) {
  try {
    fn();
    failures.push(`${label}: expected an error`);
  } catch (error) {
    expect(String(error.message || error).includes(messagePart), `${label}: unexpected error message`);
  }
}

function codes(items) {
  return new Set(items.map((item) => item.code));
}

const validPreview = buildMusicAlbumPreview(basePayload);
assertPreviewSafe(validPreview);
expect(validPreview.ok === true, 'valid payload should pass');
expect(validPreview.operations.length === 6, 'valid preview should contain 6 operations');
expect(validPreview.target.entryRelativeDir === 'entries/music/album/archive-studio-self-check-album', 'valid preview target should use the entry id');

const invalidIdPayload = clone(basePayload);
invalidIdPayload.id = '../outside';
const invalidIdPreview = buildMusicAlbumPreview(invalidIdPayload);
assertPreviewSafe(invalidIdPreview);
expect(invalidIdPreview.ok === false, 'invalid id payload should fail');
expect(codes(invalidIdPreview.errors).has('invalid_entry_id'), 'invalid id should report invalid_entry_id');
expect(invalidIdPreview.target.entryRelativeDir === 'entries/music/album/invalid-id', 'invalid id target should use safe placeholder');

const invalidExtensionPayload = clone(basePayload);
invalidExtensionPayload.assets.cover.extension = '.exe';
invalidExtensionPayload.assets.audio.extension = '.bat';
const invalidExtensionPreview = buildMusicAlbumPreview(invalidExtensionPayload);
expect(invalidExtensionPreview.ok === false, 'invalid extensions should fail');
expect(codes(invalidExtensionPreview.errors).has('invalid_cover_extension'), 'invalid cover extension should be reported');
expect(codes(invalidExtensionPreview.errors).has('invalid_audio_extension'), 'invalid audio extension should be reported');

const missingTitlePayload = clone(basePayload);
missingTitlePayload.fields.title = ' ';
missingTitlePayload.content.markdown = '';
const missingTitlePreview = buildMusicAlbumPreview(missingTitlePayload);
expect(missingTitlePreview.ok === false, 'missing title should fail');
expect(codes(missingTitlePreview.errors).has('missing_title'), 'missing title should be reported');
expect(codes(missingTitlePreview.warnings).has('content_empty'), 'empty content should warn');

const updateKeepExistingPayload = clone(basePayload);
updateKeepExistingPayload.mode = 'update';
updateKeepExistingPayload.assets.cover.source = 'keep-existing';
updateKeepExistingPayload.assets.audio.source = 'keep-existing';
const updateKeepExistingPreview = buildMusicAlbumPreview(updateKeepExistingPayload);
assertPreviewSafe(updateKeepExistingPreview);
const assetOperations = updateKeepExistingPreview.operations.filter((operation) => operation.type === 'copy_asset');
expect(assetOperations.every((operation) => operation.willOverwrite === false), 'keep-existing assets should not overwrite');
expect(assetOperations.every((operation) => operation.requiresBackup === false), 'keep-existing assets should not require backup');

expectError(() => normalizeRelativePath('entries', '..', 'outside'), 'Unsafe relative path', 'path traversal guard');
expectError(() => assertPreviewSafe({ operations: [{ type: 'copy_asset', relativePath: 'C:/Users/example/file.jpg' }] }), 'full Windows user path', 'absolute Windows path guard');
expectError(() => assertPreviewSafe({ operations: [{ type: 'write_yaml', relativePath: 'entry.yaml' }], secret: true }), 'sensitive field marker', 'sensitive marker guard');

if (failures.length > 0) {
  console.log('[FAIL] Archive Studio v0 preview core self-check');
  for (const failure of failures) {
    console.log(`  - ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('[PASS] Archive Studio v0 preview core self-check');
  console.log('  cases: valid payload, invalid id, invalid media extensions, missing title, keep-existing update, safety guards');
  console.log('  writeScope: none');
  console.log('Result: archive studio v0 preview core checks passed');
}
