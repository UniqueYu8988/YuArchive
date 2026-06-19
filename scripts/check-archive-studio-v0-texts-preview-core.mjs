import assert from 'node:assert/strict';
import {
  assertTextsPreviewSafe,
  buildTextsPreview,
} from './archive-studio-v0-texts-preview-core.mjs';

function payload(overrides = {}) {
  return {
    mode: 'create',
    board: 'texts',
    kind: 'article',
    id: 'text-20260620-a1b2c3d4',
    fields: {
      title: 'Preview Check',
      section: 'miscellany',
      date: '2026-06-20',
      author: '',
      summary: 'Summary',
      tags: ['check'],
    },
    content: { markdown: 'Preview content.' },
    assets: {},
    ...overrides,
  };
}

const article = buildTextsPreview(payload());
assert.equal(article.ok, true);
assert.equal(article.operations.length, 2);
assertTextsPreviewSafe(article);

const book = buildTextsPreview(payload({
  kind: 'book_note',
  fields: {
    title: 'Book Check',
    section: 'book-reviews',
    date: '',
    author: 'Author',
    summary: 'Summary',
    tags: [],
  },
  assets: {
    cover: {
      source: 'selected-file',
      originalName: 'cover.jpg',
      extension: '.jpg',
    },
  },
}));
assert.equal(book.ok, true);
assert.equal(book.operations.length, 3);
assertTextsPreviewSafe(book);

const series = buildTextsPreview(payload({
  kind: 'series_note',
  fields: {
    title: 'Series Check',
    section: 'headline',
    date: '2026-06-20',
    author: '',
    summary: '',
    tags: ['one', 'one', ''],
  },
}));
assert.equal(series.ok, true);
assert.equal(series.normalized.fields.tags.length, 1);

const invalid = buildTextsPreview(payload({
  id: '../unsafe',
  kind: 'book_note',
  fields: {
    title: '',
    section: 'headline',
    date: 'bad-date',
    tags: [],
  },
  content: { markdown: '' },
  assets: {},
}));
assert.equal(invalid.ok, false);
for (const code of [
  'invalid_entry_id',
  'missing_title',
  'missing_content',
  'section_kind_mismatch',
  'invalid_optional_date',
  'missing_cover',
]) assert(invalid.errors.some(error => error.code === code));
assertTextsPreviewSafe(invalid);

console.log('[PASS] Archive Studio Texts preview core');
console.log('  articleCreate: passed');
console.log('  bookNoteCreate: passed');
console.log('  seriesNoteCreate: passed');
console.log('  invalidPayloadBlocked: passed');
console.log('  pathSafety: passed');
console.log('  writeScope: none');

