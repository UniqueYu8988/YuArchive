import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ARCHIVE_SOURCE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');
export const GAMES_SOURCE_ROOT = path.join(ARCHIVE_SOURCE_ROOT, 'Games');
export const ARCHIVE_DATA_V2_ROOT = path.join(path.dirname(ARCHIVE_SOURCE_ROOT), 'ArchiveData-v2');
export const GAMES_V2_ROOT = path.join(ARCHIVE_DATA_V2_ROOT, 'entries', 'games');
export const GAMES_V2_CONFIG_PATH = path.join(ARCHIVE_DATA_V2_ROOT, 'config', 'games.yaml');
export const GAMES_MIGRATION_ROOT = path.join(ARCHIVE_DATA_V2_ROOT, 'migration', 'games');
export const GAMES_LIVE_JSON = path.resolve('public', 'data', 'games.json');

export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
export const GAME_KINDS = new Set(['normal_game', 'dlc', 'live_game']);
export const PLATFORM_CHOICES = new Set(['steam', 'xbox', 'riotgame', 'battlenet', 'playstation', 'switch']);
export const GENRE_CHOICES = new Set(['action', 'rpg', 'strategy', 'shooter', 'simulation', 'sports', 'racing', 'puzzle', 'casual']);
export const GAME_ID_PATTERN = /^game-[a-f0-9]{12}$/;
export const SEASON_ID_PATTERN = /^season-[a-f0-9]{12}$/;
export const YEAR_FOLDER_PATTERN = /^Game-(\d{4})$/;
export const SEASON_RULES = [
  { parentTitle: '云顶之弈', prefix: 'TFT_', label: '赛季' },
  { parentTitle: '英雄联盟', prefix: 'LOL_', label: '全球总决赛' },
  { parentTitle: '暗黑破坏神 IV', prefix: 'D4_', label: '赛季' },
];

