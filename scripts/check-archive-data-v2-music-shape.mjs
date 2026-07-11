import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');
const V2_ROOT = path.join(path.dirname(SOURCE_ROOT), 'Archive');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac']);

const PRIVACY_RULES = [
  ['windows_user_path', /[A-Z]:[\\/]+Users[\\/]+/i],
  ['onedrive_fragment', /OneDrive/i],
  ['legacy_data_backup', /Data backup/i],
  ['secret_field', /\b(password|secret|token|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i],
];

function existsDir(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function listDirSafe(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function readJsonSafe(filePath) {
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: false };
  } catch {
    return { value: null, error: true };
  }
}

function countFiles(dirPath, predicate) {
  return listDirSafe(dirPath).filter(entry => entry.isFile() && predicate(entry.name)).length;
}

function scanPrivacy(filePath) {
  if (!existsFile(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  const hits = [];
  for (const [ruleName, pattern] of PRIVACY_RULES) {
    if (pattern.test(text)) hits.push(ruleName);
  }
  return hits;
}

export function evaluateMusicV2Shape({
  v2Root = V2_ROOT,
  expectedMinimumEntries = 33,
  requireMigrationBaseline = true,
} = {}) {
  const v2MusicRoot = path.join(v2Root, 'entries', 'music', 'album');
  const v2MigrationRoot = path.join(v2Root, 'migration');
  const migrationBaselineRequired = requireMigrationBaseline && existsDir(v2MigrationRoot);
  const fatal = [];
  if (!existsDir(v2Root)) fatal.push('Archive missing');
  if (!existsDir(v2MusicRoot)) fatal.push('Music album directory missing');

  const entryDirs = existsDir(v2MusicRoot)
    ? listDirSafe(v2MusicRoot).filter(entry => entry.isDirectory())
    : [];

  let entryYamlFiles = 0;
  let contentFiles = 0;
  let coverFiles = 0;
  let audioFiles = 0;
  let malformedEntryDirs = 0;

  for (const entry of entryDirs) {
    const entryDir = path.join(v2MusicRoot, entry.name);
    const entryYaml = existsFile(path.join(entryDir, 'entry.yaml')) ? 1 : 0;
    const content = existsFile(path.join(entryDir, 'content.md')) ? 1 : 0;
    const covers = countFiles(entryDir, name => name.startsWith('cover.') && IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()));
    const audio = countFiles(entryDir, name => name.startsWith('audio.') && AUDIO_EXTENSIONS.has(path.extname(name).toLowerCase()));

    entryYamlFiles += entryYaml;
    contentFiles += content;
    coverFiles += covers;
    audioFiles += audio;
    if (entryYaml !== 1 || content !== 1 || covers !== 1 || audio !== 1) malformedEntryDirs += 1;
  }

  const manifestPath = path.join(v2MigrationRoot, 'migration-manifest.json');
  const unmappedPath = path.join(v2MigrationRoot, 'unmapped-files.json');
  const legacyReportPath = path.join(v2MigrationRoot, 'legacy-field-report.md');
  const manifest = readJsonSafe(manifestPath);
  const unmapped = readJsonSafe(unmappedPath);

  const manifestRecords = Array.isArray(manifest.value) ? manifest.value.length : 0;
  const unmappedFiles = Array.isArray(unmapped.value) ? unmapped.value.length : 0;
  const privacyHits = [
    ...scanPrivacy(manifestPath),
    ...scanPrivacy(unmappedPath),
    ...scanPrivacy(legacyReportPath),
  ];

  const failures = fatal.length
    + (entryDirs.length >= expectedMinimumEntries ? 0 : 1)
    + (entryYamlFiles === entryDirs.length ? 0 : 1)
    + (contentFiles === entryDirs.length ? 0 : 1)
    + (coverFiles === entryDirs.length ? 0 : 1)
    + (audioFiles === entryDirs.length ? 0 : 1)
    + malformedEntryDirs
    + (migrationBaselineRequired && !(existsFile(manifestPath) && !manifest.error && manifestRecords === 99) ? 1 : 0)
    + (migrationBaselineRequired && !(existsFile(unmappedPath) && !unmapped.error && unmappedFiles === 0) ? 1 : 0)
    + (migrationBaselineRequired && !existsFile(legacyReportPath) ? 1 : 0)
    + privacyHits.length;

  return {
    ok: failures === 0,
    failures,
    archiveDataV2Exists: existsDir(v2Root),
    expectedMinimumEntries,
    albumEntryDirs: entryDirs.length,
    entryYamlFiles,
    contentFiles,
    coverFiles,
    audioFiles,
    malformedEntryDirs,
    manifestExists: existsFile(manifestPath),
    manifestParseError: manifest.error,
    manifestRecords,
    unmappedExists: existsFile(unmappedPath),
    unmappedParseError: unmapped.error,
    unmappedFiles,
    legacyFieldReportExists: existsFile(legacyReportPath),
    privacyRuleHits: privacyHits.length,
    privacyRules: privacyHits.length ? [...new Set(privacyHits)] : [],
  };
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Archive Music shape`);
  console.log(`  archiveDataV2Exists: ${result.archiveDataV2Exists}`);
  console.log(`  albumEntryDirs: ${result.albumEntryDirs}`);
  console.log(`  entryYamlFiles: ${result.entryYamlFiles}`);
  console.log(`  contentFiles: ${result.contentFiles}`);
  console.log(`  coverFiles: ${result.coverFiles}`);
  console.log(`  audioFiles: ${result.audioFiles}`);
  console.log(`  malformedEntryDirs: ${result.malformedEntryDirs}`);
  console.log(`  manifestExists: ${result.manifestExists}`);
  console.log(`  manifestParseError: ${result.manifestParseError}`);
  console.log(`  manifestRecords: ${result.manifestRecords}`);
  console.log(`  unmappedExists: ${result.unmappedExists}`);
  console.log(`  unmappedParseError: ${result.unmappedParseError}`);
  console.log(`  unmappedFiles: ${result.unmappedFiles}`);
  console.log(`  legacyFieldReportExists: ${result.legacyFieldReportExists}`);
  console.log(`  privacyRuleHits: ${result.privacyRuleHits}`);
  console.log(`  privacyRules: ${result.privacyRules.length ? result.privacyRules.join(', ') : 'none'}`);
  console.log(`Result: archive data v2 music shape check ${result.ok ? 'passed' : 'failed'}`);
}

function main() {
  const result = evaluateMusicV2Shape();
  printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
