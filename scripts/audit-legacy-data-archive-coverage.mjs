import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const LEGACY_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');
const ARCHIVE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Archive');
const PROJECT_ROOT = process.cwd();

const BOARDS = ['Games', 'Visions', 'Music', 'Texts'];
const BOARD_MAP = {
  Games: 'games',
  Visions: 'visions',
  Music: 'music',
  Texts: 'texts',
};

const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov']);
const MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS]);

const SCAN_ROOTS = ['scripts', 'src', 'docs'];
const DIRECT_SCAN_FILES = ['build_archive.py', '一键发布到云端.bat', 'AGENTS.md', 'README.md', 'PRODUCT.md', 'ARCHITECTURE.md', 'CURRENT_STATE.md'];
const TEXT_FILE_EXTENSIONS = new Set(['.mjs', '.js', '.ts', '.tsx', '.py', '.bat', '.md', '.json']);

function existsDir(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function existsFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function listDirSafe(target) {
  try {
    return fs.readdirSync(target, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walkFiles(root) {
  const files = [];
  for (const entry of listDirSafe(root)) {
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(current));
    else if (entry.isFile()) files.push(current);
  }
  return files;
}

function extensionOf(filePath) {
  return path.extname(filePath).toLowerCase();
}

function countLegacyBoard(board) {
  const boardRoot = path.join(LEGACY_ROOT, board);
  if (!existsDir(boardRoot)) {
    return { exists: false, files: 0, yaml: 0, markdown: 0, images: 0, audio: 0, video: 0, media: 0, other: 0 };
  }
  const files = walkFiles(boardRoot);
  let yaml = 0;
  let markdown = 0;
  let images = 0;
  let audio = 0;
  let video = 0;
  let media = 0;
  let other = 0;
  for (const file of files) {
    const ext = extensionOf(file);
    if (YAML_EXTENSIONS.has(ext)) yaml += 1;
    else if (ext === '.md') markdown += 1;
    else if (IMAGE_EXTENSIONS.has(ext)) {
      images += 1;
      media += 1;
    } else if (AUDIO_EXTENSIONS.has(ext)) {
      audio += 1;
      media += 1;
    } else if (VIDEO_EXTENSIONS.has(ext)) {
      video += 1;
      media += 1;
    } else {
      other += 1;
    }
  }
  return { exists: true, files: files.length, yaml, markdown, images, audio, video, media, other };
}

function countArchiveBoard(board) {
  const archiveBoard = BOARD_MAP[board];
  const boardRoot = path.join(ARCHIVE_ROOT, 'entries', archiveBoard);
  if (!existsDir(boardRoot)) {
    return {
      exists: false,
      files: 0,
      kinds: {},
      entries: 0,
      entryYaml: 0,
      contentMd: 0,
      yaml: 0,
      images: 0,
      audio: 0,
      video: 0,
      media: 0,
      migrationFiles: 0,
    };
  }
  const files = walkFiles(boardRoot);
  const kinds = {};
  for (const kindEntry of listDirSafe(boardRoot).filter(entry => entry.isDirectory())) {
    const kindRoot = path.join(boardRoot, kindEntry.name);
    kinds[kindEntry.name] = listDirSafe(kindRoot).filter(entry => entry.isDirectory()).length;
  }
  let entryYaml = 0;
  let contentMd = 0;
  let yaml = 0;
  let images = 0;
  let audio = 0;
  let video = 0;
  let media = 0;
  for (const file of files) {
    const ext = extensionOf(file);
    const base = path.basename(file);
    if (base === 'entry.yaml') entryYaml += 1;
    if (base === 'content.md') contentMd += 1;
    if (YAML_EXTENSIONS.has(ext)) yaml += 1;
    if (IMAGE_EXTENSIONS.has(ext)) {
      images += 1;
      media += 1;
    } else if (AUDIO_EXTENSIONS.has(ext)) {
      audio += 1;
      media += 1;
    } else if (VIDEO_EXTENSIONS.has(ext)) {
      video += 1;
      media += 1;
    }
  }
  const migrationRoot = path.join(ARCHIVE_ROOT, 'migration', archiveBoard);
  const migrationFiles = existsDir(migrationRoot) ? walkFiles(migrationRoot).length : 0;
  return {
    exists: true,
    files: files.length,
    kinds,
    entries: Object.values(kinds).reduce((sum, count) => sum + count, 0),
    entryYaml,
    contentMd,
    yaml,
    images,
    audio,
    video,
    media,
    migrationFiles,
  };
}

function listArchiveConfig() {
  const configRoot = path.join(ARCHIVE_ROOT, 'config');
  if (!existsDir(configRoot)) return [];
  return listDirSafe(configRoot)
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function collectProjectTextFiles() {
  const files = [];
  for (const rootName of SCAN_ROOTS) {
    const root = path.join(PROJECT_ROOT, rootName);
    if (existsDir(root)) files.push(...walkFiles(root));
  }
  for (const fileName of DIRECT_SCAN_FILES) {
    const filePath = path.join(PROJECT_ROOT, fileName);
    if (existsFile(filePath)) files.push(filePath);
  }
  return [...new Set(files)].filter(file => TEXT_FILE_EXTENSIONS.has(extensionOf(file)));
}

function classifyDependency(relativePath, text) {
  if (relativePath === 'build_archive.py') return 'legacy_generator';
  if (relativePath === '一键发布到云端.bat') return 'legacy_publish_path';
  if (/archive-studio/i.test(relativePath) || /smoke-test/i.test(relativePath)) return 'studio_or_smoke_safety';
  if (/audit|check|dry-run|plan|migrate|map|generate/i.test(relativePath)) return 'migration_audit_or_check';
  if (/\.md$/i.test(relativePath)) return 'documentation';
  if (/src[\\/]/i.test(relativePath)) return 'frontend_or_server_code';
  return 'other';
}

function scanLegacyDependencies() {
  const dependencyPatterns = [
    /OneDrive['"`\s,)\]]+['"`]?图片['"`\s,)\]]+['"`]?Data/i,
    /OneDrive[\\/]+图片[\\/]+Data/i,
    /C:[\\/]+Users[\\/]+Yu[\\/]+OneDrive[\\/]+图片[\\/]+Data/i,
    /ARCHIVE_SOURCE_ROOT/,
    /ONEDRIVE_DATA_ROOT/,
    /build_archive\.py/,
    /一键发布到云端/,
  ];
  const byCategory = {};
  const files = [];
  for (const file of collectProjectTextFiles()) {
    let text = '';
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!dependencyPatterns.some(pattern => pattern.test(text))) continue;
    const relativePath = path.relative(PROJECT_ROOT, file).replace(/\\/g, '/');
    const category = classifyDependency(relativePath, text);
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    files.push({ file: relativePath, category });
  }
  files.sort((a, b) => a.file.localeCompare(b.file));
  return { totalFiles: files.length, byCategory, files };
}

function readProjectText(relativePath) {
  try {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
  } catch {
    return '';
  }
}

function legacyEntryPointsAreGuarded() {
  const buildText = readProjectText('build_archive.py');
  const publishText = readProjectText('一键发布到云端.bat');
  return {
    legacyGeneratorGuarded: /YUARCHIVE_LEGACY_BUILD_CONFIRMATION/.test(buildText) && /RUN_LEGACY_BUILD_ARCHIVE/.test(buildText),
    legacyPublishGuarded: /PUBLISH_LEGACY_YUARCHIVE/.test(publishText),
  };
}

export function evaluateLegacyDataArchiveCoverage() {
  const legacyBoards = Object.fromEntries(BOARDS.map(board => [board, countLegacyBoard(board)]));
  const archiveBoards = Object.fromEntries(BOARDS.map(board => [BOARD_MAP[board], countArchiveBoard(board)]));
  const configFiles = listArchiveConfig();
  const dependencies = scanLegacyDependencies();
  const guardedEntryPoints = legacyEntryPointsAreGuarded();
  const missingLegacyBoards = BOARDS.filter(board => !legacyBoards[board].exists);
  const missingArchiveBoards = BOARDS.filter(board => !archiveBoards[BOARD_MAP[board]].exists);
  const archiveHasAllBoards = missingArchiveBoards.length === 0;
  const archiveHasConfigs = configFiles.length > 0;
  const blockingDependencyCategories = ['legacy_generator', 'legacy_publish_path'];
  const blockingDependencies = Object.entries(dependencies.byCategory)
    .filter(([category]) => {
      if (!blockingDependencyCategories.includes(category)) return false;
      if (category === 'legacy_generator') return !guardedEntryPoints.legacyGeneratorGuarded;
      if (category === 'legacy_publish_path') return !guardedEntryPoints.legacyPublishGuarded;
      return true;
    })
    .reduce((sum, [, count]) => sum + count, 0);
  const retirementReady = (
    missingLegacyBoards.length === 0
    && archiveHasAllBoards
    && archiveHasConfigs
    && blockingDependencies === 0
  );

  return {
    ok: true,
    retirementReady,
    roots: {
      legacyDataExists: existsDir(LEGACY_ROOT),
      archiveExists: existsDir(ARCHIVE_ROOT),
    },
    legacyBoards,
    archiveBoards,
    archiveConfigFiles: configFiles,
    dependencies,
    guardedEntryPoints,
    blockers: {
      missingLegacyBoards,
      missingArchiveBoards,
      blockingDependencies,
      reason: retirementReady
        ? 'no_blocker_detected_by_this_audit'
        : 'legacy_data_still_needed_as_readonly_baseline_or_legacy_dependency',
    },
  };
}

function formatKindCounts(kinds) {
  const entries = Object.entries(kinds);
  if (!entries.length) return 'none';
  return entries.map(([kind, count]) => `${kind}:${count}`).join(', ');
}

function printResult(result) {
  console.log('[PASS] Legacy Data / Archive coverage audit completed');
  console.log(`  retirementReady: ${result.retirementReady}`);
  console.log(`  legacyDataExists: ${result.roots.legacyDataExists}`);
  console.log(`  archiveExists: ${result.roots.archiveExists}`);
  console.log('');
  console.log('Legacy Data boards:');
  for (const board of BOARDS) {
    const item = result.legacyBoards[board];
    console.log(`  ${board}: exists=${item.exists} files=${item.files} yaml=${item.yaml} md=${item.markdown} media=${item.media} images=${item.images} audio=${item.audio} video=${item.video} other=${item.other}`);
  }
  console.log('');
  console.log('Archive boards:');
  for (const board of BOARDS) {
    const key = BOARD_MAP[board];
    const item = result.archiveBoards[key];
    console.log(`  ${key}: exists=${item.exists} entries=${item.entries} kinds=${formatKindCounts(item.kinds)} files=${item.files} entryYaml=${item.entryYaml} contentMd=${item.contentMd} media=${item.media} images=${item.images} audio=${item.audio} video=${item.video} migrationFiles=${item.migrationFiles}`);
  }
  console.log('');
  console.log(`Archive config files: ${result.archiveConfigFiles.length ? result.archiveConfigFiles.join(', ') : 'none'}`);
  console.log('');
  console.log(`Legacy dependency files: ${result.dependencies.totalFiles}`);
  for (const [category, count] of Object.entries(result.dependencies.byCategory).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${category}: ${count}`);
  }
  console.log('');
  console.log(`Legacy generator guarded: ${result.guardedEntryPoints.legacyGeneratorGuarded}`);
  console.log(`Legacy publish guarded: ${result.guardedEntryPoints.legacyPublishGuarded}`);
  console.log('');
  console.log(`Blocking dependencies: ${result.blockers.blockingDependencies}`);
  console.log(`Result: ${result.blockers.reason}`);
}

function main() {
  const result = evaluateLegacyDataArchiveCoverage();
  printResult(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
