import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARCHIVE_DATA_V2_ROOT,
  ENTRY_ID_PATTERN,
  existsDir,
  existsFile,
  IMAGE_EXTENSIONS,
  listDirSafe,
  parseInlineList,
  parseSectionsConfig,
  SECTION_KIND_RULES,
  TEXT_KINDS,
  walkFiles,
} from './archive-data-v2-texts-core.mjs';

const BASELINE_KIND_COUNTS = {
  article: 15,
  book_note: 54,
  series_note: 63,
};
const REQUIRED_SECTIONS = [...SECTION_KIND_RULES.keys()];
const PRIVACY_RULES = [
  ['windows_user_path', /[A-Za-z]:[\\/]+Users[\\/]/i],
  ['onedrive_path', /OneDrive/i],
  ['legacy_source_path', /Data backup/i],
  ['credential_field', /\b(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i],
];

function parseScalar(rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) return '';
  if (value.startsWith('[') && value.endsWith(']')) return parseInlineList(value);
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    try {
      return value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1);
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function parseEntryYaml(filePath) {
  const data = {};
  let errors = 0;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    if (indent > 0) continue;
    if (!trimmed.includes(':')) {
      errors += 1;
      continue;
    }
    const [rawKey, ...rest] = trimmed.split(':');
    data[rawKey.trim()] = parseScalar(rest.join(':'));
  }
  return { data, errors };
}

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
      if (rule.test(text)) hits[name] = (hits[name] ?? 0) + 1;
    }
  }
  return hits;
}

