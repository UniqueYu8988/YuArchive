import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ARCHIVE_SOURCE_ROOT,
  resolveArchiveDataRoot,
} from './archive-paths.mjs';

export { ARCHIVE_SOURCE_ROOT };
export const VISIONS_SOURCE_ROOT = path.join(ARCHIVE_SOURCE_ROOT, 'Visions');
export const ARCHIVE_DATA_ROOT = resolveArchiveDataRoot({ allowLegacy: true, allowMissing: true });
export const ARCHIVE_DATA_V2_ROOT = ARCHIVE_DATA_ROOT;
export const VISIONS_V2_ROOT = path.join(ARCHIVE_DATA_V2_ROOT, 'entries', 'visions');
export const VISIONS_V2_CONFIG_PATH = path.join(ARCHIVE_DATA_V2_ROOT, 'config', 'visions-periods.yaml');
export const VISIONS_MIGRATION_ROOT = path.join(ARCHIVE_DATA_V2_ROOT, 'migration', 'visions');
export const VISIONS_LIVE_JSON = path.resolve('public', 'data', 'visions.json');

export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
export const VISION_KINDS = new Set(['movie', 'series', 'showcase']);
export const ORDINARY_VISION_KINDS = new Set(['movie', 'series']);
export const VISION_ENTRY_ID_PATTERN = /^vision-[a-z0-9](?:[a-z0-9-]{0,71}[a-z0-9])$/;
export const CHARACTER_ID_PATTERN = /^character-[a-z0-9](?:[a-z0-9-]{0,68}[a-z0-9])$/;
export const PERIOD_RULES = new Map([
  ['开端', { order: 1, syntheticYear: 2017 }],
  ['前尘', { order: 2, syntheticYear: 2020 }],
  ['旧影', { order: 3, syntheticYear: 2023 }],
  ['未远', { order: 4, syntheticYear: 2025 }],
  ['此岸', { order: 5, syntheticYear: 2026 }],
]);

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

export function walkFiles(dirPath) {
  const files = [];
  for (const entry of listDirSafe(dirPath)) {
    const current = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(current));
    else if (entry.isFile()) files.push(current);
  }
  return files;
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

export function parseTwoLevelYaml(filePath) {
  const data = {};
  const errors = [];
  if (!existsFile(filePath)) return { data, errors: ['yaml_missing'] };
  let currentKey = null;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const indent = rawLine.length - rawLine.trimStart().length;
    const colon = trimmed.indexOf(':');
    if (colon < 0) {
      errors.push(`missing_colon_line_${index + 1}`);
      return;
    }
    const key = unquote(trimmed.slice(0, colon));
    const value = trimmed.slice(colon + 1).trim();
    if (indent === 0) {
      currentKey = key;
      data[key] = value ? parseScalar(value) : {};
      return;
    }
    if (!currentKey || typeof data[currentKey] !== 'object' || Array.isArray(data[currentKey])) {
      errors.push(`nested_field_without_entry_line_${index + 1}`);
      return;
    }
    data[currentKey][key.toLowerCase()] = parseScalar(value);
  });
  return { data, errors };
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

export function buildMigratedVisionId(sourceRelativePath) {
  const normalized = normalizeText(sourceRelativePath).replaceAll('\\', '/');
  return `vision-${sha256(Buffer.from(normalized, 'utf8')).slice(0, 12)}`;
}

export function buildMigratedCharacterId(sourceRelativePath) {
  const normalized = normalizeText(sourceRelativePath).replaceAll('\\', '/');
  return `character-${sha256(Buffer.from(normalized, 'utf8')).slice(0, 12)}`;
}

