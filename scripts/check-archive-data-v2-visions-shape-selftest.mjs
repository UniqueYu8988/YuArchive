import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { evaluateVisionsV2Shape } from './check-archive-data-v2-visions-shape.mjs';

async function writeOrdinary(v2Root, kind, id, period) {
  const root = path.join(v2Root, 'entries', 'visions', kind, id);
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'entry.yaml'), [
    `id: "${id}"`,
    'board: visions',
    `kind: ${kind}`,
    `title: "Shape ${kind}"`,
    `period: "${period}"`,
    'cinema: false',
    'quote: ""',
    'url: ""',
    'legacy: {}',
    '',
  ].join('\n'), 'utf8');
  await writeFile(path.join(root, 'poster.webp'), Buffer.from('poster'));
}

async function writeShowcase(v2Root) {
  const id = 'vision-showcase01';
  const characterId = 'character-sample01';
  const root = path.join(v2Root, 'entries', 'visions', 'showcase', id);
  const characterRoot = path.join(root, 'characters', characterId);
  await mkdir(characterRoot, { recursive: true });
  await writeFile(path.join(root, 'entry.yaml'), [
    `id: "${id}"`,
    'board: visions',
    'kind: showcase',
    'title: "Showcase"',
    'description: ""',
    `character_order: ["${characterId}"]`,
    '',
  ].join('\n'), 'utf8');
  await writeFile(path.join(characterRoot, 'character.yaml'), [
    `id: "${characterId}"`,
    'title: "Character"',
    'caption: ""',
    'order: 1',
    '',
  ].join('\n'), 'utf8');
  await writeFile(path.join(characterRoot, 'avatar.jpg'), Buffer.from('avatar'));
  await writeFile(path.join(characterRoot, 'clip.gif'), Buffer.from('clip'));
  return { root, characterRoot };
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-data-v2-visions-shape-'));
  try {
    await mkdir(path.join(tempRoot, 'config'), { recursive: true });
    await writeFile(path.join(tempRoot, 'config', 'visions-periods.yaml'), [
      '开端:',
      '  order: 1',
      '  synthetic_year: 2017',
      '前尘:',
      '  order: 2',
      '  synthetic_year: 2020',
      '旧影:',
      '  order: 3',
      '  synthetic_year: 2023',
      '未远:',
      '  order: 4',
      '  synthetic_year: 2025',
      '此岸:',
      '  order: 5',
      '  synthetic_year: 2026',
      '',
    ].join('\n'), 'utf8');
    await writeOrdinary(tempRoot, 'movie', 'vision-movie001', '开端');
    await writeOrdinary(tempRoot, 'series', 'vision-series01', '前尘');
    const showcase = await writeShowcase(tempRoot);

    const valid = evaluateVisionsV2Shape({
      v2Root: tempRoot,
      expectedMinimumEntries: 3,
      expectedMinimumKinds: { movie: 1, series: 1, showcase: 1 },
      expectedCharacters: 1,
      requireMigrationBaseline: false,
    });
    assert.equal(valid.ok, true);
    assert.equal(valid.totalEntries, 3);
    assert.equal(valid.totalCharacters, 1);

    await rm(path.join(showcase.characterRoot, 'avatar.jpg'));
    const missingAvatar = evaluateVisionsV2Shape({
      v2Root: tempRoot,
      expectedMinimumEntries: 3,
      expectedMinimumKinds: { movie: 1, series: 1, showcase: 1 },
      expectedCharacters: 1,
      requireMigrationBaseline: false,
    });
    assert.equal(missingAvatar.ok, false);
    assert.equal(missingAvatar.malformedCharacters, 1);

    await writeFile(path.join(showcase.characterRoot, 'avatar.jpg'), Buffer.from('avatar'));
    await writeFile(path.join(showcase.root, 'entry.yaml'), [
      'id: "vision-showcase01"',
      'board: visions',
      'kind: showcase',
      'title: "Showcase"',
      'description: ""',
      'character_order: ["character-missing"]',
      '',
    ].join('\n'), 'utf8');
    const invalidOrder = evaluateVisionsV2Shape({
      v2Root: tempRoot,
      expectedMinimumEntries: 3,
      expectedMinimumKinds: { movie: 1, series: 1, showcase: 1 },
      expectedCharacters: 1,
      requireMigrationBaseline: false,
    });
    assert.equal(invalidOrder.ok, false);
    assert.equal(invalidOrder.characterOrderErrors, 1);

    console.log('[PASS] Archive Visions shape self-test');
    console.log('  validShape: passed');
    console.log('  missingAvatarBlocked: passed');
    console.log('  invalidCharacterOrderBlocked: passed');
    console.log('  writeScope: system-temp-only');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
