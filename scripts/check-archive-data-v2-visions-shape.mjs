import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARCHIVE_DATA_V2_ROOT,
  CHARACTER_ID_PATTERN,
  existsDir,
  existsFile,
  IMAGE_EXTENSIONS,
  listDirSafe,
  ORDINARY_VISION_KINDS,
  parseFlatYaml,
  parseTwoLevelYaml,
  PERIOD_RULES,
  VISION_ENTRY_ID_PATTERN,
  VISION_KINDS,
  walkFiles,
} from './archive-data-v2-visions-core.mjs';

const BASELINE_KIND_COUNTS = { movie: 71, series: 40, showcase: 1 };
const PRIVACY_RULES = [
  ['windows_user_path', /[A-Za-z]:[\\/]+Users[\\/]/i],
  ['onedrive_path', /OneDrive/i],
  ['legacy_source_path', /Data backup/i],
  ['credential_field', /\b(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i],
];

function readJsonArray(filePath) {
  if (!existsFile(filePath)) return { exists: false, parseError: false, count: 0 };
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { exists: true, parseError: false, count: Array.isArray(value) ? value.length : -1 };
  } catch {
    return { exists: true, parseError: true, count: 0 };
  }
}

function scanPrivacy(files) {
  const hits = {};
  for (const file of files) {
    let text = '';
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const [name, rule] of PRIVACY_RULES) {
      rule.lastIndex = 0;
      if (rule.test(text)) hits[name] = (hits[name] ?? 0) + 1;
    }
  }
  return hits;
}

function parsePeriodsConfig(filePath) {
  const parsed = parseTwoLevelYaml(filePath);
  const periods = new Map(
    Object.entries(parsed.data)
      .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value)),
  );
  return { periods, errors: parsed.errors };
}

