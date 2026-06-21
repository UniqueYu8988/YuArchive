import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildBoardPublicCatalog } from './archive-studio-public-sync-core.mjs';

export const HOMEPAGE_LIMITS = Object.freeze({ games: 9, visions: 9, music: 7, texts: 4 });
const BOARDS = Object.keys(HOMEPAGE_LIMITS);
const CONFIG_KEYS = Object.fromEntries(BOARDS.map(board => [board, `${board}_ids`]));
const PRIVACY_RULES = [
  /[A-Za-z]:[\\/]+Users[\\/]/i,
  /OneDrive/i,
  /Data backup/i,
  /\b(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i,
];

function existsFile(filePath) {
  try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function safeSelection(selection) {
  return Object.fromEntries(BOARDS.map(board => [
    board,
    Array.isArray(selection?.[board]) ? selection[board].map(value => String(value).trim()).filter(Boolean) : [],
  ]));
}

export function serializeHomepageConfig(selection) {
  const normalized = safeSelection(selection);
  return `${[
    'version: 1',
    ...BOARDS.map(board => `${CONFIG_KEYS[board]}: [${normalized[board].map(id => JSON.stringify(id)).join(', ')}]`),
  ].join('\n')}\n`;
}

export function parseHomepageConfig(filePath) {
  const result = { version: 0, selection: safeSelection({}), errors: [] };
  if (!existsFile(filePath)) return { ...result, missing: true };
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon < 0) { result.errors.push('line_missing_colon'); continue; }
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key === 'version') { result.version = Number(value); continue; }
    const board = BOARDS.find(candidate => CONFIG_KEYS[candidate] === key);
    if (!board || !value.startsWith('[') || !value.endsWith(']')) {
      result.errors.push(`unsupported_key:${key}`);
      continue;
    }
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) throw new Error('not_array');
      result.selection[board] = parsed.map(item => String(item));
    } catch {
      result.errors.push(`invalid_array:${key}`);
    }
  }
  if (result.version !== 1) result.errors.push('unsupported_version');
  return { ...result, missing: false };
}

function buildCatalogs({ v2Root, projectRoot }) {
  return Object.fromEntries(BOARDS.map(board => [board, buildBoardPublicCatalog({ board, v2Root, projectRoot })]));
}

function deriveSelectionFromHome(home, catalogs) {
  const homeKeys = { games: 'latestGames', visions: 'latestVisions', music: 'latestMusic', texts: 'latestTexts' };
  const selection = {};
  for (const board of BOARDS) {
    const byPublicId = new Map(catalogs[board].entries.filter(item => item.synced).map(item => [item.publicId, item.id]));
    selection[board] = (home[homeKeys[board]] ?? []).map(item => byPublicId.get(String(item.id)) ?? '');
  }
  return selection;
}

function validateSelection(selection, catalogs) {
  const normalized = safeSelection(selection);
  const errors = [];
  for (const board of BOARDS) {
    const ids = normalized[board];
    if (ids.length !== HOMEPAGE_LIMITS[board]) {
      errors.push({ code: 'slot_count_invalid', board, expected: HOMEPAGE_LIMITS[board], actual: ids.length });
    }
    if (new Set(ids).size !== ids.length) errors.push({ code: 'duplicate_entry_id', board });
    const byId = new Map(catalogs[board].entries.map(item => [item.id, item]));
    for (const id of ids) {
      const candidate = byId.get(id);
      if (!candidate) errors.push({ code: 'entry_id_missing', board, id });
      else if (!candidate.synced) errors.push({ code: 'entry_not_public', board, id });
    }
  }
  return { ok: errors.length === 0, errors, selection: normalized };
}

function publicHomeFromSelection(selection, catalogs) {
  const pick = board => {
    const byId = new Map(catalogs[board].entries.map(item => [item.id, item]));
    return selection[board].map(id => structuredClone(byId.get(id).publicItem));
  };
  return {
    counts: Object.fromEntries(BOARDS.map(board => [board, Number(catalogs[board].live.total_count ?? 0)])),
    latestGames: pick('games'),
    latestVisions: pick('visions'),
    latestMusic: pick('music'),
    latestTexts: pick('texts'),
  };
}

function publicCandidate(item) {
  return {
    id: item.id,
    title: item.title,
    synced: item.synced,
    thumbnail: item.thumbnail,
    secondary: item.secondary,
  };
}

export function loadHomepageState({ v2Root, projectRoot = process.cwd() }) {
  const homePath = path.join(projectRoot, 'public', 'data', 'home.json');
  const configPath = path.join(v2Root, 'config', 'homepage.yaml');
  const home = JSON.parse(fs.readFileSync(homePath, 'utf8'));
  const catalogs = buildCatalogs({ v2Root, projectRoot });
  const parsed = parseHomepageConfig(configPath);
  const selection = parsed.missing ? deriveSelectionFromHome(home, catalogs) : parsed.selection;
  const validation = validateSelection(selection, catalogs);
  return {
    ok: parsed.errors.length === 0 && validation.ok,
    configExists: !parsed.missing,
    configErrors: parsed.errors,
    selection: validation.selection,
    validationErrors: validation.errors,
    limits: HOMEPAGE_LIMITS,
    candidates: Object.fromEntries(BOARDS.map(board => [board, catalogs[board].entries.map(publicCandidate)])),
    counts: home.counts,
    internal: { home, homePath, configPath, catalogs },
  };
}

