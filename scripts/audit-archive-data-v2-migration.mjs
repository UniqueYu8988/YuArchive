import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = 'C:\\Users\\Yu\\OneDrive\\图片\\Data';
const BOARDS = ['games', 'visions', 'music', 'texts'];
const BOARD_DIRS = {
  games: 'Games',
  visions: 'Visions',
  music: 'Music',
  texts: 'Texts',
};

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);
const GAME_LIVE_FOLDER = 'Game-Live';
const VISIONS_SHOWCASE_FOLDER = '角色橱窗';

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

function walkFiles(dirPath, predicate = () => true) {
  const output = [];
  for (const entry of listDirSafe(dirPath)) {
    const current = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      output.push(...walkFiles(current, predicate));
    } else if (entry.isFile() && predicate(current)) {
      output.push(current);
    }
  }
  return output;
}

function immediateDirs(dirPath) {
  return listDirSafe(dirPath)
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(dirPath, entry.name));
}

function immediateFiles(dirPath, predicate = () => true) {
  return listDirSafe(dirPath)
    .filter(entry => entry.isFile())
    .map(entry => path.join(dirPath, entry.name))
    .filter(predicate);
}

function extensionOf(filePath) {
  return path.extname(filePath).toLowerCase() || '[none]';
}

function countByExtension(files) {
  const counts = {};
  for (const file of files) {
    const ext = extensionOf(file);
    counts[ext] = (counts[ext] ?? 0) + 1;
  }
  return counts;
}

function normalizeTitle(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function parseScalar(rawValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true' || trimmed === 'yes') return true;
  if (trimmed === 'false' || trimmed === 'no') return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(part => normalizeTitle(parseScalar(part))).filter(Boolean);
  }
  return trimmed;
}

function parseSimpleYaml(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const result = {};
  const keys = new Set();
  const nestedKeys = new Set();
  let currentTopKey = null;
  let currentNestedKey = null;
  let errors = 0;

  text.split(/\r?\n/).forEach(rawLine => {
    const withoutComment = rawLine.replace(/\s+#.*$/, '');
    const trimmed = withoutComment.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const indent = rawLine.length - rawLine.trimStart().length;
    if (trimmed.startsWith('- ')) {
      if (!currentTopKey) {
        errors += 1;
        return;
      }
      if (!Array.isArray(result[currentTopKey])) result[currentTopKey] = [];
      result[currentTopKey].push(parseScalar(trimmed.slice(2)));
      return;
    }

    if (!trimmed.includes(':')) {
      errors += 1;
      return;
    }

    const [rawKey, ...rest] = trimmed.split(':');
    const key = normalizeTitle(parseScalar(rawKey));
    const valueText = rest.join(':').trim();
    if (!key) {
      errors += 1;
      return;
    }

    if (indent === 0) {
      currentTopKey = key;
      currentNestedKey = null;
      keys.add(key);
      result[key] = valueText ? parseScalar(valueText) : {};
      return;
    }

    if (!currentTopKey) {
      errors += 1;
      return;
    }

    nestedKeys.add(key);
    if (indent === 2 && trimmed.endsWith(':') && !valueText) {
      if (!result[currentTopKey] || Array.isArray(result[currentTopKey]) || typeof result[currentTopKey] !== 'object') {
        result[currentTopKey] = {};
      }
      currentNestedKey = key;
      result[currentTopKey][key] = {};
      return;
    }

    if (!result[currentTopKey] || Array.isArray(result[currentTopKey]) || typeof result[currentTopKey] !== 'object') {
      result[currentTopKey] = {};
    }

    if (indent >= 4 && currentNestedKey) {
      result[currentTopKey][currentNestedKey][key] = parseScalar(valueText);
      return;
    }

    result[currentTopKey][key] = parseScalar(valueText);
  });

  return { data: result, keys, nestedKeys, errors };
}

function parseFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const keys = new Set();
  let errors = 0;

  if (lines[0]?.trim() !== '---') {
    return { keys, hasFrontmatter: false, errors };
  }

  let closed = false;
  for (let index = 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed === '---') {
      closed = true;
      break;
    }
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.includes(':')) {
      errors += 1;
      continue;
    }
    const [rawKey] = trimmed.split(':');
    const key = rawKey.trim().toLowerCase();
    if (key) keys.add(key);
  }

  if (!closed) errors += 1;
  return { keys, hasFrontmatter: true, errors };
}

