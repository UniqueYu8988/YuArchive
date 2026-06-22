import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SOURCE_ROOT = 'C:\\Users\\Yu\\OneDrive\\图片\\Data';
const V2_ROOT = path.join(path.dirname(SOURCE_ROOT), 'Archive');
const V2_MUSIC_ROOT = path.join(V2_ROOT, 'entries', 'music', 'album');
const PUBLIC_MUSIC_JSON = path.join(PROJECT_ROOT, 'public', 'data', 'music.json');
const PREVIEW_ROOT = path.join(os.tmpdir(), 'yuarchive-v2-music-live-compatible-preview');
const PREVIEW_MUSIC_JSON = path.join(PREVIEW_ROOT, 'music.json');

const REQUIRED_ITEM_FIELDS = ['id', 'title', 'cover', 'content'];
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

function normalizeTitle(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function loadV2Entries() {
  if (!existsDir(V2_MUSIC_ROOT)) throw new Error('v2 Music album directory missing');
  const entries = [];
  for (const child of listDirSafe(V2_MUSIC_ROOT).filter(entry => entry.isDirectory())) {
    const entryDir = path.join(V2_MUSIC_ROOT, child.name);
    const entryYaml = path.join(entryDir, 'entry.yaml');
    const contentMd = path.join(entryDir, 'content.md');
    if (!existsFile(entryYaml) || !existsFile(contentMd)) continue;
    const parsed = parseSimpleYaml(entryYaml);
    const title = String(parsed.title ?? '').trim();
    entries.push({
      id: String(parsed.id ?? '').trim(),
      title,
      description: String(parsed.description ?? '').trim(),
      content: fs.readFileSync(contentMd, 'utf8'),
      url: String(parsed.url ?? '').trim(),
      track_title: String(parsed.track_title ?? '').trim(),
      key: normalizeTitle(title),
    });
  }
  return entries;
}

function groupByUnique(items, keyFn) {
  const map = new Map();
  const duplicates = new Set();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (map.has(key)) duplicates.add(key);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return { map, duplicates };
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
    const live = JSON.parse(fs.readFileSync(PUBLIC_MUSIC_JSON, 'utf8'));
    const liveItems = live.items ?? [];
    const v2Entries = loadV2Entries();
    const { map: v2ByKey, duplicates: duplicateV2Keys } = groupByUnique(v2Entries, item => item.key);

    let mapped = 0;
    let unmappedLive = 0;
    let ambiguous = 0;
    let reusedLiveIds = 0;
    let reusedCoverPaths = 0;
    let reusedAudioPaths = 0;
    let requiredMissing = 0;

    const previewItems = [];
    for (const liveItem of liveItems) {
      const key = normalizeTitle(liveItem.title);
      const matches = v2ByKey.get(key) ?? [];
      if (matches.length !== 1 || duplicateV2Keys.has(key)) {
        if (matches.length > 1 || duplicateV2Keys.has(key)) ambiguous += 1;
        else unmappedLive += 1;
        continue;
      }

      const v2 = matches[0];
      const item = {
        id: String(liveItem.id ?? '').trim(),
        title: v2.title || String(liveItem.title ?? '').trim(),
        cover: String(liveItem.cover ?? '').trim(),
        description: v2.description,
        content: v2.content,
        audio: String(liveItem.audio ?? '').trim(),
        url: v2.url || String(liveItem.url ?? '').trim(),
        track_title: v2.track_title || String(liveItem.track_title ?? '').trim(),
      };

      for (const field of REQUIRED_ITEM_FIELDS) {
        if (!String(item[field] ?? '').trim()) requiredMissing += 1;
      }
      if (item.id) reusedLiveIds += 1;
      if (item.cover.startsWith('webp_cache/')) reusedCoverPaths += 1;
      if (item.audio.startsWith('audio_cache/')) reusedAudioPaths += 1;
      mapped += 1;
      previewItems.push(item);
    }

    const preview = {
      key: live.key ?? 'music',
      display_name: live.display_name ?? '律动',
      total_count: previewItems.length,
      sort_mode: 'music',
      items: previewItems,
    };

    const serialized = `${JSON.stringify(preview, null, 2)}\n`;
    const privacyHits = privacyHitsInText(serialized);
    if (privacyHits.length) throw new Error('preview JSON contains privacy/path rule hits');

    fs.mkdirSync(PREVIEW_ROOT, { recursive: true });
    fs.writeFileSync(PREVIEW_MUSIC_JSON, serialized, 'utf8');

    let orderDifferences = 0;
    for (let index = 0; index < Math.min(previewItems.length, liveItems.length); index += 1) {
      if (previewItems[index].id !== liveItems[index].id) orderDifferences += 1;
    }

    const pass = v2Entries.length === 33
      && liveItems.length === 33
      && mapped === 33
      && previewItems.length === 33
      && unmappedLive === 0
      && ambiguous === 0
      && reusedLiveIds === 33
      && reusedCoverPaths === 33
      && reusedAudioPaths === 33
      && requiredMissing === 0
      && orderDifferences === 0
      && privacyHits.length === 0;

    console.log(`[${pass ? 'PASS' : 'FAIL'}] Archive Music live-compatible preview generator`);
    console.log('  previewOutput: system-temp/yuarchive-v2-music-live-compatible-preview/music.json');
    console.log(`  v2Entries: ${v2Entries.length}`);
    console.log(`  liveItems: ${liveItems.length}`);
    console.log(`  mappedEntries: ${mapped}`);
    console.log(`  previewItems: ${previewItems.length}`);
    console.log(`  unmappedLive: ${unmappedLive}`);
    console.log(`  ambiguousMappings: ${ambiguous}`);
    console.log(`  reusedLiveIds: ${reusedLiveIds}`);
    console.log(`  reusedLiveCoverPaths: ${reusedCoverPaths}`);
    console.log(`  reusedLiveAudioPaths: ${reusedAudioPaths}`);
    console.log(`  requiredMissing: ${requiredMissing}`);
    console.log(`  orderDifferences: ${orderDifferences}`);
    console.log(`  privacyRuleHits: ${privacyHits.length}`);
    console.log('  publicMusicJsonModified: false');
    console.log('  buildArchiveRun: false');
    console.log(`Result: archive data v2 music live-compatible preview generation ${pass ? 'passed' : 'failed'}`);
    process.exitCode = pass ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Archive Music live-compatible preview generator');
    console.log(`  error: ${error instanceof Error ? error.message : 'unknown error'}`);
    console.log('Result: archive data v2 music live-compatible preview generation failed');
    process.exitCode = 1;
  }
}

main();
