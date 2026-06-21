import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseTextEntryYaml, parseSectionsConfig } from './archive-data-v2-texts-core.mjs';
import { parseFlatYaml } from './archive-data-v2-visions-core.mjs';
import { parseV2GameYaml } from './archive-data-v2-games-core.mjs';

const BOARDS = new Set(['music', 'texts', 'visions', 'games']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac']);
const PRIVACY_RULES = [
  /[A-Za-z]:[\\/]+Users[\\/]/i,
  /OneDrive/i,
  /Data backup/i,
  /\b(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i,
];

function existsFile(filePath) {
  try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

function listDirs(root) {
  try { return fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory()); } catch { return []; }
}

function listFiles(root) {
  try { return fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isFile()); } catch { return []; }
}

function parseScalar(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text); } catch { return text.slice(1, -1); }
  }
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1);
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function parseMusicYaml(filePath) {
  const data = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;
    if (rawLine.length !== rawLine.trimStart().length) continue;
    const colon = rawLine.indexOf(':');
    if (colon < 0) continue;
    data[rawLine.slice(0, colon).trim()] = parseScalar(rawLine.slice(colon + 1));
  }
  return data;
}

function normalizeTitle(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
}

function findAsset(entryRoot, stem, extensions) {
  const matches = listFiles(entryRoot).filter(item => (
    path.basename(item.name, path.extname(item.name)) === stem
    && extensions.has(path.extname(item.name).toLowerCase())
  ));
  if (matches.length !== 1) throw new Error(`${stem}_asset_count_invalid`);
  return path.join(entryRoot, matches[0].name);
}

function optionalAsset(entryRoot, stem, extensions) {
  const matches = listFiles(entryRoot).filter(item => (
    path.basename(item.name, path.extname(item.name)) === stem
    && extensions.has(path.extname(item.name).toLowerCase())
  ));
  if (matches.length > 1) throw new Error(`${stem}_asset_count_invalid`);
  return matches.length ? path.join(entryRoot, matches[0].name) : '';
}

function publicMedia(board, id, sourcePath) {
  const name = path.basename(sourcePath);
  const relativePath = path.posix.join('studio_media', board, id, name);
  const bytes = fs.statSync(sourcePath).size;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
  return { sourcePath, relativePath, publicPath: relativePath, bytes, sha256 };
}

function markdownExcerpt(markdown, fallback = '') {
  const text = String(markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 160) || String(fallback ?? '');
}

function loadMusic(v2Root) {
  const root = path.join(v2Root, 'entries', 'music', 'album');
  return listDirs(root).map(child => {
    const entryRoot = path.join(root, child.name);
    const fields = parseMusicYaml(path.join(entryRoot, 'entry.yaml'));
    const content = fs.readFileSync(path.join(entryRoot, 'content.md'), 'utf8');
    return {
      id: child.name,
      fingerprint: normalizeTitle(fields.title),
      fields,
      content,
      media: [
        publicMedia('music', child.name, findAsset(entryRoot, 'cover', IMAGE_EXTENSIONS)),
        publicMedia('music', child.name, findAsset(entryRoot, 'audio', AUDIO_EXTENSIONS)),
      ],
    };
  });
}

function loadTexts(v2Root) {
  const root = path.join(v2Root, 'entries', 'texts');
  const entries = [];
  for (const kind of listDirs(root)) {
    for (const child of listDirs(path.join(root, kind.name))) {
      const entryRoot = path.join(root, kind.name, child.name);
      const parsed = parseTextEntryYaml(path.join(entryRoot, 'entry.yaml'));
      if (parsed.errors) throw new Error('texts_entry_yaml_invalid');
      const fields = parsed.data;
      const content = fs.readFileSync(path.join(entryRoot, 'content.md'), 'utf8');
      const cover = optionalAsset(entryRoot, 'cover', IMAGE_EXTENSIONS);
      entries.push({
        id: child.name,
        kind: kind.name,
        fingerprint: `${fields.section}\0${normalizeTitle(fields.title)}\0${fields.date ?? ''}`,
        fields,
        content,
        media: cover ? [publicMedia('texts', child.name, cover)] : [],
      });
    }
  }
  return entries;
}

function loadVisions(v2Root) {
  const root = path.join(v2Root, 'entries', 'visions');
  const entries = [];
  for (const kind of ['movie', 'series']) {
    for (const child of listDirs(path.join(root, kind))) {
      const entryRoot = path.join(root, kind, child.name);
      const parsed = parseFlatYaml(path.join(entryRoot, 'entry.yaml'));
      if (parsed.errors) throw new Error('visions_entry_yaml_invalid');
      const fields = parsed.data;
      entries.push({
        id: child.name,
        kind,
        fingerprint: `${fields.period}\0${normalizeTitle(fields.title)}`,
        fields,
        media: [publicMedia('visions', child.name, findAsset(entryRoot, 'poster', IMAGE_EXTENSIONS))],
      });
    }
  }
  return entries;
}