export function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function existsDir(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

export function listDirSafe(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function unquote(value) {
  const text = normalizeText(value);
  if (
    (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("'") && text.endsWith("'"))
  ) return text.slice(1, -1);
  return text;
}

export function parseScalar(value) {
  const text = unquote(value);
  if (/^(true|yes)$/i.test(text)) return true;
  if (/^(false|no)$/i.test(text)) return false;
  if (/^-?\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function checksumFile(filePath) {
  return sha256(fs.readFileSync(filePath));
}

export function normalizeRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

export function buildMigratedGameId(sourceRelativePath) {
  const normalized = normalizeText(sourceRelativePath).replaceAll('\\', '/');
  return `game-${sha256(Buffer.from(normalized, 'utf8')).slice(0, 12)}`;
}

export function buildMigratedSeasonId(sourceRelativePath) {
  const normalized = normalizeText(sourceRelativePath).replaceAll('\\', '/');
  return `season-${sha256(Buffer.from(normalized, 'utf8')).slice(0, 12)}`;
}

export function canonicalizeGameTitle(value) {
  return normalizeText(value).toLowerCase().replace(/[\s_\-—:：·'".!！?？[\]()]/g, '');
}

function listImages(root) {
  return listDirSafe(root)
    .filter(entry => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map(entry => path.join(root, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export function parseFolderMeta(filePath) {
  const entries = new Map();
  const errors = [];
  if (!existsFile(filePath)) return { entries, errors };
  let currentTitle = null;
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const indent = rawLine.length - rawLine.trimStart().length;
    const colon = trimmed.indexOf(':');
    if (colon < 0) {
      errors.push({ line: index + 1, reason: 'missing_colon' });
      return;
    }
    const key = unquote(trimmed.slice(0, colon));
    const value = parseScalar(trimmed.slice(colon + 1));
    if (indent === 0 && value === '') {
      currentTitle = key;
      entries.set(currentTitle, {});
      return;
    }
    if (indent === 2 && currentTitle) {
      entries.get(currentTitle)[key.toLowerCase()] = value;
      return;
    }
    errors.push({ line: index + 1, reason: 'unsupported_shape' });
  });
  return { entries, errors };
}

export function parseLiveMeta(filePath) {
  const fields = {};
  const seasons = new Map();
  const errors = [];
  let inSeasons = false;
  let currentSeason = null;
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const indent = rawLine.length - rawLine.trimStart().length;
    const colon = trimmed.indexOf(':');
    if (colon < 0) {
      errors.push({ line: index + 1, reason: 'missing_colon' });
      return;
    }
    const key = unquote(trimmed.slice(0, colon));
    const value = parseScalar(trimmed.slice(colon + 1));
    if (indent === 0 && key === 'season_entries' && value === '') {
      inSeasons = true;
      currentSeason = null;
      return;
    }
    if (indent === 0) {
      inSeasons = false;
      currentSeason = null;
      fields[key.toLowerCase()] = value;
      return;
    }
    if (inSeasons && indent === 2 && value === '') {
      currentSeason = key;
      seasons.set(currentSeason, {});
      return;
    }
    if (inSeasons && indent >= 4 && currentSeason) {
      seasons.get(currentSeason)[key.toLowerCase()] = value;
      return;
    }
    errors.push({ line: index + 1, reason: 'unsupported_shape' });
  });
  return { fields, seasons, errors };
}

function normalizedMetadata(raw = {}) {
  const ratingNumber = raw.rating === '' || raw.rating === undefined ? '' : Number(raw.rating);
  return {
    englishTitle: normalizeText(raw.english_title),
    url: normalizeText(raw.url),
    platform: normalizeText(raw.platform).toLowerCase(),
    price: normalizeText(raw.price),
    rating: Number.isInteger(ratingNumber) && ratingNumber >= 0 && ratingNumber <= 5 ? ratingNumber : '',
    playtime: normalizeText(raw.playtime),
    completed: raw.completed === true,
    genre: normalizeText(raw.genre).toLowerCase(),
    displayTitle: normalizeText(raw.display_title),
    dlcParentTitle: normalizeText(raw.dlc_parent_title),
    summary: normalizeText(raw.summary),
    hoverNote: normalizeText(raw.hover_note),
    seasonHeading: normalizeText(raw.season_heading),
    seasonSubheading: normalizeText(raw.season_subheading),
    seasonDescription: normalizeText(raw.season_description),
  };
}

function seasonOrderValue(title) {
  const worlds = normalizeText(title).match(/Worlds\s+(\d{4})/i);
  if (worlds) return Number(worlds[1]);
  const season = normalizeText(title).match(/S(\d+(?:\.\d+)?)/i);
  return season ? Number(season[1]) : 0;
}

function sourceRecord(filePath, role) {
  return {
    sourcePath: filePath,
    sourceRelativePath: normalizeRelative(GAMES_SOURCE_ROOT, filePath),
    sourceChecksum: checksumFile(filePath),
    role,
  };
}

export function scanGamesSource() {
  if (!existsDir(GAMES_SOURCE_ROOT)) throw new Error('games_source_missing');
  const errors = [];
  const sourceFiles = [];
  const entries = [];
  const yearDirectories = listDirSafe(GAMES_SOURCE_ROOT)
    .filter(entry => entry.isDirectory() && YEAR_FOLDER_PATTERN.test(entry.name))
    .map(entry => path.join(GAMES_SOURCE_ROOT, entry.name))
    .sort((left, right) => left.localeCompare(right));

  for (const directory of yearDirectories) {
    const folder = path.basename(directory);
    const year = Number(folder.match(YEAR_FOLDER_PATTERN)[1]);
    const metaPath = path.join(directory, 'meta.yaml');
    const metadataEnabled = existsFile(metaPath);
    const parsed = parseFolderMeta(metaPath);
    errors.push(...parsed.errors.map(error => ({ ...error, file: `${folder}/meta.yaml` })));
    if (metadataEnabled) sourceFiles.push(sourceRecord(metaPath, 'folder_meta'));
    const images = listImages(directory);
    const imageStems = new Set(images.map(file => path.basename(file, path.extname(file))));
    if (metadataEnabled) {
      for (const title of parsed.entries.keys()) {
        if (!imageStems.has(title)) errors.push({ file: `${folder}/meta.yaml`, reason: 'orphan_metadata' });
      }
    }
    for (const imagePath of images) {
      const stem = path.basename(imagePath, path.extname(imagePath));
      const metadata = normalizedMetadata(parsed.entries.get(stem));
      if (metadataEnabled && !parsed.entries.has(stem)) {
        errors.push({ file: `${folder}/${path.basename(imagePath)}`, reason: 'metadata_missing' });
      }
      const delimiter = stem.indexOf('_');
      const isDlc = delimiter > 0;
      const inferredParentTitle = isDlc ? normalizeText(stem.slice(0, delimiter)) : '';
      const dlcTitle = isDlc ? normalizeText(stem.slice(delimiter + 1)) : '';
      const displayTitle = metadata.displayTitle || dlcTitle || normalizeText(stem);
      const source = sourceRecord(imagePath, 'ordinary_cover');
      sourceFiles.push(source);
      entries.push({
        id: buildMigratedGameId(source.sourceRelativePath),
        board: 'games',
        kind: isDlc ? 'dlc' : 'normal_game',
        title: displayTitle,
        year,
        metadataEnabled,
        metadata,
        parentTitle: isDlc ? (metadata.dlcParentTitle || inferredParentTitle) : '',
        parentInferred: isDlc && !metadata.dlcParentTitle,
        coverPath: imagePath,
        coverRelativePath: source.sourceRelativePath,
        coverChecksum: source.sourceChecksum,
        coverExtension: path.extname(imagePath).toLowerCase(),
        sourceFolder: folder,
        sourceStem: stem,
        sourceRelativePath: source.sourceRelativePath,
      });
    }
  }

  const liveRoot = path.join(GAMES_SOURCE_ROOT, 'Game-Live');
  const liveImages = listImages(liveRoot);
  const liveYamlFiles = listDirSafe(liveRoot)
    .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.yaml')
    .map(entry => path.join(liveRoot, entry.name))
    .sort((left, right) => left.localeCompare(right));
  const liveParents = new Map();
  for (const yamlPath of liveYamlFiles) {
    const parentTitle = path.basename(yamlPath, path.extname(yamlPath));
    const parsed = parseLiveMeta(yamlPath);
    errors.push(...parsed.errors.map(error => ({ ...error, file: `Game-Live/${path.basename(yamlPath)}` })));
    const source = sourceRecord(yamlPath, 'live_meta');
    sourceFiles.push(source);
    const directCovers = liveImages.filter(file => path.basename(file, path.extname(file)) === parentTitle);
    if (directCovers.length > 1) errors.push({ file: source.sourceRelativePath, reason: 'multiple_live_covers' });
    if (directCovers[0]) sourceFiles.push(sourceRecord(directCovers[0], 'live_cover'));
    const entry = {
      id: buildMigratedGameId(source.sourceRelativePath),
      board: 'games',
      kind: 'live_game',
      title: parentTitle,
      metadataEnabled: true,
      metadata: normalizedMetadata(parsed.fields),
      coverPath: directCovers[0] || null,
      coverRelativePath: directCovers[0] ? normalizeRelative(GAMES_SOURCE_ROOT, directCovers[0]) : '',
      coverChecksum: directCovers[0] ? checksumFile(directCovers[0]) : '',
      coverExtension: directCovers[0] ? path.extname(directCovers[0]).toLowerCase() : '',
      sourceFolder: 'Game-Live',
      sourceStem: parentTitle,
      sourceRelativePath: source.sourceRelativePath,
      seasons: [],
      seasonMetadata: parsed.seasons,
    };
    liveParents.set(parentTitle, entry);
    entries.push(entry);
  }

  const consumedLiveImages = new Set([...liveParents.values()].map(entry => entry.coverPath).filter(Boolean));
  for (const imagePath of liveImages) {
    if (consumedLiveImages.has(imagePath)) continue;
    const stem = path.basename(imagePath, path.extname(imagePath));
    const rule = SEASON_RULES.find(candidate => stem.startsWith(candidate.prefix));
    if (!rule) {
      errors.push({ file: `Game-Live/${path.basename(imagePath)}`, reason: 'unmapped_live_image' });
      continue;
    }
    const parent = liveParents.get(rule.parentTitle);
    if (!parent) {
      errors.push({ file: `Game-Live/${path.basename(imagePath)}`, reason: 'season_parent_missing' });
      continue;
    }
    const title = normalizeText(stem.slice(rule.prefix.length));
    const seasonMetadata = parent.seasonMetadata.get(title);
    if (!seasonMetadata) {
      errors.push({ file: `Game-Live/${path.basename(imagePath)}`, reason: 'season_metadata_missing' });
      continue;
    }
    const source = sourceRecord(imagePath, 'season_cover');
    sourceFiles.push(source);
    parent.seasons.push({
      id: buildMigratedSeasonId(source.sourceRelativePath),
      title,
      label: rule.label,
      order: seasonOrderValue(title),
      fields: Object.fromEntries(Object.entries(seasonMetadata).map(([key, value]) => [key, normalizeText(value)])),
      coverPath: imagePath,
      coverRelativePath: source.sourceRelativePath,
      coverChecksum: source.sourceChecksum,
      coverExtension: path.extname(imagePath).toLowerCase(),
      sourceRelativePath: source.sourceRelativePath,
      seasonPrefix: rule.prefix,
    });
  }

  for (const parent of liveParents.values()) {
    const seasonTitles = new Set(parent.seasons.map(season => season.title));
    for (const title of parent.seasonMetadata.keys()) {
      if (!seasonTitles.has(title)) errors.push({ file: parent.sourceRelativePath, reason: 'orphan_season_metadata' });
    }
    parent.seasons.sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
    delete parent.seasonMetadata;
  }

  const parentCandidates = entries.filter(entry => entry.kind !== 'dlc');
  const candidateMap = new Map();
  for (const candidate of parentCandidates) {
    for (const value of [candidate.title, candidate.sourceStem, candidate.metadata.displayTitle]) {
      const key = canonicalizeGameTitle(value);
      if (!key) continue;
      if (!candidateMap.has(key)) candidateMap.set(key, new Set());
      candidateMap.get(key).add(candidate.id);
    }
  }
  const parentById = new Map(parentCandidates.map(entry => [entry.id, entry]));
  for (const entry of entries.filter(candidate => candidate.kind === 'dlc')) {
    const candidates = [...(candidateMap.get(canonicalizeGameTitle(entry.parentTitle)) || [])];
    if (candidates.length !== 1) {
      errors.push({ file: entry.sourceRelativePath, reason: candidates.length ? 'dlc_parent_ambiguous' : 'dlc_parent_missing' });
      entry.parentId = '';
      continue;
    }
    entry.parentId = candidates[0];
    entry.parentTitle = parentById.get(entry.parentId).title;
  }

  return {
    gamesRoot: GAMES_SOURCE_ROOT,
    entries,
    sourceFiles,
    errors,
  };
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

export function serializeGameEntryYaml(entry) {
  const lines = [
    `id: ${entry.id}`,
    'board: games',
    `kind: ${entry.kind}`,
    `title: ${yamlString(entry.title)}`,
  ];
  if (entry.kind !== 'live_game') lines.push(`year: ${entry.year}`);
  lines.push(`metadata_enabled: ${entry.metadataEnabled ? 'true' : 'false'}`);
  if (entry.metadataEnabled) {
    lines.push(
      `english_title: ${yamlString(entry.metadata.englishTitle)}`,
      `url: ${yamlString(entry.metadata.url)}`,
      `platform: ${yamlString(entry.metadata.platform)}`,
      `price: ${yamlString(entry.metadata.price)}`,
      `rating: ${entry.metadata.rating === '' ? '""' : entry.metadata.rating}`,
      `playtime: ${yamlString(entry.metadata.playtime)}`,
      `completed: ${entry.metadata.completed ? 'true' : 'false'}`,
      `genre: ${yamlString(entry.metadata.genre)}`,
    );
    if (entry.metadata.summary) lines.push(`summary: ${yamlString(entry.metadata.summary)}`);
    if (entry.metadata.hoverNote) lines.push(`hover_note: ${yamlString(entry.metadata.hoverNote)}`);
    if (entry.kind === 'live_game') {
      lines.push(
        `season_heading: ${yamlString(entry.metadata.seasonHeading)}`,
        `season_subheading: ${yamlString(entry.metadata.seasonSubheading)}`,
        `season_description: ${yamlString(entry.metadata.seasonDescription)}`,
      );
    }
  }
  if (entry.kind === 'dlc') {
    lines.push(
      `parent_id: ${entry.parentId}`,
      `parent_title: ${yamlString(entry.parentTitle)}`,
    );
  }
  lines.push(
    'legacy:',
    `  source_relative_path: ${yamlString(entry.sourceRelativePath)}`,
    `  source_folder: ${yamlString(entry.sourceFolder)}`,
    `  source_stem: ${yamlString(entry.sourceStem)}`,
    `  metadata_enabled: ${entry.metadataEnabled ? 'true' : 'false'}`,
  );
  if (entry.metadata.displayTitle) lines.push(`  display_title: ${yamlString(entry.metadata.displayTitle)}`);
  if (entry.kind === 'dlc') {
    lines.push(
      `  dlc_parent_title: ${yamlString(entry.metadata.dlcParentTitle)}`,
      `  inferred_parent: ${entry.parentInferred ? 'true' : 'false'}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

export function serializeSeasonYaml(season) {
  const lines = [
    `id: ${season.id}`,
    `title: ${yamlString(season.title)}`,
    `label: ${yamlString(season.label)}`,
    `order: ${season.order}`,
  ];
  for (const key of ['period', 'theme', 'feature', 'champion', 'note', 'build']) {
    if (season.fields[key]) lines.push(`${key}: ${yamlString(season.fields[key])}`);
  }
  lines.push(
    'legacy:',
    `  source_relative_path: ${yamlString(season.sourceRelativePath)}`,
    `  season_prefix: ${yamlString(season.seasonPrefix)}`,
  );
  return `${lines.join('\n')}\n`;
}

export function serializeGamesConfigYaml(entries) {
  const priority = SEASON_RULES.map(rule => entries.find(entry => entry.kind === 'live_game' && entry.title === rule.parentTitle)?.id)
    .filter(Boolean);
  return [
    'season_target_year: 2026',
    'season_priority:',
    ...priority.map(id => `  - ${id}`),
    '',
  ].join('\n');
}
