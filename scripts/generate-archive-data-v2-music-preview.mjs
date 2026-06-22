import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SOURCE_ROOT = 'C:\\Users\\Yu\\OneDrive\\图片\\Data';
const V2_ROOT = path.join(path.dirname(SOURCE_ROOT), 'Archive');
const V2_MUSIC_ROOT = path.join(V2_ROOT, 'entries', 'music', 'album');
const PUBLIC_MUSIC_JSON = path.join(PROJECT_ROOT, 'public', 'data', 'music.json');
const PREVIEW_ROOT = path.join(os.tmpdir(), 'yuarchive-v2-music-preview');
const PREVIEW_MUSIC_JSON = path.join(PREVIEW_ROOT, 'music.json');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac']);
const REQUIRED_ITEM_FIELDS = ['id', 'title', 'cover', 'content'];
const ITEM_FIELDS = ['id', 'title', 'cover', 'description', 'content', 'audio', 'url', 'track_title'];
const TOP_LEVEL_KEYS = ['key', 'display_name', 'total_count', 'sort_mode', 'items'];
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

function assertOutsideForbiddenTargets(targetPath) {
  const resolved = path.resolve(targetPath).toLowerCase();
  const forbidden = [
    path.join(PROJECT_ROOT, 'public', 'data'),
    path.join(PROJECT_ROOT, 'src', 'data'),
    path.join(PROJECT_ROOT, 'reports'),
    path.join(PROJECT_ROOT, 'public', 'webp_cache'),
    path.join(PROJECT_ROOT, 'public', 'audio_cache'),
    path.join(PROJECT_ROOT, 'public', 'media_cache'),
    SOURCE_ROOT,
    V2_ROOT,
  ].map(item => path.resolve(item).toLowerCase());

  for (const root of forbidden) {
    if (resolved === root || resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error('preview output target is inside a forbidden directory');
    }
  }
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
  const data = {};
  const text = fs.readFileSync(filePath, 'utf8');
  let currentObjectKey = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.includes(':')) continue;

    const indent = rawLine.length - rawLine.trimStart().length;
    const [rawKey, ...rest] = trimmed.split(':');
    const key = rawKey.trim();
    const value = parseScalar(rest.join(':'));

    if (indent === 0) {
      currentObjectKey = key;
      data[key] = value || {};
    } else if (currentObjectKey && data[currentObjectKey] && typeof data[currentObjectKey] === 'object') {
      data[currentObjectKey][key] = value;
    }
  }
  return data;
}

function findOneFile(dirPath, predicate) {
  const matches = listDirSafe(dirPath)
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(predicate)
    .sort((a, b) => a.localeCompare(b));
  return matches[0] ?? '';
}

function previewMediaPath(entryId, fileName) {
  return `v2-preview/music/album/${entryId}/${fileName}`;
}

function buildPreviewItems() {
  if (!existsDir(V2_MUSIC_ROOT)) throw new Error('v2 Music album directory missing');
  const entryDirs = listDirSafe(V2_MUSIC_ROOT)
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(V2_MUSIC_ROOT, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  const ids = new Set();
  const items = [];
  let malformedEntries = 0;

  for (const entryDir of entryDirs) {
    const entryYamlPath = path.join(entryDir, 'entry.yaml');
    const contentPath = path.join(entryDir, 'content.md');
    const coverName = findOneFile(entryDir, name => name.startsWith('cover.') && IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()));
    const audioName = findOneFile(entryDir, name => name.startsWith('audio.') && AUDIO_EXTENSIONS.has(path.extname(name).toLowerCase()));

    if (!existsFile(entryYamlPath) || !existsFile(contentPath) || !coverName || !audioName) {
      malformedEntries += 1;
      continue;
    }

    const entry = parseSimpleYaml(entryYamlPath);
    const id = String(entry.id ?? '').trim();
    if (!id || ids.has(id)) {
      malformedEntries += 1;
      continue;
    }
    ids.add(id);

    const item = {
      id,
      title: String(entry.title ?? '').trim(),
      cover: previewMediaPath(id, coverName),
      description: String(entry.description ?? '').trim(),
      content: fs.readFileSync(contentPath, 'utf8'),
      audio: previewMediaPath(id, audioName),
      url: String(entry.url ?? '').trim(),
      track_title: String(entry.track_title ?? '').trim(),
    };
    items.push(item);
  }

  return { items, malformedEntries };
}