function loadGames(v2Root) {
  const root = path.join(v2Root, 'entries', 'games');
  const entries = [];
  for (const kind of ['normal_game', 'dlc', 'live_game']) {
    for (const child of listDirs(path.join(root, kind))) {
      const entryRoot = path.join(root, kind, child.name);
      const parsed = parseV2GameYaml(path.join(entryRoot, 'entry.yaml'));
      if (parsed.errors.length) throw new Error('games_entry_yaml_invalid');
      const fields = parsed.data;
      const fingerprint = kind === 'live_game'
        ? `live\0${normalizeTitle(fields.title)}`
        : `${kind}\0${Number(fields.year)}\0${normalizeTitle(fields.title)}`;
      const cover = kind === 'live_game'
        ? optionalAsset(entryRoot, 'cover', IMAGE_EXTENSIONS)
        : findAsset(entryRoot, 'cover', IMAGE_EXTENSIONS);
      entries.push({
        id: child.name,
        kind,
        fingerprint,
        fields,
        media: cover ? [publicMedia('games', child.name, cover)] : [],
      });
    }
  }
  return entries;
}

function liveFingerprints(board, live) {
  if (board === 'music') return new Set((live.items ?? []).map(item => normalizeTitle(item.title)));
  if (board === 'texts') return new Set((live.items ?? []).map(item => (
    `${item.section}\0${normalizeTitle(item.title)}\0${item.date ?? ''}`
  )));
  if (board === 'visions') return new Set((live.years ?? []).flatMap(group => (
    (group.items ?? []).map(item => `${group.folder}\0${normalizeTitle(item.title)}`)
  )));
  return new Set((live.years ?? []).flatMap(group => (group.items ?? []).map(item => (
    item.seasonal
      ? `live\0${normalizeTitle(item.title)}`
      : `${item.dlc ? 'dlc' : 'normal_game'}\0${Number(group.year)}\0${normalizeTitle(item.title)}`
  ))));
}

function liveRecords(board, live) {
  if (board === 'music') return (live.items ?? []).map(item => ({ fingerprint: normalizeTitle(item.title), item }));
  if (board === 'texts') return (live.items ?? []).map(item => ({
    fingerprint: `${item.section}\0${normalizeTitle(item.title)}\0${item.date ?? ''}`,
    item,
  }));
  if (board === 'visions') return (live.years ?? []).flatMap(group => (group.items ?? []).map(item => ({
    fingerprint: `${group.folder}\0${normalizeTitle(item.title)}`,
    item,
  })));
  return (live.years ?? []).flatMap(group => (group.items ?? []).map(item => ({
    fingerprint: item.seasonal
      ? `live\0${normalizeTitle(item.title)}`
      : `${item.dlc ? 'dlc' : 'normal_game'}\0${Number(group.year)}\0${normalizeTitle(item.title)}`,
    item,
  })));
}

function loadBoardEntries(board, v2Root) {
  const loaders = { music: loadMusic, texts: loadTexts, visions: loadVisions, games: loadGames };
  return loaders[board](v2Root);
}

export function buildBoardPublicCatalog({ board, v2Root, projectRoot = process.cwd() }) {
  if (!BOARDS.has(board)) throw new Error('unsupported_sync_board');
  const publicJsonPath = path.join(projectRoot, 'public', 'data', `${board}.json`);
  if (!existsFile(publicJsonPath)) throw new Error('public_json_missing');
  const live = JSON.parse(fs.readFileSync(publicJsonPath, 'utf8'));
  const records = liveRecords(board, live);
  const byFingerprint = new Map();
  records.forEach((record, index) => {
    if (byFingerprint.has(record.fingerprint)) throw new Error('public_catalog_fingerprint_conflict');
    byFingerprint.set(record.fingerprint, { ...record, index });
  });
  const entries = loadBoardEntries(board, v2Root).map(entry => {
    const matched = byFingerprint.get(entry.fingerprint);
    const publicItem = matched?.item ?? null;
    return {
      id: entry.id,
      title: String(entry.fields.title ?? ''),
      synced: Boolean(publicItem),
      publicId: String(publicItem?.id ?? ''),
      thumbnail: String(publicItem?.image_path ?? publicItem?.cover ?? ''),
      secondary: board === 'games'
        ? String(entry.fields.year ?? '')
        : board === 'visions'
          ? String(entry.fields.period ?? '')
          : board === 'texts'
            ? [entry.fields.section, entry.fields.date].filter(Boolean).join(' · ')
            : String(entry.fields.date ?? ''),
      publicItem,
      publicOrder: matched?.index ?? Number.MAX_SAFE_INTEGER,
    };
  });
  entries.sort((left, right) => left.publicOrder - right.publicOrder || left.title.localeCompare(right.title));
  return { board, live, entries };
}

