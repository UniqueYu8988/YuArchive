import assert from 'node:assert/strict';
import {
  assertVisionsPreviewSafe,
  buildVisionsPreview,
} from './archive-studio-v0-visions-preview-core.mjs';

const base = {
  mode: 'create',
  board: 'visions',
  kind: 'movie',
  id: 'vision-20260620-a1b2c3d4',
  fields: {
    title: 'Visions Preview Check',
    period: '此岸',
    cinema: true,
    quote: 'Preview only.',
    url: 'https://example.com/vision',
  },
  assets: {
    poster: {
      source: 'selected-file',
      originalName: 'poster.webp',
      extension: '.webp',
    },
  },
};

for (const kind of ['movie', 'series']) {
  const preview = buildVisionsPreview({ ...base, kind });
  assert.equal(preview.ok, true);
  assert.equal(preview.operations.length, 2);
  assertVisionsPreviewSafe(preview);
}

const missingPoster = buildVisionsPreview({ ...base, assets: {} });
assert.equal(missingPoster.ok, false);
assert(missingPoster.errors.some(error => error.code === 'missing_poster'));

const invalidPeriod = buildVisionsPreview({
  ...base,
  fields: { ...base.fields, period: 'unknown' },
});
assert.equal(invalidPeriod.ok, false);
assert(invalidPeriod.errors.some(error => error.code === 'invalid_period'));

console.log('[PASS] Archive Studio Visions preview core');
console.log('  movieCreate: passed');
console.log('  seriesCreate: passed');
console.log('  missingPosterBlocked: passed');
console.log('  invalidPeriodBlocked: passed');
console.log('  pathSafety: passed');
console.log('  writeScope: none');