function shapeSummary(category) {
  const topKeys = Object.keys(category).sort();
  const itemKeys = new Set();
  const missingRequired = {};
  const blankOptional = {};
  let contentNonEmpty = 0;
  let coverPresent = 0;
  let audioPresent = 0;

  for (const field of REQUIRED_ITEM_FIELDS) missingRequired[field] = 0;
  for (const field of ITEM_FIELDS.filter(field => !REQUIRED_ITEM_FIELDS.includes(field))) blankOptional[field] = 0;

  for (const item of category.items ?? []) {
    for (const key of Object.keys(item)) itemKeys.add(key);
    for (const field of REQUIRED_ITEM_FIELDS) {
      if (!String(item[field] ?? '').trim()) missingRequired[field] += 1;
    }
    for (const field of Object.keys(blankOptional)) {
      if (!String(item[field] ?? '').trim()) blankOptional[field] += 1;
    }
    if (String(item.content ?? '').trim()) contentNonEmpty += 1;
    if (String(item.cover ?? '').trim()) coverPresent += 1;
    if (String(item.audio ?? '').trim()) audioPresent += 1;
  }

  return {
    topKeys,
    itemKeys: [...itemKeys].sort(),
    itemCount: Array.isArray(category.items) ? category.items.length : 0,
    missingRequired,
    blankOptional,
    contentNonEmpty,
    coverPresent,
    audioPresent,
  };
}

function objectEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function compareWithCurrent(preview, current) {
  const previewShape = shapeSummary(preview);
  const currentShape = shapeSummary(current);
  const currentIds = new Set((current.items ?? []).map(item => item.id));
  const previewIds = (preview.items ?? []).map(item => item.id);
  const idOverlap = previewIds.filter(id => currentIds.has(id)).length;
  let orderDifferences = 0;
  for (let index = 0; index < Math.min(preview.items.length, current.items.length); index += 1) {
    if (preview.items[index]?.id !== current.items[index]?.id) orderDifferences += 1;
  }
  return {
    topLevelKeysMatch: objectEqual(previewShape.topKeys, currentShape.topKeys),
    itemFieldSetMatch: objectEqual(previewShape.itemKeys, currentShape.itemKeys),
    itemCountMatch: previewShape.itemCount === currentShape.itemCount,
    idOverlap,
    orderDifferences,
    previewShape,
    currentShape,
  };
}

function privacyHitsInText(text) {
  const hits = [];
  for (const [ruleName, pattern] of PRIVACY_RULES) {
    if (pattern.test(text)) hits.push(ruleName);
  }
  return hits;
}

function main() {
  try {
    assertOutsideForbiddenTargets(PREVIEW_MUSIC_JSON);
    if (!existsFile(PUBLIC_MUSIC_JSON)) throw new Error('current public music.json missing');

    const { items, malformedEntries } = buildPreviewItems();
    const preview = {
      key: 'music',
      display_name: '律动',
      total_count: items.length,
      sort_mode: 'music',
      items,
    };

    const serialized = `${JSON.stringify(preview, null, 2)}\n`;
    const privacyHits = privacyHitsInText(serialized);
    if (privacyHits.length) throw new Error('preview JSON contains privacy/path rule hits');

    fs.mkdirSync(PREVIEW_ROOT, { recursive: true });
    fs.writeFileSync(PREVIEW_MUSIC_JSON, serialized, 'utf8');

    const current = JSON.parse(fs.readFileSync(PUBLIC_MUSIC_JSON, 'utf8'));
    const comparison = compareWithCurrent(preview, current);
    const missingRequiredTotal = Object.values(comparison.previewShape.missingRequired).reduce((sum, value) => sum + value, 0);

    const pass = malformedEntries === 0
      && items.length === 33
      && preview.total_count === items.length
      && comparison.topLevelKeysMatch
      && comparison.itemFieldSetMatch
      && comparison.itemCountMatch
      && missingRequiredTotal === 0
      && privacyHits.length === 0;

    console.log(`[${pass ? 'PASS' : 'FAIL'}] Archive Music preview generator`);
    console.log('  previewOutput: system-temp/yuarchive-v2-music-preview/music.json');
    console.log(`  malformedEntries: ${malformedEntries}`);
    console.log(`  previewItems: ${items.length}`);
    console.log(`  currentItems: ${comparison.currentShape.itemCount}`);
    console.log(`  topLevelKeysMatch: ${comparison.topLevelKeysMatch}`);
    console.log(`  itemFieldSetMatch: ${comparison.itemFieldSetMatch}`);
    console.log(`  itemCountMatch: ${comparison.itemCountMatch}`);
    console.log(`  requiredMissing: ${missingRequiredTotal}`);
    console.log(`  contentNonEmpty: ${comparison.previewShape.contentNonEmpty}`);
    console.log(`  coverPresent: ${comparison.previewShape.coverPresent}`);
    console.log(`  audioPresent: ${comparison.previewShape.audioPresent}`);
    console.log(`  idOverlap: ${comparison.idOverlap}`);
    console.log(`  orderDifferences: ${comparison.orderDifferences}`);
    console.log(`  blankOptional: ${Object.entries(comparison.previewShape.blankOptional).map(([k, v]) => `${k}:${v}`).join(', ')}`);
    console.log(`  privacyRuleHits: ${privacyHits.length}`);
    console.log('  publicMusicJsonModified: false');
    console.log('  buildArchiveRun: false');
    console.log(`Result: archive data v2 music preview generation ${pass ? 'passed' : 'failed'}`);
    process.exitCode = pass ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Archive Music preview generator');
    console.log(`  error: ${error instanceof Error ? error.message : 'unknown error'}`);
    console.log('Result: archive data v2 music preview generation failed');
    process.exitCode = 1;
  }
}

main();
