import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';

const ids = {
  normal: 'game-111111111111',
  dlc: 'game-222222222222',
  live: 'game-333333333333',
  season: 'season-444444444444',
};

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function entryYaml({ id, kind, title, year = '', metadataEnabled = true, parentId = '' }) {
  return [
    `id: ${id}`,
    'board: games',
    `kind: ${kind}`,
    `title: "${title}"`,
    ...(year === '' ? [] : [`year: ${year}`]),
    `metadata_enabled: ${metadataEnabled}`,
    ...(parentId ? [`parent_id: ${parentId}`, 'parent_title: "Parent"'] : []),
    '',
  ].join('\n');
}

function createFixture(root) {
  const games = path.join(root, 'entries', 'games');
  const normal = path.join(games, 'normal_game', ids.normal);
  const dlc = path.join(games, 'dlc', ids.dlc);
  const live = path.join(games, 'live_game', ids.live);
  const season = path.join(live, 'seasons', ids.season);
  write(path.join(normal, 'entry.yaml'), entryYaml({ id: ids.normal, kind: 'normal_game', title: 'Normal', year: 2020, metadataEnabled: false }));
  write(path.join(normal, 'cover.webp'), 'cover');
  write(path.join(dlc, 'entry.yaml'), entryYaml({ id: ids.dlc, kind: 'dlc', title: 'DLC', year: 2024, parentId: ids.normal }));
  write(path.join(dlc, 'cover.png'), 'cover');
  write(path.join(live, 'entry.yaml'), entryYaml({ id: ids.live, kind: 'live_game', title: 'Live' }));
  write(path.join(live, 'cover.jpg'), 'cover');
  write(path.join(season, 'season.yaml'), [
    `id: ${ids.season}`,
    'title: "Season"',
    'label: "Season"',
    'order: 1',
    '',
  ].join('\n'));
  write(path.join(season, 'cover.webp'), 'cover');
  write(path.join(root, 'config', 'games.yaml'), 'season_target_year: 2026\nseason_priority:\n  - game-333333333333\n');
}

function evaluate(root) {
  return evaluateGamesV2Shape({
    v2Root: root,
    expectedMinimumEntries: 3,
    expectedMinimumKinds: { normal_game: 1, dlc: 1, live_game: 1 },
    expectedSeasons: 1,
    expectedMinimumMetadataDisabled: 1,
    expectedLiveParentCovers: 1,
    requireMigrationBaseline: false,
  });
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-data-v2-games-shape-'));
try {
  createFixture(tempRoot);
  assert.equal(evaluate(tempRoot).ok, true);

  const normalCover = path.join(tempRoot, 'entries', 'games', 'normal_game', ids.normal, 'cover.webp');
  fs.rmSync(normalCover);
  assert.equal(evaluate(tempRoot).ok, false);
  write(normalCover, 'cover');

  const dlcYaml = path.join(tempRoot, 'entries', 'games', 'dlc', ids.dlc, 'entry.yaml');
  write(dlcYaml, entryYaml({ id: ids.dlc, kind: 'dlc', title: 'DLC', year: 2024, parentId: 'game-aaaaaaaaaaaa' }));
  assert.equal(evaluate(tempRoot).invalidParentReferences, 1);
  write(dlcYaml, entryYaml({ id: ids.dlc, kind: 'dlc', title: 'DLC', year: 2024, parentId: ids.normal }));

  const seasonCover = path.join(tempRoot, 'entries', 'games', 'live_game', ids.live, 'seasons', ids.season, 'cover.webp');
  fs.rmSync(seasonCover);
  assert.equal(evaluate(tempRoot).malformedSeasons, 1);
  write(seasonCover, 'cover');

  const normalYaml = path.join(tempRoot, 'entries', 'games', 'normal_game', ids.normal, 'entry.yaml');
  fs.appendFileSync(normalYaml, 'note: "C:/Users/local/private"\n');
  assert.equal(evaluate(tempRoot).privacyRuleHits > 0, true);

  console.log('[PASS] ArchiveData-v2 Games shape self-test');
  console.log('  validFixture: passed');
  console.log('  missingCoverBlocked: passed');
  console.log('  invalidDlcParentBlocked: passed');
  console.log('  missingSeasonCoverBlocked: passed');
  console.log('  privatePathBlocked: passed');
  console.log('  realArchiveDataV2Written: false');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
