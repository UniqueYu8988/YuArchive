import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = 'C:\\Users\\Yu\\OneDrive\\图片\\Data';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);
const CONFIG_FILES = new Set(['homepage.yaml', 'site-layout.yaml', 'site-ui.yaml']);
const BOARD_DIRS = new Map([
  ['Games', 'games'],
  ['Visions', 'visions'],
  ['Music', 'music'],
  ['Texts', 'texts'],
]);

function existsDir(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
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

function walkFiles(dirPath) {
  const output = [];
  for (const entry of listDirSafe(dirPath)) {
    const current = path.join(dirPath, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(current));
    else if (entry.isFile()) output.push(current);
  }
  return output;
}

function ext(filePath) {
  return path.extname(filePath).toLowerCase() || '[none]';
}

function relParts(filePath) {
  return path.relative(SOURCE_ROOT, filePath).split(path.sep);
}

function count(map, key, amount = 1) {
  map[key] = (map[key] ?? 0) + amount;
}

function formatCounts(map) {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(', ') || 'none';
}

function checksumFile(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return { hash: hash.digest('hex'), bytes: data.length };
}

function parseScalar(rawValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSimpleYaml(filePath) {
  const result = {};
  let currentTopKey = null;
  let errors = 0;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.replace(/\s+#.*$/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    if (trimmed.startsWith('- ')) continue;
    if (!trimmed.includes(':')) {
      errors += 1;
      continue;
    }
    const [rawKey, ...rest] = trimmed.split(':');
    const key = parseScalar(rawKey);
    const value = parseScalar(rest.join(':'));
    if (indent === 0) {
      currentTopKey = key;
      result[key] = value ? value : {};
    } else if (currentTopKey && result[currentTopKey] && typeof result[currentTopKey] === 'object') {
      result[currentTopKey][key] = value;
    }
  }
  return { data: result, errors };
}

function classifyTextKind(sectionName) {
  if (sectionName.includes('每天听本书')) return 'book_note';
  if (sectionName.includes('得到头条') || sectionName.includes('睡前消息')) return 'series_note';
  return 'article';
}

function classifyVisionKind(filePath) {
  const parts = relParts(filePath);
  if (parts[1] === '角色橱窗') return 'showcase';
  const folder = path.join(SOURCE_ROOT, 'Visions', parts[1] ?? '');
  const meta = path.join(folder, 'meta.yaml');
  if (!fs.existsSync(meta)) return 'movie';
  try {
    const parsed = parseSimpleYaml(meta).data;
    const stem = path.basename(filePath, path.extname(filePath));
    const entry = parsed[stem];
    if (entry && typeof entry === 'object' && String(entry.type ?? '').toLowerCase() === 'tv') return 'series';
  } catch {
    return 'movie';
  }
  return 'movie';
}

function classifyGameKind(filePath) {
  const parts = relParts(filePath);
  const folder = parts[1] ?? '';
  const stem = path.basename(filePath, path.extname(filePath));
  if (folder === 'Game-Live') {
    if (/^(TFT|LOL|D4)_/.test(stem)) return 'live_game_season_asset';
    if (YAML_EXTENSIONS.has(ext(filePath)) && path.basename(filePath).toLowerCase() !== 'meta.yaml') return 'live_game';
    return 'live_game_asset';
  }
  if (stem.includes('_')) return 'dlc';
  return 'normal_game';
}

function planSourceFile(filePath, plan) {
  const parts = relParts(filePath);
  const top = parts[0] ?? '';
  const extension = ext(filePath);

  if (top === 'desktop.ini') {
    count(plan.ignored, 'system_file');
    return;
  }

  if (CONFIG_FILES.has(top)) {
    count(plan.targetRoles, 'config');
    count(plan.configFiles, top);
    return;
  }

  const board = BOARD_DIRS.get(top);
  if (!board) {
    count(plan.unmapped, 'unknown_top_level');
    return;
  }

  count(plan.boardFiles, board);

  if (board === 'games') {
    if (YAML_EXTENSIONS.has(extension) && path.basename(filePath).toLowerCase() === 'meta.yaml') {
      count(plan.targetRoles, 'legacy_metadata');
      return;
    }
    const kind = classifyGameKind(filePath);
    if (kind === 'normal_game' || kind === 'dlc' || kind === 'live_game') {
      count(plan.entries, `${board}/${kind}`);
      count(plan.targetRoles, 'entry_yaml');
      if (IMAGE_EXTENSIONS.has(extension)) count(plan.targetRoles, 'cover');
      if (YAML_EXTENSIONS.has(extension)) count(plan.targetRoles, 'legacy_metadata');
      if (kind === 'dlc') count(plan.manualConfirmations, 'games.dlc_parent_mapping');
      if (kind === 'live_game') count(plan.manualConfirmations, 'games.live_game_fields');
      return;
    }
    if (kind === 'live_game_season_asset') {
      count(plan.targetRoles, 'season_asset');
      count(plan.manualConfirmations, 'games.live_season_mapping');
      return;
    }
    if (kind === 'live_game_asset') {
      count(plan.targetRoles, IMAGE_EXTENSIONS.has(extension) ? 'cover' : 'asset');
      return;
    }
  }

  if (board === 'visions') {
    const kind = classifyVisionKind(filePath);
    if (parts[1] === '角色橱窗') {
      if (YAML_EXTENSIONS.has(extension)) {
        count(plan.entries, 'visions/showcase');
        count(plan.targetRoles, 'entry_yaml');
        count(plan.targetRoles, 'legacy_metadata');
      } else if (IMAGE_EXTENSIONS.has(extension)) {
        count(plan.targetRoles, 'showcase_asset');
        count(plan.manualConfirmations, 'visions.showcase_asset_mapping');
      } else {
        count(plan.targetRoles, 'asset');
      }
      return;
    }
    if (IMAGE_EXTENSIONS.has(extension)) {
      count(plan.entries, `visions/${kind}`);
      count(plan.targetRoles, 'entry_yaml');
      count(plan.targetRoles, 'cover');
      return;
    }
    if (YAML_EXTENSIONS.has(extension)) {
      count(plan.targetRoles, 'legacy_metadata');
      return;
    }
  }

  if (board === 'music') {
    if (MARKDOWN_EXTENSIONS.has(extension)) {
      count(plan.entries, 'music/album');
      count(plan.targetRoles, 'entry_yaml');
      count(plan.targetRoles, 'content_md');
      return;
    }
    if (parts[1] === 'Covers' && IMAGE_EXTENSIONS.has(extension)) {
      count(plan.targetRoles, 'cover');
      return;
    }
    if (parts[1] === 'Songs' && AUDIO_EXTENSIONS.has(extension)) {
      count(plan.targetRoles, 'audio');
      return;
    }
    if (IMAGE_EXTENSIONS.has(extension) || AUDIO_EXTENSIONS.has(extension)) {
      count(plan.targetRoles, 'asset');
      count(plan.manualConfirmations, 'music.extra_asset_mapping');
      return;
    }
    count(plan.unmapped, 'music.other_file');
    return;
  }

  if (board === 'texts') {
    if (MARKDOWN_EXTENSIONS.has(extension)) {
      const kind = classifyTextKind(parts[1] ?? '');
      count(plan.entries, `texts/${kind}`);
      count(plan.targetRoles, 'entry_yaml');
      count(plan.targetRoles, 'content_md');
      count(plan.manualConfirmations, 'texts.section_to_kind_mapping');
      return;
    }
    if (YAML_EXTENSIONS.has(extension)) {
      count(plan.targetRoles, 'config_or_legacy_metadata');
      return;
    }
    if (IMAGE_EXTENSIONS.has(extension)) {
      count(plan.targetRoles, 'asset');
      return;
    }
  }

  count(plan.unmapped, `${board}.unclassified`);
}

function createPlan() {
  return {
    entries: {},
    targetRoles: {},
    manualConfirmations: {},
    unmapped: {},
    ignored: {},
    boardFiles: {},
    configFiles: {},
    checksumFiles: 0,
    checksumBytes: 0,
    checksumErrors: 0,
  };
}

function main() {
  if (!existsDir(SOURCE_ROOT)) {
    console.log('[FAIL] ArchiveData-v2 migration dry-run');
    console.log('  sourceRootExists: false');
    process.exitCode = 1;
    return;
  }

  const plan = createPlan();
  const files = walkFiles(SOURCE_ROOT);
  for (const file of files) {
    try {
      const checksum = checksumFile(file);
      plan.checksumFiles += 1;
      plan.checksumBytes += checksum.bytes;
    } catch {
      plan.checksumErrors += 1;
    }
    planSourceFile(file, plan);
  }

  const plannedEntries = Object.values(plan.entries).reduce((sum, value) => sum + value, 0);
  const plannedTargets = Object.values(plan.targetRoles).reduce((sum, value) => sum + value, 0);
  const manualConfirmations = Object.values(plan.manualConfirmations).reduce((sum, value) => sum + value, 0);
  const unmappedFiles = Object.values(plan.unmapped).reduce((sum, value) => sum + value, 0);
  const ignoredFiles = Object.values(plan.ignored).reduce((sum, value) => sum + value, 0);

  console.log('[PASS] ArchiveData-v2 migration dry-run');
  console.log(`  sourceFilesConsidered: ${files.length}`);
  console.log(`  checksumFiles: ${plan.checksumFiles}`);
  console.log(`  checksumBytes: ${plan.checksumBytes}`);
  console.log(`  checksumErrors: ${plan.checksumErrors}`);
  console.log(`  plannedEntries: ${plannedEntries}`);
  console.log(`  plannedTargetRoles: ${plannedTargets}`);
  console.log(`  manualConfirmations: ${manualConfirmations}`);
  console.log(`  unmappedFiles: ${unmappedFiles}`);
  console.log(`  ignoredFiles: ${ignoredFiles}`);
  console.log(`  boardFiles: ${formatCounts(plan.boardFiles)}`);
  console.log(`  configFiles: ${formatCounts(plan.configFiles)}`);
  console.log(`  entries: ${formatCounts(plan.entries)}`);
  console.log(`  targetRoles: ${formatCounts(plan.targetRoles)}`);
  console.log(`  manualConfirmationReasons: ${formatCounts(plan.manualConfirmations)}`);
  console.log(`  unmappedReasons: ${formatCounts(plan.unmapped)}`);
  console.log(`  ignoredReasons: ${formatCounts(plan.ignored)}`);
  console.log('  writeActions: 0');
  console.log('Result: archive data v2 migration dry-run completed');
}

main();