function listImages(root) {
  return listDirSafe(root)
    .filter(entry => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map(entry => path.join(root, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function parseOrdinaryGroups(visionsRoot) {
  const entries = [];
  const errors = [];
  const metaFiles = [];
  const titleGroups = new Map();

  for (const groupDirent of listDirSafe(visionsRoot).filter(entry => entry.isDirectory())) {
    if (groupDirent.name === '角色橱窗') continue;
    const groupDir = path.join(visionsRoot, groupDirent.name);
    const metaPath = path.join(groupDir, 'meta.yaml');
    const parsed = parseTwoLevelYaml(metaPath);
    metaFiles.push(metaPath);
    errors.push(...parsed.errors.map(error => `${groupDirent.name}:${error}`));
    const metadata = new Map(
      Object.entries(parsed.data)
        .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
        .map(([title, value]) => [normalizeText(title), value]),
    );
    const images = listImages(groupDir);
    const usedTitles = new Set();
    for (const posterPath of images) {
      const title = normalizeText(path.basename(posterPath, path.extname(posterPath)));
      const meta = metadata.get(title);
      if (!meta) {
        errors.push(`missing_metadata:${groupDirent.name}`);
        continue;
      }
      usedTitles.add(title);
      if (!titleGroups.has(title)) titleGroups.set(title, new Set());
      titleGroups.get(title).add(groupDirent.name);
      const legacyType = normalizeText(meta.type || 'movie').toLowerCase();
      const kind = legacyType === 'tv' ? 'series' : legacyType === 'movie' ? 'movie' : '';
      const sourceRelativePath = normalizeRelative(visionsRoot, posterPath);
      if (!kind) errors.push(`unknown_type:${groupDirent.name}`);
      entries.push({
        id: buildMigratedVisionId(sourceRelativePath),
        board: 'visions',
        kind,
        title,
        period: groupDirent.name,
        cinema: meta.cinema === true,
        quote: normalizeText(meta.quote),
        url: normalizeText(meta.url),
        sourcePath: posterPath,
        sourceRelativePath,
        sourceChecksum: checksumFile(posterPath),
        sourceMetaPath: metaPath,
        sourceMetaRelativePath: normalizeRelative(visionsRoot, metaPath),
        legacyType,
        syntheticYear: PERIOD_RULES.get(groupDirent.name)?.syntheticYear ?? null,
      });
    }
    for (const title of metadata.keys()) {
      if (!usedTitles.has(title)) errors.push(`orphan_metadata:${groupDirent.name}`);
    }
    if (!PERIOD_RULES.has(groupDirent.name)) errors.push(`unknown_period:${groupDirent.name}`);
  }
  const duplicateTitlesAcrossPeriods = [...titleGroups.values()].filter(groups => groups.size > 1).length;
  return { entries, errors, metaFiles, duplicateTitlesAcrossPeriods };
}

function parseShowcase(visionsRoot) {
  const showcaseRoot = path.join(visionsRoot, '角色橱窗');
  const metaPath = path.join(showcaseRoot, 'meta.yaml');
  const parsed = parseTwoLevelYaml(metaPath);
  const errors = [...parsed.errors.map(error => `showcase:${error}`)];
  const title = normalizeText(parsed.data.title || '角色橱窗');
  const description = normalizeText(parsed.data.description);
  const characters = [];
  for (const [characterTitle, value] of Object.entries(parsed.data)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const gifName = normalizeText(value.gif);
    const avatarName = normalizeText(value.avatar);
    const gifPath = gifName ? path.join(showcaseRoot, gifName) : null;
    const avatarPath = avatarName ? path.join(showcaseRoot, avatarName) : null;
    if (!gifPath || !existsFile(gifPath)) errors.push('showcase_missing_gif');
    if (!avatarPath || !existsFile(avatarPath)) errors.push('showcase_missing_avatar');
    const identityPath = gifPath
      ? normalizeRelative(visionsRoot, gifPath)
      : `角色橱窗/${normalizeText(characterTitle)}`;
    characters.push({
      id: buildMigratedCharacterId(identityPath),
      title: normalizeText(characterTitle),
      caption: normalizeText(value.caption),
      order: characters.length + 1,
      gifPath,
      gifRelativePath: gifPath ? normalizeRelative(visionsRoot, gifPath) : '',
      gifChecksum: gifPath && existsFile(gifPath) ? checksumFile(gifPath) : '',
      avatarPath,
      avatarRelativePath: avatarPath ? normalizeRelative(visionsRoot, avatarPath) : '',
      avatarChecksum: avatarPath && existsFile(avatarPath) ? checksumFile(avatarPath) : '',
    });
  }
  return {
    id: buildMigratedVisionId('角色橱窗/meta.yaml'),
    board: 'visions',
    kind: 'showcase',
    title,
    description,
    order: [...PERIOD_RULES.values()].length + 1,
    sourceMetaPath: metaPath,
    sourceMetaRelativePath: normalizeRelative(visionsRoot, metaPath),
    characters,
    errors,
  };
}

function compareLiveMetadata(entries, liveJsonPath) {
  if (!existsFile(liveJsonPath)) {
    return {
      differingEntries: 0,
      fieldDifferences: { cinema: 0, quote: 0, url: 0, type: 0 },
      totalFieldDifferences: 0,
      liveItems: 0,
    };
  }
  const live = JSON.parse(fs.readFileSync(liveJsonPath, 'utf8'));
  const liveItems = (live.years || []).flatMap(group => (
    (group.items || []).map(item => ({ ...item, period: group.folder }))
  ));
  const byPeriodTitle = new Map(liveItems.map(item => [`${item.period}\0${item.title}`, item]));
  let differingEntries = 0;
  const fieldDifferences = { cinema: 0, quote: 0, url: 0, type: 0 };
  for (const entry of entries) {
    const liveItem = byPeriodTitle.get(`${entry.period}\0${entry.title}`);
    const expectedType = entry.kind === 'series' ? 'tv' : 'movie';
    let entryDiffers = false;
    for (const [field, expected] of [
      ['cinema', entry.cinema],
      ['quote', entry.quote],
      ['url', entry.url],
      ['type', expectedType],
    ]) {
      if (!liveItem || liveItem[field] !== expected) {
        fieldDifferences[field] += 1;
        entryDiffers = true;
      }
    }
    if (entryDiffers) differingEntries += 1;
  }
  return {
    differingEntries,
    fieldDifferences,
    totalFieldDifferences: Object.values(fieldDifferences).reduce((sum, count) => sum + count, 0),
    liveItems: liveItems.length,
  };
}

export function buildVisionsSourceInventory({
  visionsRoot = VISIONS_SOURCE_ROOT,
  liveJsonPath = VISIONS_LIVE_JSON,
} = {}) {
  const ordinary = parseOrdinaryGroups(visionsRoot);
  const showcase = parseShowcase(visionsRoot);
  const allFiles = existsDir(visionsRoot) ? walkFiles(visionsRoot) : [];
  const imageFiles = allFiles.filter(file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const liveComparison = compareLiveMetadata(ordinary.entries, liveJsonPath);
  const errors = [...ordinary.errors, ...showcase.errors];
  return {
    visionsRoot,
    entries: ordinary.entries,
    showcase,
    metaFiles: [...ordinary.metaFiles, showcase.sourceMetaPath],
    allFiles,
    imageFiles,
    errors,
    duplicateTitlesAcrossPeriods: ordinary.duplicateTitlesAcrossPeriods,
    liveDifferingEntries: liveComparison.differingEntries,
    liveFieldDifferences: liveComparison.fieldDifferences,
    liveTotalFieldDifferences: liveComparison.totalFieldDifferences,
    liveItems: liveComparison.liveItems,
  };
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

export function serializeVisionEntryYaml(entry) {
  return [
    `id: ${yamlString(entry.id)}`,
    'board: visions',
    `kind: ${entry.kind}`,
    `title: ${yamlString(entry.title)}`,
    `period: ${yamlString(entry.period)}`,
    `cinema: ${entry.cinema ? 'true' : 'false'}`,
    `quote: ${yamlString(entry.quote)}`,
    `url: ${yamlString(entry.url)}`,
    'legacy:',
    `  type: ${yamlString(entry.legacyType)}`,
    `  synthetic_year: ${entry.syntheticYear ?? 'null'}`,
    `  source_group: ${yamlString(entry.period)}`,
    `  source_relative_path: ${yamlString(entry.sourceRelativePath)}`,
    '',
  ].join('\n');
}

export function serializeShowcaseEntryYaml(showcase) {
  return [
    `id: ${yamlString(showcase.id)}`,
    'board: visions',
    'kind: showcase',
    `title: ${yamlString(showcase.title)}`,
    `description: ${yamlString(showcase.description)}`,
    `character_order: [${showcase.characters.map(character => yamlString(character.id)).join(', ')}]`,
    '',
  ].join('\n');
}

export function serializeCharacterYaml(character) {
  return [
    `id: ${yamlString(character.id)}`,
    `title: ${yamlString(character.title)}`,
    `caption: ${yamlString(character.caption)}`,
    `order: ${character.order}`,
    '',
  ].join('\n');
}

export function serializeVisionsPeriodsYaml() {
  const lines = [];
  for (const [period, rule] of PERIOD_RULES) {
    lines.push(`${period}:`);
    lines.push(`  order: ${rule.order}`);
    lines.push(`  synthetic_year: ${rule.syntheticYear}`);
  }
  return `${lines.join('\n')}\n`;
}

export function parseFlatYaml(filePath) {
  const data = {};
  let errors = 0;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if ((rawLine.length - rawLine.trimStart().length) > 0) continue;
    const colon = trimmed.indexOf(':');
    if (colon < 0) {
      errors += 1;
      continue;
    }
    const key = normalizeText(trimmed.slice(0, colon));
    const value = trimmed.slice(colon + 1).trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      data[key] = inner ? inner.split(',').map(item => unquote(item)) : [];
    } else {
      data[key] = parseScalar(value);
    }
  }
  return { data, errors };
}

export function buildVisionsMigrationPlan({
  visionsRoot = VISIONS_SOURCE_ROOT,
  liveJsonPath = VISIONS_LIVE_JSON,
} = {}) {
  const inventory = buildVisionsSourceInventory({ visionsRoot, liveJsonPath });
  const targets = [];
  const idCounts = new Map();
  const pathCounts = new Map();
  const kindCounts = { movie: 0, series: 0, showcase: 1 };
  const addTarget = target => {
    targets.push(target);
    pathCounts.set(target.relativePath, (pathCounts.get(target.relativePath) ?? 0) + 1);
  };

  for (const entry of inventory.entries) {
    const entryRoot = `entries/visions/${entry.kind}/${entry.id}`;
    addTarget({ role: 'entry_yaml', relativePath: `${entryRoot}/entry.yaml`, entryId: entry.id });
    addTarget({
      role: 'poster',
      relativePath: `${entryRoot}/poster${path.extname(entry.sourcePath).toLowerCase()}`,
      entryId: entry.id,
    });
    idCounts.set(entry.id, (idCounts.get(entry.id) ?? 0) + 1);
    kindCounts[entry.kind] += 1;
  }

  const showcaseRoot = `entries/visions/showcase/${inventory.showcase.id}`;
  addTarget({ role: 'showcase_entry_yaml', relativePath: `${showcaseRoot}/entry.yaml`, entryId: inventory.showcase.id });
  idCounts.set(inventory.showcase.id, (idCounts.get(inventory.showcase.id) ?? 0) + 1);
  for (const character of inventory.showcase.characters) {
    const characterRoot = `${showcaseRoot}/characters/${character.id}`;
    addTarget({ role: 'character_yaml', relativePath: `${characterRoot}/character.yaml`, entryId: character.id });
    addTarget({
      role: 'character_avatar',
      relativePath: `${characterRoot}/avatar${path.extname(character.avatarPath).toLowerCase()}`,
      entryId: character.id,
    });
    addTarget({
      role: 'character_clip',
      relativePath: `${characterRoot}/clip${path.extname(character.gifPath).toLowerCase()}`,
      entryId: character.id,
    });
    idCounts.set(character.id, (idCounts.get(character.id) ?? 0) + 1);
  }
  addTarget({ role: 'periods_config', relativePath: 'config/visions-periods.yaml', entryId: null });

  const duplicateIds = [...idCounts.values()].filter(count => count > 1).length;
  const duplicateTargets = [...pathCounts.values()].filter(count => count > 1).length;
  const blockedReasons = [
    ...inventory.errors,
    duplicateIds ? 'duplicate_ids' : null,
    duplicateTargets ? 'duplicate_targets' : null,
    inventory.entries.length !== 111 ? 'unexpected_ordinary_entry_count' : null,
    inventory.showcase.characters.length !== 20 ? 'unexpected_character_count' : null,
    inventory.allFiles.length !== 157 ? 'unexpected_source_file_count' : null,
  ].filter(Boolean);
  return {
    ok: blockedReasons.length === 0,
    inventory,
    targets,
    ordinaryEntries: inventory.entries.length,
    showcaseEntries: 1,
    characters: inventory.showcase.characters.length,
    kindCounts,
    targetRoles: targets.reduce((counts, target) => {
      counts[target.role] = (counts[target.role] ?? 0) + 1;
      return counts;
    }, {}),
    sourceManifestRecords: inventory.allFiles.length,
    duplicateIds,
    duplicateTargets,
    duplicateTitlesAcrossPeriods: inventory.duplicateTitlesAcrossPeriods,
    liveDifferingEntries: inventory.liveDifferingEntries,
    liveFieldDifferences: inventory.liveFieldDifferences,
    liveTotalFieldDifferences: inventory.liveTotalFieldDifferences,
    blockedReasons,
  };
}
