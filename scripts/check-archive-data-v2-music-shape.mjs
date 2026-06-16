import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = 'C:\\Users\\Yu\\OneDrive\\图片\\Data';
const V2_ROOT = path.join(path.dirname(SOURCE_ROOT), 'ArchiveData-v2');
const V2_MUSIC_ROOT = path.join(V2_ROOT, 'entries', 'music', 'album');
const V2_MIGRATION_ROOT = path.join(V2_ROOT, 'migration');

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

function main() {
  const fatal = [];
  if (!existsDir(V2_ROOT)) fatal.push('ArchiveData-v2 missing');
  if (!existsDir(V2_MUSIC_ROOT)) fatal.push('Music album directory missing');
  if (!existsDir(V2_MIGRATION_ROOT)) fatal.push('migration directory missing');

  const entryDirs = existsDir(V2_MUSIC_ROOT)
    ? listDirSafe(V2_MUSIC_ROOT).filter(entry => entry.isDirectory())
    : [];

  let entryYamlFiles = 0;
  let contentFiles = 0;
  let coverFiles = 0;
  let audioFiles = 0;
  let malformedEntryDirs = 0;

  for (const entry of entryDirs) {
    const entryDir = path.join(V2_MUSIC_ROOT, entry.name);
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

  const manifestPath = path.join(V2_MIGRATION_ROOT, 'migration-manifest.json');
  const unmappedPath = path.join(V2_MIGRATION_ROOT, 'unmapped-files.json');
  const legacyReportPath = path.join(V2_MIGRATION_ROOT, 'legacy-field-report.md');
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
    + (entryDirs.length === 33 ? 0 : 1)
    + (entryYamlFiles === 33 ? 0 : 1)
    + (contentFiles === 33 ? 0 : 1)
    + (coverFiles === 33 ? 0 : 1)
    + (audioFiles === 33 ? 0 : 1)
    + malformedEntryDirs
    + (existsFile(manifestPath) && !manifest.error && manifestRecords === 99 ? 0 : 1)
    + (existsFile(unmappedPath) && !unmapped.error && unmappedFiles === 0 ? 0 : 1)
    + (existsFile(legacyReportPath) ? 0 : 1)
    + privacyHits.length;

  console.log(`[${failures ? 'FAIL' : 'PASS'}] ArchiveData-v2 Music shape`);
  console.log(`  archiveDataV2Exists: ${existsDir(V2_ROOT)}`);
  console.log(`  albumEntryDirs: ${entryDirs.length}`);
  console.log(`  entryYamlFiles: ${entryYamlFiles}`);
  console.log(`  contentFiles: ${contentFiles}`);
  console.log(`  coverFiles: ${coverFiles}`);
  console.log(`  audioFiles: ${audioFiles}`);
  console.log(`  malformedEntryDirs: ${malformedEntryDirs}`);
  console.log(`  manifestExists: ${existsFile(manifestPath)}`);
  console.log(`  manifestParseError: ${manifest.error}`);
  console.log(`  manifestRecords: ${manifestRecords}`);
  console.log(`  unmappedExists: ${existsFile(unmappedPath)}`);
  console.log(`  unmappedParseError: ${unmapped.error}`);
  console.log(`  unmappedFiles: ${unmappedFiles}`);
  console.log(`  legacyFieldReportExists: ${existsFile(legacyReportPath)}`);
  console.log(`  privacyRuleHits: ${privacyHits.length}`);
  console.log(`  privacyRules: ${privacyHits.length ? [...new Set(privacyHits)].join(', ') : 'none'}`);
  console.log(`Result: archive data v2 music shape check ${failures ? 'failed' : 'passed'}`);
  process.exitCode = failures ? 1 : 0;
}

main();
