import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { evaluateTextsV2Shape } from './check-archive-data-v2-texts-shape.mjs';

const sections = {
  article: 'miscellany',
  book_note: 'book-reviews',
  series_note: 'headline',
};

async function writeEntry(v2Root, kind, id) {
  const root = path.join(v2Root, 'entries', 'texts', kind, id);
  await mkdir(root, { recursive: true });
  const date = kind === 'book_note' ? '' : '2026-06-20';
  await writeFile(path.join(root, 'entry.yaml'), [
    `id: "${id}"`,
    'board: texts',
    `kind: ${kind}`,
    `title: "Shape ${kind}"`,
    `section: ${sections[kind]}`,
    ...(date ? [`date: "${date}"`] : []),
    'tags: []',
    'legacy: {}',
    '',
  ].join('\n'), 'utf8');
  await writeFile(path.join(root, 'content.md'), 'Shape check content.\n', 'utf8');
  if (kind === 'book_note') await writeFile(path.join(root, 'cover.jpg'), Buffer.from('cover'));
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-data-v2-texts-shape-'));
  try {
    await mkdir(path.join(tempRoot, 'config'), { recursive: true });
    await writeFile(path.join(tempRoot, 'config', 'texts-sections.yaml'), [
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
    await writeEntry(tempRoot, 'article', 'text-article001');
    await writeEntry(tempRoot, 'book_note', 'text-booknote01');
    await writeEntry(tempRoot, 'series_note', 'text-series001');

    const valid = evaluateTextsV2Shape({
      v2Root: tempRoot,
      expectedMinimumEntries: 3,
      expectedMinimumKinds: { article: 1, book_note: 1, series_note: 1 },
      requireMigrationBaseline: false,
    });
    assert.equal(valid.ok, true);
    assert.equal(valid.totalEntries, 3);
    assert.equal(valid.coverFiles, 1);

    await rm(path.join(tempRoot, 'entries', 'texts', 'book_note', 'text-booknote01', 'cover.jpg'));
    const invalid = evaluateTextsV2Shape({
      v2Root: tempRoot,
      expectedMinimumEntries: 3,
      expectedMinimumKinds: { article: 1, book_note: 1, series_note: 1 },
      requireMigrationBaseline: false,
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.malformedEntries, 1);

    console.log('[PASS] Archive Texts shape self-test');
    console.log('  validShape: passed');
    console.log('  missingBookCoverBlocked: passed');
    console.log('  writeScope: system-temp-only');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();