export function buildHomepageConfigPreview({ selection, v2Root, projectRoot = process.cwd() }) {
  const state = loadHomepageState({ v2Root, projectRoot });
  const validation = validateSelection(selection, state.internal.catalogs);
  const serialized = serializeHomepageConfig(validation.selection);
  if (PRIVACY_RULES.some(rule => rule.test(serialized))) throw new Error('homepage_config_privacy_rule_hit');
  const before = existsFile(state.internal.configPath) ? fs.readFileSync(state.internal.configPath, 'utf8') : '';
  return {
    ok: validation.ok,
    errors: validation.errors,
    selection: validation.selection,
    configExists: existsFile(state.internal.configPath),
    configChanged: before !== serialized,
    writeTarget: '[ArchiveData-v2]/config/homepage.yaml',
    digest: sha256(serialized),
    internal: { configPath: state.internal.configPath, serialized },
  };
}

function atomicWrite(target, value) {
  const temp = `${target}.studio-${crypto.randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(temp, value, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temp, target);
}

export function saveHomepageConfig({ selection, expectedDigest, v2Root, projectRoot = process.cwd() }) {
  const preview = buildHomepageConfigPreview({ selection, v2Root, projectRoot });
  if (!preview.ok) throw new Error('homepage_config_validation_failed');
  if (preview.digest !== expectedDigest) throw new Error('homepage_config_preview_changed');
  const existed = existsFile(preview.internal.configPath);
  const before = existed ? fs.readFileSync(preview.internal.configPath) : null;
  try {
    atomicWrite(preview.internal.configPath, preview.internal.serialized);
    const parsed = parseHomepageConfig(preview.internal.configPath);
    if (parsed.errors.length || stableJson(parsed.selection) !== stableJson(preview.selection)) {
      throw new Error('homepage_config_verification_failed');
    }
    return { ok: true, state: preview.configChanged ? 'saved' : 'current', selection: preview.selection, writeTarget: preview.writeTarget };
  } catch (error) {
    try {
      if (existed) fs.writeFileSync(preview.internal.configPath, before);
      else fs.rmSync(preview.internal.configPath, { force: true });
    } catch {}
    const wrapped = new Error('homepage_config_save_failed');
    wrapped.rollback = { attempted: true, completed: true };
    wrapped.cause = error;
    throw wrapped;
  }
}

export function buildHomepagePublicPreview({ v2Root, projectRoot = process.cwd() }) {
  const state = loadHomepageState({ v2Root, projectRoot });
  if (!state.configExists || state.configErrors.length) throw new Error('homepage_config_not_ready');
  const validation = validateSelection(state.selection, state.internal.catalogs);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  const nextHome = publicHomeFromSelection(validation.selection, state.internal.catalogs);
  const serialized = `${JSON.stringify(nextHome, null, 2)}\n`;
  if (PRIVACY_RULES.some(rule => rule.test(serialized))) throw new Error('homepage_public_privacy_rule_hit');
  const before = fs.readFileSync(state.internal.homePath, 'utf8');
  return {
    ok: true,
    errors: [],
    state: stableJson(JSON.parse(before)) === stableJson(nextHome) ? 'current' : 'ready',
    homeChanged: stableJson(JSON.parse(before)) !== stableJson(nextHome),
    selectedEntries: Object.values(HOMEPAGE_LIMITS).reduce((sum, count) => sum + count, 0),
    counts: nextHome.counts,
    writeTarget: 'public/data/home.json',
    digest: sha256(serialized),
    internal: { homePath: state.internal.homePath, serialized },
  };
}

export function applyHomepagePublicSync({ expectedDigest, v2Root, projectRoot = process.cwd() }) {
  const preview = buildHomepagePublicPreview({ v2Root, projectRoot });
  if (!preview.ok) throw new Error('homepage_public_validation_failed');
  if (preview.digest !== expectedDigest) throw new Error('homepage_public_preview_changed');
  if (!preview.homeChanged) return { ...preview, state: 'current', internal: undefined };
  const before = fs.readFileSync(preview.internal.homePath);
  try {
    atomicWrite(preview.internal.homePath, preview.internal.serialized);
    const written = JSON.parse(fs.readFileSync(preview.internal.homePath, 'utf8'));
    if (stableJson(written) !== stableJson(JSON.parse(preview.internal.serialized))) {
      throw new Error('homepage_public_verification_failed');
    }
    return { ...preview, state: 'synced', internal: undefined };
  } catch (error) {
    try { fs.writeFileSync(preview.internal.homePath, before); } catch {}
    const wrapped = new Error('homepage_public_sync_failed');
    wrapped.rollback = { attempted: true, completed: true };
    wrapped.cause = error;
    throw wrapped;
  }
}
