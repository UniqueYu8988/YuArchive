import assert from 'node:assert/strict';
import {
  assertGamesPreviewSafe,
  buildGamesPreview,
} from './archive-studio-v0-games-preview-core.mjs';

const base = {
  mode: 'create', board: 'games', kind: 'normal_game', id: 'game-20260620-a1b2c3d4',
  fields: {
    title: 'Games Preview Check', year: 2026, metadata_enabled: true,
    english_title: 'Games Preview Check', url: 'https://example.com/game',
    platform: 'steam', price: '', rating: 4, playtime: '<50h', completed: true, genre: 'action',
  },
  assets: { cover: { source: 'selected-file', originalName: 'cover.webp', extension: '.webp' } },
};

const valid = buildGamesPreview(base);
assert.equal(valid.ok, true);
assert.equal(valid.operations.length, 2);
assertGamesPreviewSafe(valid);

const legacyMinimal = buildGamesPreview({
  ...base,
  fields: { title: 'Legacy Minimal', year: 2015, metadata_enabled: false },
});
assert.equal(legacyMinimal.ok, true);
assert.equal(legacyMinimal.normalized.fields.platform, '');

const missingCover = buildGamesPreview({ ...base, assets: {} });
assert(missingCover.errors.some(error => error.code === 'missing_cover'));
const invalidRating = buildGamesPreview({ ...base, fields: { ...base.fields, rating: 6 } });
assert(invalidRating.errors.some(error => error.code === 'invalid_rating'));
const invalidKind = buildGamesPreview({ ...base, kind: 'dlc' });
assert(invalidKind.errors.some(error => error.code === 'invalid_kind'));

console.log('[PASS] Archive Studio Games preview core');
console.log('  normalGameCreate: passed');
console.log('  metadataDisabledMinimal: passed');
console.log('  missingCoverBlocked: passed');
console.log('  invalidRatingBlocked: passed');
console.log('  dlcCreateBlocked: passed');
console.log('  pathSafety: passed');
console.log('  writeScope: none');