function buildPublicItem(board, entry, sectionTitles) {
  const mediaByStem = new Map(entry.media.map(item => [path.basename(item.sourcePath, path.extname(item.sourcePath)), item.publicPath]));
  const fields = entry.fields;
  if (board === 'music') return {
    id: entry.id,
    title: String(fields.title ?? ''),
    cover: mediaByStem.get('cover') ?? '',
    description: String(fields.description ?? fields.note ?? ''),
    content: entry.content,
    audio: mediaByStem.get('audio') ?? '',
    url: String(fields.url ?? ''),
    track_title: String(fields.track_title ?? ''),
  };
  if (board === 'texts') return {
    id: entry.id,
    title: String(fields.title ?? ''),
    date: String(fields.date ?? ''),
    sort_date: String(fields.date ?? ''),
    section: String(fields.section ?? ''),
    section_title: String(sectionTitles.get(String(fields.section ?? '')) ?? ''),
    cover: mediaByStem.get('cover') ?? '',
    author: String(fields.author ?? ''),
    summary: String(fields.summary ?? ''),
    excerpt: markdownExcerpt(entry.content, fields.summary),
    tags: Array.isArray(fields.tags) ? fields.tags : [],
    content: entry.content,
  };
  if (board === 'visions') return {
    id: entry.id,
    image_path: mediaByStem.get('poster') ?? '',
    title: String(fields.title ?? ''),
    cinema: fields.cinema === true,
    quote: String(fields.quote ?? ''),
    url: String(fields.url ?? ''),
    type: entry.kind === 'series' ? 'tv' : 'movie',
  };
  const metadataEnabled = fields.metadata_enabled === true;
  return {
    id: entry.id,
    image_path: mediaByStem.get('cover') ?? '',
    title: String(fields.title ?? ''),
    cinema: false,
    quote: '',
    url: metadataEnabled ? String(fields.url ?? '') : '',
    type: 'game',
    game_meta_enabled: metadataEnabled,
    english_title: metadataEnabled ? String(fields.english_title ?? '') : '',
    platform: metadataEnabled ? String(fields.platform ?? '') : 'steam',
    price: metadataEnabled ? String(fields.price ?? '') : '',
    rating: metadataEnabled ? (fields.rating ?? '') : '',
    playtime: metadataEnabled ? String(fields.playtime ?? '') : '',
    completed: metadataEnabled && fields.completed === true,
    genre: metadataEnabled ? String(fields.genre ?? '') : '',
    seasonal: false,
    dlc: entry.kind === 'dlc',
    dlc_parent: entry.kind === 'dlc' ? String(fields.parent_title ?? '') : '',
    summary: metadataEnabled ? String(fields.summary ?? '') : '',
    hover_note: metadataEnabled ? String(fields.hover_note ?? '') : '',
    season_heading: '', season_subheading: '', season_description: '', season_entries: [],
  };
}

function applyItems(board, live, pending, sectionTitles) {
  const next = structuredClone(live);
  const items = pending.map(entry => buildPublicItem(board, entry, sectionTitles));
  if (board === 'music') next.items = [...items, ...(next.items ?? [])];
  if (board === 'texts') {
    next.items = [...items, ...(next.items ?? [])];
    const counts = next.items.reduce((result, item) => ({ ...result, [item.section]: (result[item.section] ?? 0) + 1 }), {});
    next.sections = (next.sections ?? []).map(section => ({ ...section, count: counts[section.key] ?? 0 }));
  }
  if (board === 'visions') {
    for (const [entry, item] of pending.map((value, index) => [value, items[index]])) {
      const group = (next.years ?? []).find(candidate => candidate.folder === entry.fields.period);
      if (!group) throw new Error('visions_public_period_missing');
      group.items = [item, ...(group.items ?? [])];
    }
  }
  if (board === 'games') {
    for (const [entry, item] of pending.map((value, index) => [value, items[index]])) {
      if (entry.kind !== 'normal_game') throw new Error('games_sync_only_supports_normal_game');
      let group = (next.years ?? []).find(candidate => Number(candidate.year) === Number(entry.fields.year));
      if (!group) {
        group = { year: Number(entry.fields.year), folder: String(entry.fields.year), items: [] };
        next.years = [...(next.years ?? []), group].sort((left, right) => Number(right.year) - Number(left.year));
      }
      group.items = [item, ...(group.items ?? [])];
    }
  }
  next.total_count = board === 'music' || board === 'texts'
    ? (next.items ?? []).length
    : (next.years ?? []).reduce((sum, group) => sum + (group.items ?? []).length, 0);
  return next;
}

