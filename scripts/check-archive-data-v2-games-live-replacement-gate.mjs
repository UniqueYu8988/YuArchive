import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateGamesLiveCompatiblePreview } from './generate-archive-data-v2-games-live-compatible-preview.mjs';

const GAMES_JSON = path.resolve('public', 'data', 'games.json');
const HOME_JSON = path.resolve('public', 'data', 'home.json');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function evaluateGamesLiveReplacementGate() {
  const gamesBefore = sha256(GAMES_JSON);
  const homeBefore = sha256(HOME_JSON);
  const currentGames = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));
  const currentHome = JSON.parse(fs.readFileSync(HOME_JSON, 'utf8'));
  const preview = generateGamesLiveCompatiblePreview();
  const semanticGamesEqual = stableJson(currentGames) === stableJson(preview.preview);
  const previewById = new Map(preview.preview.years.flatMap(group => group.items).map(item => [item.id, item]));
  const semanticHomeGamesEqual = (currentHome.latestGames || []).every(item => (
    previewById.has(item.id) && stableJson(item) === stableJson(previewById.get(item.id))
  ));
  const gamesAfter = sha256(GAMES_JSON);
  const homeAfter = sha256(HOME_JSON);
  const zeroDiffGate = (
    preview.ok
    && preview.requiredMissing === 0
    && preview.itemFieldDifferences === 0
    && preview.yearOrderDifferences === 0
    && preview.itemOrderDifferences === 0
    && preview.mediaPathDifferences === 0
    && preview.homeMissingMappings === 0
    && preview.homeFieldDifferences === 0
    && preview.privacyRuleHits === 0
    && semanticGamesEqual
    && semanticHomeGamesEqual
  );
  return {
    ok: zeroDiffGate && gamesBefore === gamesAfter && homeBefore === homeAfter,
    gateState: zeroDiffGate ? 'already-current' : 'blocked-review-required',
    semanticGamesEqual,
    semanticHomeGamesEqual,
    gamesFileUnchanged: gamesBefore === gamesAfter,
    homeFileUnchanged: homeBefore === homeAfter,
    previewItems: preview.previewItems,
    seasonMappings: preview.seasonMappings,
    requiredMissing: preview.requiredMissing,
    itemFieldDifferences: preview.itemFieldDifferences,
    orderDifferences: preview.yearOrderDifferences + preview.itemOrderDifferences,
    mediaPathDifferences: preview.mediaPathDifferences,
    homeFieldDifferences: preview.homeFieldDifferences,
    privacyRuleHits: preview.privacyRuleHits,
    allowedToWrite: false,
    writeScope: 'none',
    publicJsonModified: false,
    buildArchiveRun: false,
    publishRun: false,
  };
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Archive Games live replacement gate`);
  for (const [key, value] of Object.entries(result)) {
    if (key === 'ok') continue;
    console.log(`  ${key}: ${value}`);
  }
  console.log(`Result: Games live replacement gate ${result.ok ? 'passed' : 'blocked'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluateGamesLiveReplacementGate();
  printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}
