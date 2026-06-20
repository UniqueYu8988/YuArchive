import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARCHIVE_DATA_V2_ROOT,
  GAME_ID_PATTERN,
  GAME_KINDS,
  GAMES_MIGRATION_ROOT,
  GAMES_V2_CONFIG_PATH,
  GAMES_V2_ROOT,
  IMAGE_EXTENSIONS,
  SEASON_ID_PATTERN,
  existsDir,
  existsFile,
  listDirSafe,
  normalizeText,
  parseScalar,
  unquote,
} from './archive-data-v2-games-core.mjs';

function parseFlatYaml(filePath) {
  const data = {};
  const errors = [];
  if (!existsFile(filePath)) return { data, errors: ['file_missing'] };
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#') || rawLine.startsWith(' ') || rawLine.startsWith('\t')) return;
    const colon = trimmed.indexOf(':');
    if (colon < 0) {
      errors.push(`line_${index + 1}_missing_colon`);
      return;
    }
    const key = unquote(trimmed.slice(0, colon));
    data[key] = parseScalar(trimmed.slice(colon + 1));
  });
  return { data, errors };
}

function readJsonArray(filePath) {
  if (!existsFile(filePath)) return { exists: false, parseError: false, count: 0 };
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { exists: true, parseError: !Array.isArray(value), count: Array.isArray(value) ? value.length : 0 };
  } catch {
    return { exists: true, parseError: true, count: 0 };
  }
}

function filesRecursive(root) {
  const output = [];
  for (const entry of listDirSafe(root)) {
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...filesRecursive(current));
    else if (entry.isFile()) output.push(current);
  }
  return output;
}

function scanPrivacy(files) {
  const rules = {
    windows_user_path: /[A-Za-z]:[\\/]+Users[\\/]/,
    onedrive_path: /OneDrive/i,
    legacy_data_backup: /Data backup/i,
    secret_field: /\b(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i,
  };
  const counts = Object.fromEntries(Object.keys(rules).map(key => [key, 0]));
  for (const file of files) {
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const [name, rule] of Object.entries(rules)) {
      if (rule.test(content)) counts[name] += 1;
    }
  }
  return counts;
}

function listEntryDirectories(kindRoot) {
  return listDirSafe(kindRoot)
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(kindRoot, entry.name));
}