export function evaluateTextsV2Shape({
  v2Root = ARCHIVE_DATA_V2_ROOT,
  expectedMinimumEntries = 132,
  expectedMinimumKinds = BASELINE_KIND_COUNTS,
  requireMigrationBaseline = true,
} = {}) {
  const textsRoot = path.join(v2Root, 'entries', 'texts');
  const configPath = path.join(v2Root, 'config', 'texts-sections.yaml');
  const migrationRoot = path.join(v2Root, 'migration', 'texts');
  const manifestPath = path.join(migrationRoot, 'migration-manifest.json');
  const unmappedPath = path.join(migrationRoot, 'unmapped-files.json');
  const legacyReportPath = path.join(migrationRoot, 'legacy-field-report.md');
  const migrationBaselineRequired = requireMigrationBaseline && existsDir(migrationRoot);
  const config = parseSectionsConfig(configPath);
  const kindCounts = Object.fromEntries([...TEXT_KINDS].map(kind => [kind, 0]));
  let entryYamlFiles = 0;
  let contentFiles = 0;
  let coverFiles = 0;
  let malformedEntries = 0;
  let invalidIds = 0;
  let sectionKindMismatches = 0;
  let datePolicyViolations = 0;

  for (const kind of TEXT_KINDS) {
    const kindRoot = path.join(textsRoot, kind);
    const entries = listDirSafe(kindRoot).filter(entry => entry.isDirectory());
    kindCounts[kind] = entries.length;
    for (const entryDirent of entries) {
      const entryDir = path.join(kindRoot, entryDirent.name);
      const entryYamlPath = path.join(entryDir, 'entry.yaml');
      const contentPath = path.join(entryDir, 'content.md');
      const covers = listDirSafe(entryDir).filter(entry => (
        entry.isFile()
        && entry.name.startsWith('cover.')
        && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ));
      const entryYamlExists = existsFile(entryYamlPath);
      const contentExists = existsFile(contentPath);
      entryYamlFiles += entryYamlExists ? 1 : 0;
      contentFiles += contentExists ? 1 : 0;
      coverFiles += covers.length;
      let malformed = !entryYamlExists || !contentExists;

      if (!ENTRY_ID_PATTERN.test(entryDirent.name)) {
        invalidIds += 1;
        malformed = true;
      }
      if (kind === 'book_note' ? covers.length !== 1 : covers.length !== 0) malformed = true;
      if (contentExists && fs.readFileSync(contentPath, 'utf8').trim().length === 0) malformed = true;

      if (entryYamlExists) {
        const parsed = parseEntryYaml(entryYamlPath);
        const data = parsed.data;
        if (
          parsed.errors
          || data.id !== entryDirent.name
          || data.board !== 'texts'
          || data.kind !== kind
          || !String(data.title ?? '').trim()
          || !String(data.section ?? '').trim()
          || !Array.isArray(data.tags)
        ) malformed = true;
        if (SECTION_KIND_RULES.get(data.section) !== kind) {
          sectionKindMismatches += 1;
          malformed = true;
        }
        const date = String(data.date ?? '').trim();
        if (kind === 'book_note') {
          if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) datePolicyViolations += 1;
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          datePolicyViolations += 1;
          malformed = true;
        }
      }
      if (malformed) malformedEntries += 1;
    }
  }

  const unknownKindDirs = listDirSafe(textsRoot)
    .filter(entry => entry.isDirectory() && !TEXT_KINDS.has(entry.name))
    .length;
  const totalEntries = Object.values(kindCounts).reduce((sum, count) => sum + count, 0);
  const configMissingSections = REQUIRED_SECTIONS.filter(key => !config.sections.has(key));
  let configKindMismatches = 0;
  for (const [key, expectedKind] of SECTION_KIND_RULES) {
    if (config.sections.get(key)?.kind !== expectedKind) configKindMismatches += 1;
  }
  const baselineKindFailures = Object.entries(expectedMinimumKinds)
    .filter(([kind, minimum]) => (kindCounts[kind] ?? 0) < minimum)
    .length;
  const manifest = readJsonArray(manifestPath);
  const unmapped = readJsonArray(unmappedPath);
  const privacyFiles = [
    ...walkFiles(textsRoot).filter(file => path.basename(file) === 'entry.yaml'),
    configPath,
    manifestPath,
    unmappedPath,
    legacyReportPath,
  ].filter(existsFile);
  const privacyHits = scanPrivacy(privacyFiles);
  const privacyRuleHits = Object.values(privacyHits).reduce((sum, count) => sum + count, 0);

  const failures = [
    !existsDir(v2Root),
    !existsDir(textsRoot),
    !existsFile(configPath),
    config.errors.length > 0,
    configMissingSections.length > 0,
    configKindMismatches > 0,
    totalEntries < expectedMinimumEntries,
    baselineKindFailures > 0,
    entryYamlFiles !== totalEntries,
    contentFiles !== totalEntries,
    malformedEntries > 0,
    invalidIds > 0,
    sectionKindMismatches > 0,
    datePolicyViolations > 0,
    unknownKindDirs > 0,
    privacyRuleHits > 0,
    migrationBaselineRequired && (!manifest.exists || manifest.parseError || manifest.count !== 187),
    migrationBaselineRequired && (!unmapped.exists || unmapped.parseError || unmapped.count !== 0),
    migrationBaselineRequired && !existsFile(legacyReportPath),
  ].filter(Boolean).length;

  return {
    ok: failures === 0,
    failures,
    archiveDataV2Exists: existsDir(v2Root),
    textsRootExists: existsDir(textsRoot),
    expectedMinimumEntries,
    totalEntries,
    kindCounts,
    entryYamlFiles,
    contentFiles,
    coverFiles,
    malformedEntries,
    invalidIds,
    sectionKindMismatches,
    datePolicyViolations,
    unknownKindDirs,
    configExists: existsFile(configPath),
    configErrors: config.errors.length,
    configSections: config.sections.size,
    configMissingSections: configMissingSections.length,
    configKindMismatches,
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
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Archive Texts shape`);
  for (const key of [
    'archiveDataV2Exists', 'textsRootExists', 'expectedMinimumEntries', 'totalEntries',
    'entryYamlFiles', 'contentFiles', 'coverFiles', 'malformedEntries', 'invalidIds',
    'sectionKindMismatches', 'datePolicyViolations', 'unknownKindDirs', 'configExists',
    'configErrors', 'configSections', 'configMissingSections', 'configKindMismatches',
    'manifestExists', 'manifestParseError', 'manifestRecords', 'unmappedExists',
    'unmappedParseError', 'unmappedFiles', 'legacyFieldReportExists', 'privacyRuleHits',
  ]) console.log(`  ${key}: ${result[key]}`);
  console.log(`  kindCounts: ${JSON.stringify(result.kindCounts)}`);
  console.log(`  privacyRules: ${result.privacyRules.length ? result.privacyRules.join(', ') : 'none'}`);
  console.log(`Result: archive data v2 texts shape check ${result.ok ? 'passed' : 'failed'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluateTextsV2Shape();
  printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}