function mergeSet(target, source) {
  for (const value of source) target.add(value);
}

function isLikelyFieldKey(value) {
  return /^[a-z][a-z0-9_]*$/i.test(String(value ?? ''));
}

function mergeLikelyFieldKeys(target, source) {
  for (const value of source) {
    if (isLikelyFieldKey(value)) target.add(value);
  }
}

function formatCounts(counts) {
  const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([key, value]) => `${key}:${value}`).join(', ') || 'none';
}

function formatSet(set) {
  return [...set].sort((a, b) => a.localeCompare(b)).join(', ') || 'none';
}

function sanitizeConfigKey(key) {
  if (String(key).startsWith('games_season_priority_')) return 'games_season_priority_*';
  return key;
}

function countImageFiles(dirPath) {
  return walkFiles(dirPath, file => IMAGE_EXTENSIONS.has(extensionOf(file))).length;
}

function auditGames() {
  const root = path.join(SOURCE_ROOT, BOARD_DIRS.games);
  const files = existsDir(root) ? walkFiles(root) : [];
  const dirs = existsDir(root) ? immediateDirs(root) : [];
  const imageFiles = files.filter(file => IMAGE_EXTENSIONS.has(extensionOf(file)));
  const yamlFiles = files.filter(file => YAML_EXTENSIONS.has(extensionOf(file)));
  const metaFiles = yamlFiles.filter(file => path.basename(file).toLowerCase() === 'meta.yaml');
  const standaloneLiveYaml = yamlFiles.filter(file => path.basename(path.dirname(file)) === GAME_LIVE_FOLDER && path.basename(file).toLowerCase() !== 'meta.yaml');
  const fieldKeys = new Set();
  let yamlErrors = 0;
  let normalGameCandidates = 0;
  let dlcCandidates = 0;
  let liveSeasonImageCandidates = 0;

  for (const image of imageFiles) {
    const parent = path.basename(path.dirname(image));
    const stem = path.basename(image, path.extname(image));
    if (parent === GAME_LIVE_FOLDER) {
      if (/^(TFT|LOL|D4)_/.test(stem)) liveSeasonImageCandidates += 1;
      continue;
    }
    if (stem.includes('_')) dlcCandidates += 1;
    else normalGameCandidates += 1;
  }

  for (const meta of metaFiles) {
    try {
      const parsed = parseSimpleYaml(meta);
      yamlErrors += parsed.errors;
      mergeLikelyFieldKeys(fieldKeys, parsed.nestedKeys);
    } catch {
      yamlErrors += 1;
    }
  }

  for (const live of standaloneLiveYaml) {
    try {
      const parsed = parseSimpleYaml(live);
      yamlErrors += parsed.errors;
      mergeLikelyFieldKeys(fieldKeys, parsed.keys);
      mergeLikelyFieldKeys(fieldKeys, parsed.nestedKeys);
    } catch {
      yamlErrors += 1;
    }
  }

  return {
    board: 'games',
    topLevelDirs: dirs.length,
    sourceFiles: files.length,
    extensions: countByExtension(files),
    likelyKinds: {
      normal_game: normalGameCandidates,
      dlc: dlcCandidates,
      live_game: standaloneLiveYaml.length,
      live_game_season_assets: liveSeasonImageCandidates,
    },
    metadataFiles: yamlFiles.length,
    parseErrors: yamlErrors,
    fieldKeys,
    manualConfirmations: {
      dlcParentMapping: dlcCandidates,
      liveSeasonMapping: liveSeasonImageCandidates,
    },
  };
}