function sectionTitles(v2Root) {
  const result = new Map();
  const parsed = parseSectionsConfig(path.join(v2Root, 'config', 'texts-sections.yaml'));
  if (parsed.errors.length) throw new Error('texts_sections_config_invalid');
  for (const [key, value] of parsed.sections) result.set(key, value.title);
  return result;
}

export function buildPublicSyncPreview({ board, v2Root, projectRoot = process.cwd() }) {
  if (!BOARDS.has(board)) throw new Error('unsupported_sync_board');
  const publicJsonPath = path.join(projectRoot, 'public', 'data', `${board}.json`);
  if (!existsFile(publicJsonPath)) throw new Error('public_json_missing');
  const live = JSON.parse(fs.readFileSync(publicJsonPath, 'utf8'));
  const entries = loadBoardEntries(board, v2Root);
  const fingerprints = liveFingerprints(board, live);
  const pending = entries.filter(entry => !fingerprints.has(entry.fingerprint));
  const duplicateFingerprints = pending.length - new Set(pending.map(entry => entry.fingerprint)).size;
  if (duplicateFingerprints) throw new Error('pending_sync_fingerprint_conflict');
  const titles = board === 'texts' ? sectionTitles(v2Root) : new Map();
  const next = applyItems(board, live, pending, titles);
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  if (PRIVACY_RULES.some(rule => rule.test(serialized))) throw new Error('public_sync_privacy_rule_hit');
  const media = pending.flatMap(entry => entry.media);
  const result = {
    ok: true,
    board,
    state: pending.length ? 'ready' : 'current',
    pendingEntries: pending.length,
    currentEntries: Number(live.total_count ?? 0),
    nextEntries: Number(next.total_count ?? 0),
    mediaFiles: media.length,
    jsonFiles: pending.length ? 1 : 0,
    homeJsonModified: false,
    publishTriggered: false,
    relativeTargets: [
      ...(pending.length ? [`public/data/${board}.json`] : []),
      ...media.map(item => `public/${item.relativePath}`),
    ],
  };
  return {
    ...result,
    digest: crypto.createHash('sha256')
      .update(serialized)
      .update(JSON.stringify(media.map(({ relativePath, bytes, sha256 }) => ({ relativePath, bytes, sha256 }))))
      .digest('hex'),
    internal: { publicJsonPath, serialized, media },
  };
}

function removeEmptyParents(start, stop) {
  let current = start;
  const boundary = path.resolve(stop);
  while (path.resolve(current).startsWith(boundary) && path.resolve(current) !== boundary) {
    try { fs.rmdirSync(current); } catch { break; }
    current = path.dirname(current);
  }
}

export function applyPublicSync({ board, v2Root, projectRoot = process.cwd(), expectedDigest }) {
  const preview = buildPublicSyncPreview({ board, v2Root, projectRoot });
  if (preview.digest !== expectedDigest) throw new Error('public_sync_preview_changed');
  if (preview.pendingEntries === 0) return { ...preview, internal: undefined };
  const before = fs.readFileSync(preview.internal.publicJsonPath);
  const created = [];
  const publicRoot = path.join(projectRoot, 'public');
  const tempJson = `${preview.internal.publicJsonPath}.studio-sync-${crypto.randomUUID()}.tmp`;
  try {
    for (const media of preview.internal.media) {
      const target = path.join(publicRoot, ...media.relativePath.split('/'));
      if (existsFile(target)) throw new Error('public_sync_media_conflict');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(media.sourcePath, target, fs.constants.COPYFILE_EXCL);
      created.push(target);
      const copied = fs.readFileSync(target);
      if (copied.byteLength !== media.bytes || crypto.createHash('sha256').update(copied).digest('hex') !== media.sha256) {
        throw new Error('public_sync_media_verification_failed');
      }
    }
    fs.writeFileSync(tempJson, preview.internal.serialized, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(tempJson, preview.internal.publicJsonPath);
    const written = JSON.parse(fs.readFileSync(preview.internal.publicJsonPath, 'utf8'));
    if (Number(written.total_count) !== preview.nextEntries) throw new Error('public_sync_json_verification_failed');
    return { ...preview, state: 'synced', internal: undefined };
  } catch (error) {
    try { fs.rmSync(tempJson, { force: true }); } catch {}
    try { fs.writeFileSync(preview.internal.publicJsonPath, before); } catch {}
    for (const target of created.reverse()) {
      try { fs.rmSync(target, { force: true }); } catch {}
      removeEmptyParents(path.dirname(target), path.join(publicRoot, 'studio_media'));
    }
    const wrapped = new Error('public_sync_failed');
    wrapped.code = 'public_sync_failed';
    wrapped.rollback = { attempted: true, completed: true };
    wrapped.cause = error;
    throw wrapped;
  }
}
