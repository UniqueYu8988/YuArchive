import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  GAMES_SOURCE_ROOT,
  MIGRATED_GAME_ID_PATTERN,
  SEASON_ID_PATTERN,
  scanGamesSource,
} from './archive-data-v2-games-core.mjs';

function targetEntryRoot(entry) {
  return `entries/games/${entry.kind}/${entry.id}`;
}

function targetCover(root, extension) {
  return `${root}/cover${extension}`;
}

function assertNoPrivatePaths(value) {
  const serialized = JSON.stringify(value);
  return !(
    /[A-Za-z]:[\\/]+Users[\\/]/.test(serialized)
    || /OneDrive/i.test(serialized)
    || /Data backup/i.test(serialized)
  );
}

export function planGamesMigration() {
  const scan = scanGamesSource();
  const operations = [];
  const kinds = { normal_game: 0, dlc: 0, live_game: 0 };
  let seasons = 0;
  let inferredParents = 0;
  let parentCovers = 0;

  for (const entry of scan.entries) {
    kinds[entry.kind] += 1;
    const root = targetEntryRoot(entry);
    operations.push({
      operation: 'create',
      role: 'entry_yaml',
      source: entry.kind === 'live_game' ? entry.sourceRelativePath : null,
      target: `${root}/entry.yaml`,
      entryId: entry.id,
    });
    if (entry.coverPath) {
      operations.push({
        operation: 'copy',
        role: entry.kind === 'live_game' ? 'live_cover' : 'cover',
        source: entry.coverRelativePath,
        target: targetCover(root, entry.coverExtension),
        checksum: entry.coverChecksum,
        entryId: entry.id,
      });
      if (entry.kind === 'live_game') parentCovers += 1;
    }
    if (entry.kind === 'dlc' && entry.parentInferred) inferredParents += 1;
    for (const season of entry.seasons || []) {
      seasons += 1;
      const seasonRoot = `${root}/seasons/${season.id}`;
      operations.push({
        operation: 'create',
        role: 'season_yaml',
        source: null,
        target: `${seasonRoot}/season.yaml`,
        entryId: entry.id,
        seasonId: season.id,
      });
      operations.push({
        operation: 'copy',
        role: 'season_cover',
        source: season.coverRelativePath,
        target: targetCover(seasonRoot, season.coverExtension),
        checksum: season.coverChecksum,
        entryId: entry.id,
        seasonId: season.id,
      });
    }
  }
  operations.push({ operation: 'create', role: 'games_config', source: null, target: 'config/games.yaml' });
  operations.push({ operation: 'create', role: 'migration_manifest', source: null, target: 'migration/games/migration-manifest.json' });
  operations.push({ operation: 'create', role: 'unmapped_report', source: null, target: 'migration/games/unmapped-files.json' });
  operations.push({ operation: 'create', role: 'legacy_report', source: null, target: 'migration/games/legacy-field-report.md' });

  const entryIds = scan.entries.map(entry => entry.id);
  const seasonIds = scan.entries.flatMap(entry => (entry.seasons || []).map(season => season.id));
  const targets = operations.map(operation => operation.target);
  const sourceCoverage = new Set(operations.map(operation => operation.source).filter(Boolean));
  const scannedSourceFiles = new Set(scan.sourceFiles.map(file => file.sourceRelativePath));
  const metadataSourcesCoveredByEntryYaml = new Set(
    scan.entries.filter(entry => entry.kind === 'normal_game' || entry.kind === 'dlc')
      .filter(entry => entry.metadataEnabled)
      .map(entry => `${entry.sourceFolder}/meta.yaml`),
  );
  for (const source of metadataSourcesCoveredByEntryYaml) sourceCoverage.add(source);
  const sourceFilesUncovered = [...scannedSourceFiles].filter(source => !sourceCoverage.has(source));
  const sourceFilesUnexpected = [...sourceCoverage].filter(source => !scannedSourceFiles.has(source));
  const invalidGameIds = entryIds.filter(id => !MIGRATED_GAME_ID_PATTERN.test(id)).length;
  const invalidSeasonIds = seasonIds.filter(id => !SEASON_ID_PATTERN.test(id)).length;
  const duplicateGameIds = entryIds.length - new Set(entryIds).size;
  const duplicateSeasonIds = seasonIds.length - new Set(seasonIds).size;
  const duplicateTargets = targets.length - new Set(targets).size;
  const dlcWithoutParent = scan.entries.filter(entry => entry.kind === 'dlc' && !entry.parentId).length;
  const privacySafe = assertNoPrivatePaths({ operations, entries: scan.entries.map(entry => ({
    id: entry.id,
    sourceRelativePath: entry.sourceRelativePath,
    parentId: entry.parentId,
    seasons: (entry.seasons || []).map(season => ({ id: season.id, sourceRelativePath: season.sourceRelativePath })),
  })) });
  const failures = [
    scan.errors.length,
    kinds.normal_game !== 273,
    kinds.dlc !== 6,
    kinds.live_game !== 3,
    seasons !== 40,
    inferredParents !== 3,
    parentCovers !== 2,
    dlcWithoutParent,
    invalidGameIds,
    invalidSeasonIds,
    duplicateGameIds,
    duplicateSeasonIds,
    duplicateTargets,
    sourceFilesUncovered.length,
    sourceFilesUnexpected.length,
    scannedSourceFiles.size !== 329,
    !privacySafe,
  ].filter(Boolean).length;

  return {
    ok: failures === 0,
    failures,
    mode: 'read-only-plan',
    writeActions: 0,
    sourceRootLabel: '[OneDrive Data]/Games',
    sourceFiles: scannedSourceFiles.size,
    sourceFilesCovered: sourceCoverage.size,
    sourceFilesUncovered: sourceFilesUncovered.length,
    sourceFilesUnexpected: sourceFilesUnexpected.length,
    sourceErrors: scan.errors.length,
    entries: entryIds.length,
    kinds,
    seasons,
    inferredParents,
    dlcWithoutParent,
    parentCovers,
    operations: operations.length,
    copyOperations: operations.filter(operation => operation.operation === 'copy').length,
    createOperations: operations.filter(operation => operation.operation === 'create').length,
    invalidGameIds,
    invalidSeasonIds,
    duplicateGameIds,
    duplicateSeasonIds,
    duplicateTargets,
    privacySafe,
    targetRootLabel: '[Archive]',
  };
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Archive Games migration plan`);
  for (const key of [
    'mode', 'sourceFiles', 'sourceFilesCovered', 'sourceFilesUncovered',
    'sourceFilesUnexpected', 'sourceErrors', 'entries', 'seasons',
    'inferredParents', 'dlcWithoutParent', 'parentCovers', 'operations',
    'copyOperations', 'createOperations', 'invalidGameIds', 'invalidSeasonIds',
    'duplicateGameIds', 'duplicateSeasonIds', 'duplicateTargets', 'privacySafe',
    'writeActions',
  ]) console.log(`  ${key}: ${result[key]}`);
  console.log(`  kinds: ${JSON.stringify(result.kinds)}`);
  console.log(`Result: Games migration plan ${result.ok ? 'passed' : 'failed'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  printResult(planGamesMigration());
}