function auditVisions() {
  const root = path.join(SOURCE_ROOT, BOARD_DIRS.visions);
  const files = existsDir(root) ? walkFiles(root) : [];
  const dirs = existsDir(root) ? immediateDirs(root) : [];
  const imageFiles = files.filter(file => IMAGE_EXTENSIONS.has(extensionOf(file)));
  const yamlFiles = files.filter(file => YAML_EXTENSIONS.has(extensionOf(file)));
  const fieldKeys = new Set();
  let yamlErrors = 0;
  let showcaseMedia = 0;
  let normalVisualEntries = 0;
  let movieLike = 0;
  let seriesLike = 0;

  for (const image of imageFiles) {
    const topFolder = path.relative(root, image).split(path.sep)[0];
    if (topFolder === VISIONS_SHOWCASE_FOLDER) {
      showcaseMedia += 1;
    } else {
      normalVisualEntries += 1;
    }
  }

  for (const yaml of yamlFiles) {
    try {
      const parsed = parseSimpleYaml(yaml);
      yamlErrors += parsed.errors;
      mergeLikelyFieldKeys(fieldKeys, parsed.nestedKeys);
      if ('title' in parsed.data) fieldKeys.add('title');
      if ('description' in parsed.data) fieldKeys.add('description');
      for (const value of Object.values(parsed.data)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (String(value.type ?? '').toLowerCase() === 'tv') seriesLike += 1;
          if (String(value.type ?? '').toLowerCase() === 'movie') movieLike += 1;
        }
      }
    } catch {
      yamlErrors += 1;
    }
  }

  return {
    board: 'visions',
    topLevelDirs: dirs.length,
    sourceFiles: files.length,
    extensions: countByExtension(files),
    likelyKinds: {
      movie: normalVisualEntries,
      series: seriesLike,
      showcase: existsDir(path.join(root, VISIONS_SHOWCASE_FOLDER)) ? 1 : 0,
      showcase_assets: showcaseMedia,
    },
    metadataFiles: yamlFiles.length,
    parseErrors: yamlErrors,
    fieldKeys,
    manualConfirmations: {
      movieOrSeriesKind: Math.max(0, normalVisualEntries - movieLike - seriesLike),
      showcaseAssetMapping: showcaseMedia,
    },
  };
}

function auditMusic() {
  const root = path.join(SOURCE_ROOT, BOARD_DIRS.music);
  const files = existsDir(root) ? walkFiles(root) : [];
  const markdownFiles = existsDir(root)
    ? immediateFiles(root, file => MARKDOWN_EXTENSIONS.has(extensionOf(file)))
    : [];
  const fieldKeys = new Set();
  let frontmatterErrors = 0;
  let withFrontmatter = 0;

  for (const markdown of markdownFiles) {
    try {
      const parsed = parseFrontmatter(markdown);
      if (parsed.hasFrontmatter) withFrontmatter += 1;
      frontmatterErrors += parsed.errors;
      mergeSet(fieldKeys, parsed.keys);
    } catch {
      frontmatterErrors += 1;
    }
  }

  const coverFiles = existsDir(path.join(root, 'Covers'))
    ? immediateFiles(path.join(root, 'Covers'), file => IMAGE_EXTENSIONS.has(extensionOf(file))).length
    : 0;
  const songFiles = existsDir(path.join(root, 'Songs'))
    ? immediateFiles(path.join(root, 'Songs'), file => AUDIO_EXTENSIONS.has(extensionOf(file))).length
    : 0;

  return {
    board: 'music',
    topLevelDirs: existsDir(root) ? immediateDirs(root).length : 0,
    sourceFiles: files.length,
    extensions: countByExtension(files),
    likelyKinds: {
      album: markdownFiles.length,
      track: 0,
      cover_assets: coverFiles,
      audio_assets: songFiles,
    },
    metadataFiles: markdownFiles.length,
    parseErrors: frontmatterErrors,
    frontmatterFiles: withFrontmatter,
    fieldKeys,
    manualConfirmations: {
      albumVsTrackKind: 0,
      multiAudioEntries: 0,
    },
  };
}

function auditTexts() {
  const root = path.join(SOURCE_ROOT, BOARD_DIRS.texts);
  const files = existsDir(root) ? walkFiles(root) : [];
  const markdownFiles = files.filter(file => MARKDOWN_EXTENSIONS.has(extensionOf(file)));
  const yamlFiles = files.filter(file => YAML_EXTENSIONS.has(extensionOf(file)));
  const fieldKeys = new Set();
  let frontmatterErrors = 0;
  let withFrontmatter = 0;
  let bookNoteCandidates = 0;
  let seriesNoteCandidates = 0;
  let articleCandidates = 0;

  for (const markdown of markdownFiles) {
    const relParts = path.relative(root, markdown).split(path.sep);
    const section = relParts[0] ?? '';
    if (section.includes('每天听本书')) bookNoteCandidates += 1;
    else if (section.includes('得到头条') || section.includes('睡前消息')) seriesNoteCandidates += 1;
    else articleCandidates += 1;

    try {
      const parsed = parseFrontmatter(markdown);
      if (parsed.hasFrontmatter) withFrontmatter += 1;
      frontmatterErrors += parsed.errors;
      mergeSet(fieldKeys, parsed.keys);
    } catch {
      frontmatterErrors += 1;
    }
  }

  let yamlErrors = 0;
  for (const yaml of yamlFiles) {
    try {
      const parsed = parseSimpleYaml(yaml);
      yamlErrors += parsed.errors;
      mergeLikelyFieldKeys(fieldKeys, parsed.nestedKeys);
    } catch {
      yamlErrors += 1;
    }
  }

  return {
    board: 'texts',
    topLevelDirs: existsDir(root) ? immediateDirs(root).length : 0,
    sourceFiles: files.length,
    extensions: countByExtension(files),
    likelyKinds: {
      article: articleCandidates,
      book_note: bookNoteCandidates,
      series_note: seriesNoteCandidates,
    },
    metadataFiles: markdownFiles.length + yamlFiles.length,
    parseErrors: frontmatterErrors + yamlErrors,
    frontmatterFiles: withFrontmatter,
    fieldKeys,
    manualConfirmations: {
      sectionToKindMapping: markdownFiles.length,
    },
  };
}

