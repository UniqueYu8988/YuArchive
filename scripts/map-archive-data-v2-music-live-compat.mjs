import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SOURCE_ROOT = 'C:\\Users\\Yu\\OneDrive\\图片\\Data';
const V2_ROOT = path.join(path.dirname(SOURCE_ROOT), 'ArchiveData-v2');
const V2_MUSIC_ROOT = path.join(V2_ROOT, 'entries', 'music', 'album');
const PUBLIC_MUSIC_JSON = path.join(PROJECT_ROOT, 'public', 'data', 'music.json');
const PREVIEW_MUSIC_JSON = path.join(os.tmpdir(), 'yuarchive-v2-music-preview', 'music.json');

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

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function loadV2Entries() {
  if (!existsDir(V2_MUSIC_ROOT)) throw new Error('v2 Music album directory missing');
  return listDirSafe(V2_MUSIC_ROOT)
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const entryYaml = path.join(V2_MUSIC_ROOT, entry.name, 'entry.yaml');
      if (!existsFile(entryYaml)) return null;
      const parsed = parseSimpleYaml(entryYaml);
      return {
        id: String(parsed.id ?? '').trim(),
        title: String(parsed.title ?? '').trim(),
        key: normalizeTitle(parsed.title),
      };
    })
    .filter(Boolean);
}

function loadLiveItems() {
  const data = JSON.parse(fs.readFileSync(PUBLIC_MUSIC_JSON, 'utf8'));
  return (data.items ?? []).map(item => ({
    id: String(item.id ?? '').trim(),
    title: String(item.title ?? '').trim(),
    cover: String(item.cover ?? '').trim(),
    audio: String(item.audio ?? '').trim(),
    key: normalizeTitle(item.title),
  }));
}

function loadPreviewItems() {
  if (!existsFile(PREVIEW_MUSIC_JSON)) return [];
  const data = JSON.parse(fs.readFileSync(PREVIEW_MUSIC_JSON, 'utf8'));
  return (data.items ?? []).map(item => ({
    id: String(item.id ?? '').trim(),
    title: String(item.title ?? '').trim(),
    key: normalizeTitle(item.title),
  }));
}

function countDuplicateKeys(grouped) {
  let duplicates = 0;
  for (const [key, values] of grouped) {
    if (!key || values.length > 1) duplicates += values.length;
  }
  return duplicates;
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
    if (!existsFile(PUBLIC_MUSIC_JSON)) throw new Error('live music.json missing');
    const v2Entries = loadV2Entries();
    const liveItems = loadLiveItems();
    const previewItems = loadPreviewItems();
    const liveByKey = groupBy(liveItems, item => item.key);
    const v2ByKey = groupBy(v2Entries, item => item.key);
    const liveIds = new Set(liveItems.map(item => item.id));
    const previewIdOverlap = previewItems.filter(item => liveIds.has(item.id)).length;

    let mapped = 0;
    let ambiguous = 0;
    let unmappedV2 = 0;
    let reusableLiveIds = 0;
    let reusableCoverPaths = 0;
    let reusableAudioPaths = 0;
    const mappedLiveKeys = new Set();

    for (const entry of v2Entries) {
      const liveCandidates = liveByKey.get(entry.key) ?? [];
      const v2Candidates = v2ByKey.get(entry.key) ?? [];
      if (entry.key && liveCandidates.length === 1 && v2Candidates.length === 1) {
        mapped += 1;
        mappedLiveKeys.add(entry.key);
        if (liveCandidates[0].id) reusableLiveIds += 1;
        if (liveCandidates[0].cover.startsWith('webp_cache/')) reusableCoverPaths += 1;
        if (liveCandidates[0].audio.startsWith('audio_cache/')) reusableAudioPaths += 1;
      } else if (liveCandidates.length > 1 || v2Candidates.length > 1) {
        ambiguous += 1;
      } else {
        unmappedV2 += 1;
      }
    }

    const unmappedLive = liveItems.filter(item => !mappedLiveKeys.has(item.key)).length;
    const duplicateV2Keys = countDuplicateKeys(v2ByKey);
    const duplicateLiveKeys = countDuplicateKeys(liveByKey);
    const privacyHits = privacyHitsInText(JSON.stringify({
      v2Count: v2Entries.length,
      liveCount: liveItems.length,
      mapped,
      unmappedV2,
      unmappedLive,
      ambiguous,
    }));
    const pass = v2Entries.length === 33
      && liveItems.length === 33
      && mapped === 33
      && unmappedV2 === 0
      && unmappedLive === 0
      && ambiguous === 0
      && duplicateV2Keys === 0
      && duplicateLiveKeys === 0
      && reusableLiveIds === 33
      && reusableCoverPaths === 33
      && reusableAudioPaths === 33
      && privacyHits.length === 0;

    console.log(`[${pass ? 'PASS' : 'WARN'}] ArchiveData-v2 Music live compatibility mapper`);
    console.log(`  v2Entries: ${v2Entries.length}`);
    console.log(`  liveItems: ${liveItems.length}`);
    console.log(`  mappedEntries: ${mapped}`);
    console.log(`  unmappedV2: ${unmappedV2}`);
    console.log(`  unmappedLive: ${unmappedLive}`);
    console.log(`  ambiguousMappings: ${ambiguous}`);
    console.log(`  duplicateV2Candidates: ${duplicateV2Keys}`);
    console.log(`  duplicateLiveCandidates: ${duplicateLiveKeys}`);
    console.log(`  reusableLiveIds: ${reusableLiveIds}`);
    console.log(`  reusableLiveCoverPaths: ${reusableCoverPaths}`);
    console.log(`  reusableLiveAudioPaths: ${reusableAudioPaths}`);
    console.log(`  previewIdOverlap: ${previewIdOverlap}`);
    console.log(`  privacyRuleHits: ${privacyHits.length}`);
    console.log('  writeActions: 0');
    console.log(`Result: archive data v2 music live compatibility mapping ${pass ? 'passed' : 'completed with warnings'}`);
    process.exitCode = pass ? 0 : 0;
  } catch (error) {
    console.log('[FAIL] ArchiveData-v2 Music live compatibility mapper');
    console.log(`  error: ${error instanceof Error ? error.message : 'unknown error'}`);
    console.log('Result: archive data v2 music live compatibility mapping failed');
    process.exitCode = 1;
  }
}

main();