export function evaluateGamesV2Shape({
  v2Root = ARCHIVE_DATA_V2_ROOT,
  expectedMinimumEntries = 282,
  expectedMinimumKinds = { normal_game: 273, dlc: 6, live_game: 3 },
  expectedSeasons = 40,
  expectedMetadataDisabled = 93,
  expectedLiveParentCovers = 2,
  requireMigrationBaseline = true,
} = {}) {
  const gamesRoot = path.join(v2Root, 'entries', 'games');
  const configPath = path.join(v2Root, 'config', 'games.yaml');
  const migrationRoot = path.join(v2Root, 'migration', 'games');
  const manifestPath = path.join(migrationRoot, 'migration-manifest.json');
  const unmappedPath = path.join(migrationRoot, 'unmapped-files.json');
  const legacyReportPath = path.join(migrationRoot, 'legacy-field-report.md');
  const kindCounts = { normal_game: 0, dlc: 0, live_game: 0 };
  const gameIds = new Set();
  const parentReferences = [];
  let entryYamlFiles = 0;
  let ordinaryCovers = 0;
  let liveParentCovers = 0;
  let seasonYamlFiles = 0;
  let seasonCovers = 0;
  let malformedEntries = 0;
  let malformedSeasons = 0;
  let invalidGameIds = 0;
  let invalidSeasonIds = 0;
  let duplicateGameIds = 0;
  let duplicateSeasonIds = 0;
  let metadataDisabled = 0;
  let unknownKindDirs = 0;
  let unexpectedFiles = 0;
  const seasonIds = new Set();

  for (const kindEntry of listDirSafe(gamesRoot).filter(entry => entry.isDirectory())) {
    const kind = kindEntry.name;
    if (!GAME_KINDS.has(kind)) {
      unknownKindDirs += 1;
      continue;
    }
    const kindRoot = path.join(gamesRoot, kind);
    for (const entryDir of listEntryDirectories(kindRoot)) {
      kindCounts[kind] += 1;
      const directoryId = path.basename(entryDir);
      const entryPath = path.join(entryDir, 'entry.yaml');
      const parsed = parseFlatYaml(entryPath);
      const data = parsed.data;
      if (existsFile(entryPath)) entryYamlFiles += 1;
      let malformed = parsed.errors.length > 0;
      if (!GAME_ID_PATTERN.test(directoryId) || data.id !== directoryId) invalidGameIds += 1;
      if (gameIds.has(directoryId)) duplicateGameIds += 1;
      gameIds.add(directoryId);
      if (data.board !== 'games' || data.kind !== kind || !normalizeText(data.title)) malformed = true;
      if (kind !== 'live_game' && !Number.isInteger(Number(data.year))) malformed = true;
      if (data.metadata_enabled === false) metadataDisabled += 1;
      if (kind === 'dlc') {
        if (!GAME_ID_PATTERN.test(String(data.parent_id || ''))) malformed = true;
        parentReferences.push({ child: directoryId, parent: String(data.parent_id || '') });
      }

      const rootFiles = listDirSafe(entryDir).filter(entry => entry.isFile());
      const covers = rootFiles.filter(entry => IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && path.basename(entry.name, path.extname(entry.name)) === 'cover');
      const nonEntryFiles = rootFiles.filter(entry => entry.name !== 'entry.yaml' && !covers.includes(entry));
      unexpectedFiles += nonEntryFiles.length;
      if (kind === 'live_game') {
        liveParentCovers += covers.length;
        if (covers.length > 1) malformed = true;
      } else {
        ordinaryCovers += covers.length;
        if (covers.length !== 1) malformed = true;
      }

      const seasonsRoot = path.join(entryDir, 'seasons');
      const seasonDirs = existsDir(seasonsRoot)
        ? listDirSafe(seasonsRoot).filter(entry => entry.isDirectory()).map(entry => path.join(seasonsRoot, entry.name))
        : [];
      if (kind !== 'live_game' && seasonDirs.length) malformed = true;
      for (const seasonDir of seasonDirs) {
        const seasonDirectoryId = path.basename(seasonDir);
        const seasonPath = path.join(seasonDir, 'season.yaml');
        const seasonParsed = parseFlatYaml(seasonPath);
        const season = seasonParsed.data;
        let seasonMalformed = seasonParsed.errors.length > 0;
        if (existsFile(seasonPath)) seasonYamlFiles += 1;
        if (!SEASON_ID_PATTERN.test(seasonDirectoryId) || season.id !== seasonDirectoryId) invalidSeasonIds += 1;
        if (seasonIds.has(seasonDirectoryId)) duplicateSeasonIds += 1;
        seasonIds.add(seasonDirectoryId);
        if (!normalizeText(season.title) || !normalizeText(season.label) || !Number.isFinite(Number(season.order))) {
          seasonMalformed = true;
        }
        const seasonFiles = listDirSafe(seasonDir).filter(entry => entry.isFile());
        const coversForSeason = seasonFiles.filter(entry => IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && path.basename(entry.name, path.extname(entry.name)) === 'cover');
        seasonCovers += coversForSeason.length;
        if (coversForSeason.length !== 1) seasonMalformed = true;
        unexpectedFiles += seasonFiles.filter(entry => entry.name !== 'season.yaml' && !coversForSeason.includes(entry)).length;
        if (seasonMalformed) malformedSeasons += 1;
      }
      if (malformed) malformedEntries += 1;
    }
  }

  let invalidParentReferences = 0;
  for (const reference of parentReferences) {
    if (!gameIds.has(reference.parent) || reference.parent === reference.child) invalidParentReferences += 1;
  }
  const config = parseFlatYaml(configPath);
  const configErrors = config.errors.length
    + (Number.isInteger(Number(config.data.season_target_year)) ? 0 : 1)
    + (Object.hasOwn(config.data, 'season_priority') ? 0 : 1);
  const manifest = readJsonArray(manifestPath);
  const unmapped = readJsonArray(unmappedPath);
  const privacyFiles = [
    ...filesRecursive(gamesRoot).filter(file => ['entry.yaml', 'season.yaml'].includes(path.basename(file))),
    configPath,
    manifestPath,
    unmappedPath,
    legacyReportPath,
  ].filter(existsFile);
  const privacyHits = scanPrivacy(privacyFiles);
  const privacyRuleHits = Object.values(privacyHits).reduce((sum, count) => sum + count, 0);
  const totalEntries = Object.values(kindCounts).reduce((sum, count) => sum + count, 0);
  const kindMinimumFailures = Object.entries(expectedMinimumKinds)
    .filter(([kind, minimum]) => (kindCounts[kind] ?? 0) < minimum).length;
  const failures = [
    !existsDir(v2Root),
    !existsDir(gamesRoot),
    unknownKindDirs,
    totalEntries < expectedMinimumEntries,
    kindMinimumFailures,
    entryYamlFiles !== totalEntries,
    ordinaryCovers !== kindCounts.normal_game + kindCounts.dlc,
    liveParentCovers !== expectedLiveParentCovers,
    seasonYamlFiles !== expectedSeasons,
    seasonCovers !== expectedSeasons,
    metadataDisabled !== expectedMetadataDisabled,
    malformedEntries,
    malformedSeasons,
    invalidGameIds,
    invalidSeasonIds,
    duplicateGameIds,
    duplicateSeasonIds,
    invalidParentReferences,
    unexpectedFiles,
    !existsFile(configPath),
    configErrors,
    privacyRuleHits,
    requireMigrationBaseline && (!manifest.exists || manifest.parseError || manifest.count !== 329),
    requireMigrationBaseline && (!unmapped.exists || unmapped.parseError || unmapped.count !== 0),
    requireMigrationBaseline && !existsFile(legacyReportPath),
  ].filter(Boolean).length;

  return {
    ok: failures === 0,
    failures,
    archiveDataV2Exists: existsDir(v2Root),
    gamesRootExists: existsDir(gamesRoot),
    expectedMinimumEntries,
    totalEntries,
    kindCounts,
    entryYamlFiles,
    ordinaryCovers,
    liveParentCovers,
    seasonYamlFiles,
    seasonCovers,
    metadataDisabled,
    malformedEntries,
    malformedSeasons,
    invalidGameIds,
    invalidSeasonIds,
    duplicateGameIds,
    duplicateSeasonIds,
    invalidParentReferences,
    unknownKindDirs,
    unexpectedFiles,
    configExists: existsFile(configPath),
    configErrors,
    manifestExists: manifest.exists,
    manifestParseError: manifest.parseError,
    manifestRecords: manifest.count,
    unmappedExists: unmapped.exists,
    unmappedParseError: unmapped.parseError,
    unmappedFiles: unmapped.count,
    legacyFieldReportExists: existsFile(legacyReportPath),
    privacyRuleHits,
    privacyRules: Object.keys(privacyHits),
  };
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] ArchiveData-v2 Games shape`);
  for (const key of [
    'archiveDataV2Exists', 'gamesRootExists', 'expectedMinimumEntries', 'totalEntries',
    'entryYamlFiles', 'ordinaryCovers', 'liveParentCovers', 'seasonYamlFiles',
    'seasonCovers', 'metadataDisabled', 'malformedEntries', 'malformedSeasons',
    'invalidGameIds', 'invalidSeasonIds', 'duplicateGameIds', 'duplicateSeasonIds',
    'invalidParentReferences', 'unknownKindDirs', 'unexpectedFiles', 'configExists',
    'configErrors', 'manifestExists', 'manifestParseError', 'manifestRecords',
    'unmappedExists', 'unmappedParseError', 'unmappedFiles', 'legacyFieldReportExists',
    'privacyRuleHits',
  ]) console.log(`  ${key}: ${result[key]}`);
  console.log(`  kindCounts: ${JSON.stringify(result.kindCounts)}`);
  console.log(`  privacyRules: ${result.privacyRules.length ? result.privacyRules.join(', ') : 'none'}`);
  console.log(`Result: archive data v2 games shape check ${result.ok ? 'passed' : 'failed'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluateGamesV2Shape();
  printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}