function auditConfig() {
  const files = ['homepage.yaml', 'site-layout.yaml', 'site-ui.yaml'];
  const config = {};
  let parseErrors = 0;
  const keys = new Set();
  for (const name of files) {
    const filePath = path.join(SOURCE_ROOT, name);
    if (!existsFile(filePath)) {
      config[name] = { exists: false, entries: 0 };
      parseErrors += 1;
      continue;
    }
    try {
      const parsed = parseSimpleYaml(filePath);
      parseErrors += parsed.errors;
      for (const key of parsed.keys) keys.add(sanitizeConfigKey(key));
      const entries = Object.values(parsed.data).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
      config[name] = { exists: true, entries };
    } catch {
      config[name] = { exists: true, entries: 0 };
      parseErrors += 1;
    }
  }
  return { config, parseErrors, keys };
}

function printBoardAudit(audit) {
  console.log(`[BOARD] ${audit.board}`);
  console.log(`  sourceFiles: ${audit.sourceFiles}`);
  console.log(`  topLevelDirs: ${audit.topLevelDirs}`);
  console.log(`  extensions: ${formatCounts(audit.extensions)}`);
  console.log(`  likelyKinds: ${formatCounts(audit.likelyKinds)}`);
  console.log(`  metadataFiles: ${audit.metadataFiles}`);
  if ('frontmatterFiles' in audit) console.log(`  frontmatterFiles: ${audit.frontmatterFiles}`);
  console.log(`  parseErrors: ${audit.parseErrors}`);
  console.log(`  fieldKeys: ${formatSet(audit.fieldKeys)}`);
  console.log(`  manualConfirmations: ${formatCounts(audit.manualConfirmations)}`);
}

function main() {
  const missingBoards = BOARDS.filter(board => !existsDir(path.join(SOURCE_ROOT, BOARD_DIRS[board])));
  if (missingBoards.length) {
    console.log('[FAIL] Archive migration audit');
    console.log(`  missingBoards: ${missingBoards.length}`);
    process.exitCode = 1;
    return;
  }

  const audits = [auditGames(), auditVisions(), auditMusic(), auditTexts()];
  const configAudit = auditConfig();
  const totalFiles = audits.reduce((sum, audit) => sum + audit.sourceFiles, 0);
  const totalParseErrors = audits.reduce((sum, audit) => sum + audit.parseErrors, 0) + configAudit.parseErrors;
  const totalManualConfirmations = audits.reduce(
    (sum, audit) => sum + Object.values(audit.manualConfirmations).reduce((inner, value) => inner + value, 0),
    0,
  );

  console.log('[PASS] Archive read-only migration audit');
  console.log(`  sourceBoards: ${BOARDS.length}`);
  console.log(`  totalSourceFiles: ${totalFiles}`);
  console.log(`  totalParseErrors: ${totalParseErrors}`);
  console.log(`  totalManualConfirmations: ${totalManualConfirmations}`);
  console.log(`  configKeys: ${formatSet(configAudit.keys)}`);
  for (const [name, value] of Object.entries(configAudit.config)) {
    console.log(`  config.${name}.exists: ${value.exists}`);
    console.log(`  config.${name}.listEntries: ${value.entries}`);
  }

  for (const audit of audits) {
    printBoardAudit(audit);
  }

  console.log('Result: archive data v2 migration audit completed');
}

main();