export function evaluateVisionsV2Shape({
  v2Root = ARCHIVE_DATA_V2_ROOT,
  expectedMinimumEntries = 112,
  expectedMinimumKinds = BASELINE_KIND_COUNTS,
  expectedCharacters = 20,
  requireMigrationBaseline = true,
} = {}) {
  const visionsRoot = path.join(v2Root, 'entries', 'visions');
  const configPath = path.join(v2Root, 'config', 'visions-periods.yaml');
  const migrationRoot = path.join(v2Root, 'migration', 'visions');
  const manifestPath = path.join(migrationRoot, 'migration-manifest.json');
  const unmappedPath = path.join(migrationRoot, 'unmapped-files.json');
  const legacyReportPath = path.join(migrationRoot, 'legacy-field-report.md');
  const migrationBaselineRequired = requireMigrationBaseline && existsDir(migrationRoot);
  const kindCounts = { movie: 0, series: 0, showcase: 0 };
  let entryYamlFiles = 0;
  let posterFiles = 0;
  let characterYamlFiles = 0;
  let avatarFiles = 0;
  let clipFiles = 0;
  let malformedEntries = 0;
  let malformedCharacters = 0;
  let invalidIds = 0;
  let invalidCharacterIds = 0;
  let periodErrors = 0;
  let characterOrderErrors = 0;

  for (const kind of ORDINARY_VISION_KINDS) {
    const kindRoot = path.join(visionsRoot, kind);
    const entries = listDirSafe(kindRoot).filter(entry => entry.isDirectory());
    kindCounts[kind] = entries.length;
    for (const entry of entries) {
      const root = path.join(kindRoot, entry.name);
      const yamlPath = path.join(root, 'entry.yaml');
      const posters = listDirSafe(root).filter(file => (
        file.isFile()
        && file.name.startsWith('poster.')
        && IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase())
      ));
      entryYamlFiles += existsFile(yamlPath) ? 1 : 0;
      posterFiles += posters.length;
      let malformed = !existsFile(yamlPath) || posters.length !== 1;
      if (!VISION_ENTRY_ID_PATTERN.test(entry.name)) {
        invalidIds += 1;
        malformed = true;
      }
      if (existsFile(yamlPath)) {
        const parsed = parseFlatYaml(yamlPath);
        const data = parsed.data;
        if (
          parsed.errors
          || data.id !== entry.name
          || data.board !== 'visions'
          || data.kind !== kind
          || !String(data.title ?? '').trim()
          || !String(data.period ?? '').trim()
          || typeof data.cinema !== 'boolean'
          || typeof data.quote !== 'string'
          || typeof data.url !== 'string'
        ) malformed = true;
        if (!PERIOD_RULES.has(data.period)) {
          periodErrors += 1;
          malformed = true;
        }
      }
      if (malformed) malformedEntries += 1;
    }
  }

  const showcaseRoot = path.join(visionsRoot, 'showcase');
  const showcaseEntries = listDirSafe(showcaseRoot).filter(entry => entry.isDirectory());
  kindCounts.showcase = showcaseEntries.length;
  for (const entry of showcaseEntries) {
    const root = path.join(showcaseRoot, entry.name);
    const yamlPath = path.join(root, 'entry.yaml');
    const charactersRoot = path.join(root, 'characters');
    entryYamlFiles += existsFile(yamlPath) ? 1 : 0;
    let malformed = !existsFile(yamlPath) || !existsDir(charactersRoot);
    if (!VISION_ENTRY_ID_PATTERN.test(entry.name)) {
      invalidIds += 1;
      malformed = true;
    }
    let expectedOrder = [];
    if (existsFile(yamlPath)) {
      const parsed = parseFlatYaml(yamlPath);
      const data = parsed.data;
      expectedOrder = Array.isArray(data.character_order) ? data.character_order : [];
      if (
        parsed.errors
        || data.id !== entry.name
        || data.board !== 'visions'
        || data.kind !== 'showcase'
        || !String(data.title ?? '').trim()
        || !Array.isArray(data.character_order)
      ) malformed = true;
    }
    const characterEntries = listDirSafe(charactersRoot).filter(character => character.isDirectory());
    const actualIds = new Set(characterEntries.map(character => character.name));
    if (
      expectedOrder.length !== characterEntries.length
      || new Set(expectedOrder).size !== expectedOrder.length
      || expectedOrder.some(id => !actualIds.has(id))
    ) {
      characterOrderErrors += 1;
      malformed = true;
    }
    for (const character of characterEntries) {
      const characterRoot = path.join(charactersRoot, character.name);
      const characterYaml = path.join(characterRoot, 'character.yaml');
      const avatars = listDirSafe(characterRoot).filter(file => (
        file.isFile() && file.name.startsWith('avatar.') && IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase())
      ));
      const clips = listDirSafe(characterRoot).filter(file => (
        file.isFile() && file.name.startsWith('clip.') && IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase())
      ));
      characterYamlFiles += existsFile(characterYaml) ? 1 : 0;
      avatarFiles += avatars.length;
      clipFiles += clips.length;
      let characterMalformed = !existsFile(characterYaml) || avatars.length !== 1 || clips.length !== 1;
      if (!CHARACTER_ID_PATTERN.test(character.name)) {
        invalidCharacterIds += 1;
        characterMalformed = true;
      }
      if (existsFile(characterYaml)) {
        const parsed = parseFlatYaml(characterYaml);
        const data = parsed.data;
        if (
          parsed.errors
          || data.id !== character.name
          || !String(data.title ?? '').trim()
          || typeof data.caption !== 'string'
          || !Number.isInteger(data.order)
          || data.order < 1
        ) characterMalformed = true;
      }
      if (characterMalformed) malformedCharacters += 1;
    }
    if (malformed) malformedEntries += 1;
  }

  const totalEntries = Object.values(kindCounts).reduce((sum, count) => sum + count, 0);
  const totalCharacters = characterYamlFiles;
  const unknownKindDirs = listDirSafe(visionsRoot)
    .filter(entry => entry.isDirectory() && !VISION_KINDS.has(entry.name))
    .length;
  const periodsConfig = parsePeriodsConfig(configPath);
  const missingPeriods = [...PERIOD_RULES.keys()].filter(period => !periodsConfig.periods.has(period));
  let periodConfigMismatches = 0;
  for (const [period, expected] of PERIOD_RULES) {
    const actual = periodsConfig.periods.get(period);
    if (
      Number(actual?.order) !== expected.order
      || Number(actual?.synthetic_year) !== expected.syntheticYear
    ) periodConfigMismatches += 1;
  }
  const baselineKindFailures = Object.entries(expectedMinimumKinds)
    .filter(([kind, minimum]) => (kindCounts[kind] ?? 0) < minimum)
    .length;
  const manifest = readJsonArray(manifestPath);
  const unmapped = readJsonArray(unmappedPath);
  const privacyFiles = [
    ...walkFiles(visionsRoot).filter(file => ['entry.yaml', 'character.yaml'].includes(path.basename(file))),
    configPath,
    manifestPath,
    unmappedPath,
    legacyReportPath,
  ].filter(existsFile);
  const privacyHits = scanPrivacy(privacyFiles);
  const privacyRuleHits = Object.values(privacyHits).reduce((sum, count) => sum + count, 0);

  const failures = [
    !existsDir(v2Root),
    !existsDir(visionsRoot),
    !existsFile(configPath),
    periodsConfig.errors.length > 0,
    missingPeriods.length > 0,
    periodConfigMismatches > 0,
    totalEntries < expectedMinimumEntries,
    baselineKindFailures > 0,
    totalCharacters !== expectedCharacters,
    entryYamlFiles !== totalEntries,
    posterFiles !== kindCounts.movie + kindCounts.series,
    malformedEntries > 0,
    malformedCharacters > 0,
    invalidIds > 0,
    invalidCharacterIds > 0,
    periodErrors > 0,
    characterOrderErrors > 0,
    unknownKindDirs > 0,
    privacyRuleHits > 0,
    migrationBaselineRequired && (!manifest.exists || manifest.parseError || manifest.count !== 157),
    migrationBaselineRequired && (!unmapped.exists || unmapped.parseError || unmapped.count !== 0),
    migrationBaselineRequired && !existsFile(legacyReportPath),
  ].filter(Boolean).length;

  return {
    ok: failures === 0,
    failures,
    archiveDataV2Exists: existsDir(v2Root),
    visionsRootExists: existsDir(visionsRoot),
    expectedMinimumEntries,
    totalEntries,
    kindCounts,
    entryYamlFiles,
    posterFiles,
    totalCharacters,
    characterYamlFiles,
    avatarFiles,
    clipFiles,
    malformedEntries,
    malformedCharacters,
    invalidIds,
    invalidCharacterIds,
    periodErrors,
    characterOrderErrors,
    unknownKindDirs,
    configExists: existsFile(configPath),
    configErrors: periodsConfig.errors.length,
    configPeriods: periodsConfig.periods.size,
    missingPeriods: missingPeriods.length,
    periodConfigMismatches,
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
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Archive Visions shape`);
  for (const key of [
    'archiveDataV2Exists', 'visionsRootExists', 'expectedMinimumEntries', 'totalEntries',
    'entryYamlFiles', 'posterFiles', 'totalCharacters', 'characterYamlFiles',
    'avatarFiles', 'clipFiles', 'malformedEntries', 'malformedCharacters',
    'invalidIds', 'invalidCharacterIds', 'periodErrors', 'characterOrderErrors',
    'unknownKindDirs', 'configExists', 'configErrors', 'configPeriods',
    'missingPeriods', 'periodConfigMismatches', 'manifestExists', 'manifestParseError',
    'manifestRecords', 'unmappedExists', 'unmappedParseError', 'unmappedFiles',
    'legacyFieldReportExists', 'privacyRuleHits',
  ]) console.log(`  ${key}: ${result[key]}`);
  console.log(`  kindCounts: ${JSON.stringify(result.kindCounts)}`);
  console.log(`  privacyRules: ${result.privacyRules.length ? result.privacyRules.join(', ') : 'none'}`);
  console.log(`Result: archive data v2 visions shape check ${result.ok ? 'passed' : 'failed'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluateVisionsV2Shape();
  printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}
