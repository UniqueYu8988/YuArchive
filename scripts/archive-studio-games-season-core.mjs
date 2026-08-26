import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ARCHIVE_DATA_V2_ROOT,
  ARCHIVE_SOURCE_ROOT,
  GAME_ID_PATTERN,
  IMAGE_EXTENSIONS,
  SEASON_ID_PATTERN,
  parseV2GameYaml,
} from './archive-data-v2-games-core.mjs';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';
import { snapshotFileMetadata } from './archive-studio-v0-music-create-core.mjs';
import { buildBoardPublicCatalog } from './archive-studio-public-sync-core.mjs';

const CREATE_COVER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const OPTIONAL_FIELDS = ['period', 'theme', 'feature', 'champion', 'note', 'build'];

function existsFile(target) {
  try { return fs.statSync(target).isFile(); } catch { return false; }
}

function existsDir(target) {
  try { return fs.statSync(target).isDirectory(); } catch { return false; }
}

function listDirs(target) {
  try { return fs.readdirSync(target, { withFileTypes: true }).filter(item => item.isDirectory()); } catch { return []; }
}

function listFiles(target) {
  try { return fs.readdirSync(target, { withFileTypes: true }).filter(item => item.isFile()); } catch { return []; }
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').trim();
}

function normalizeExtension(value) {
  const extension = normalize(value).toLowerCase();
  if (!extension) return '';
  return extension.startsWith('.') ? extension : `.${extension}`;
}

function resolveInside(root, relativePath) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) {
    throw new Error('unsafe_season_relative_path');
  }
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(path.resolve(root), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('season_path_escaped_root');
  return resolved;
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function issue(code, message, field) {
  return { code, message, field };
}

function seasonRows(parentRoot) {
  return listDirs(path.join(parentRoot, 'seasons')).map(child => {
    const parsed = parseV2GameYaml(path.join(parentRoot, 'seasons', child.name, 'season.yaml'));
    return { id: child.name, fields: parsed.data, errors: parsed.errors };
  });
}

export function listGameSeasonParents({ v2Root = ARCHIVE_DATA_V2_ROOT, projectRoot = process.cwd() } = {}) {
  const root = path.join(v2Root, 'entries', 'games', 'live_game');
  const catalog = buildBoardPublicCatalog({ board: 'games', v2Root, projectRoot });
  const publicById = new Map(catalog.entries.map(entry => [entry.id, entry]));
  return listDirs(root).map(child => {
    const parentRoot = path.join(root, child.name);
    const parsed = parseV2GameYaml(path.join(parentRoot, 'entry.yaml'));
    if (parsed.errors.length || parsed.data.kind !== 'live_game') throw new Error('live_game_parent_invalid');
    const seasons = seasonRows(parentRoot);
    if (seasons.some(season => season.errors.length)) throw new Error('live_game_season_invalid');
    const supportedFields = OPTIONAL_FIELDS.filter(field => seasons.some(season => normalize(season.fields[field])));
    const orders = seasons.map(season => Number(season.fields.order)).filter(Number.isFinite);
    const labels = seasons.map(season => normalize(season.fields.label)).filter(Boolean);
    return {
      id: child.name,
      title: normalize(parsed.data.title),
      seasonCount: seasons.length,
      nextOrder: orders.length ? Math.max(...orders) + 1 : 1,
      defaultLabel: labels.at(-1) ?? '赛季',
      supportedFields,
      publiclySynced: publicById.get(child.name)?.synced === true,
    };
  }).sort((left, right) => left.title.localeCompare(right.title));
}

export function buildGameSeasonPreview(payload) {
  const errors = [];
  const warnings = [];
  const mode = normalize(payload?.mode);
  const board = normalize(payload?.board);
  const kind = normalize(payload?.kind);
  const id = normalize(payload?.id).toLowerCase();
  const parentId = normalize(payload?.parentId).toLowerCase();
  const fields = payload?.fields && typeof payload.fields === 'object' ? payload.fields : {};
  const title = normalize(fields.title);
  const label = normalize(fields.label);
  const order = Number(fields.order);
  const cover = payload?.assets?.cover;
  const coverExtension = normalizeExtension(cover?.extension);

  if (mode !== 'create') errors.push(issue('invalid_mode', 'mode must be create', 'mode'));
  if (board !== 'games') errors.push(issue('invalid_board', 'board must be games', 'board'));
  if (kind !== 'season') errors.push(issue('invalid_kind', 'kind must be season', 'kind'));
  if (!SEASON_ID_PATTERN.test(id)) errors.push(issue('invalid_season_id', 'season id is invalid', 'id'));
  if (!GAME_ID_PATTERN.test(parentId)) errors.push(issue('invalid_parent_id', 'parent id is invalid', 'parentId'));
  if (!title) errors.push(issue('missing_title', 'title is required', 'fields.title'));
  if (!label) errors.push(issue('missing_label', 'label is required', 'fields.label'));
  if (!Number.isFinite(order)) errors.push(issue('invalid_order', 'order must be a number', 'fields.order'));
  if (!cover) errors.push(issue('missing_cover', 'cover is required', 'assets.cover'));
  if (cover && !CREATE_COVER_EXTENSIONS.has(coverExtension)) {
    errors.push(issue('invalid_cover_extension', 'cover extension is not allowed', 'assets.cover.extension'));
  }

  const optional = Object.fromEntries(OPTIONAL_FIELDS.map(field => [field, normalize(fields[field])]));
  const entryRelativeDir = `entries/games/live_game/${parentId}/seasons/${id}`;
  const target = {
    entryId: id,
    parentId,
    entryRelativeDir,
    seasonYaml: `${entryRelativeDir}/season.yaml`,
    cover: `${entryRelativeDir}/cover${coverExtension || '.invalid'}`,
  };
  return {
    ok: errors.length === 0,
    mode, board, kind, id, parentId,
    normalized: {
      fields: { title, label, order, ...optional },
      assets: cover ? { cover: { source: 'selected-file', originalName: path.basename(normalize(cover.originalName)), extension: coverExtension } } : {},
    },
    target,
    operations: [
      { type: 'create', role: 'season_yaml', relativePath: target.seasonYaml, willOverwrite: false },
      { type: 'create', role: 'cover', relativePath: target.cover, willOverwrite: false },
    ],
    warnings,
    errors,
  };
}

export function assertGameSeasonPreviewSafe(preview) {
  const prefix = `entries/games/live_game/${preview.parentId}/seasons/${preview.id}/`;
  for (const relativePath of [preview.target.seasonYaml, preview.target.cover, ...preview.operations.map(item => item.relativePath)]) {
    if (path.isAbsolute(relativePath) || relativePath.includes('\\') || relativePath.split('/').includes('..') || !relativePath.startsWith(prefix)) {
      throw new Error('unsafe_game_season_preview_path');
    }
  }
  if (preview.operations.some(item => item.type !== 'create' || item.willOverwrite)) throw new Error('unsafe_game_season_preview_operation');
  return true;
}

export function evaluateGameSeasonWriteGate(payload, {
  v2Root = ARCHIVE_DATA_V2_ROOT,
  projectRoot = process.cwd(),
  expectedMinimumEntries = 282,
  expectedMinimumKinds,
  expectedSeasons = 40,
  expectedMinimumMetadataDisabled = 93,
  expectedLiveParentCovers = 2,
  requireMigrationBaseline = true,
} = {}) {
  const preview = buildGameSeasonPreview(payload);
  assertGameSeasonPreviewSafe(preview);
  const baseline = evaluateGamesV2Shape({
    v2Root, expectedMinimumEntries,
    ...(expectedMinimumKinds ? { expectedMinimumKinds } : {}),
    expectedSeasons, expectedMinimumMetadataDisabled, expectedLiveParentCovers, requireMigrationBaseline,
  });
  const parents = listGameSeasonParents({ v2Root, projectRoot });
  const parent = parents.find(item => item.id === preview.parentId);
  const parentRoot = path.join(v2Root, 'entries', 'games', 'live_game', preview.parentId);
  const existingSeasons = parent ? seasonRows(parentRoot) : [];
  const titleConflict = existingSeasons.some(item => normalize(item.fields.title).toLowerCase() === preview.normalized.fields.title.toLowerCase());
  const orderConflict = existingSeasons.some(item => Number(item.fields.order) === preview.normalized.fields.order);
  const targetEntryDir = resolveInside(v2Root, preview.target.entryRelativeDir);
  const targetEntryExists = existsDir(targetEntryDir);
  const targetFiles = [preview.target.seasonYaml, preview.target.cover];
  const targetFilesExisting = targetFiles.filter(relativePath => existsFile(resolveInside(v2Root, relativePath))).length;
  const unsupportedFields = OPTIONAL_FIELDS.filter(field => preview.normalized.fields[field] && !parent?.supportedFields.includes(field));
  const blockedReasons = [
    ...preview.errors.map(error => error.code),
    !baseline.ok ? 'games_v2_baseline_failed' : null,
    !parent ? 'live_game_parent_missing' : null,
    parent && !parent.publiclySynced ? 'live_game_parent_not_synced' : null,
    titleConflict ? 'season_title_conflict' : null,
    orderConflict ? 'season_order_conflict' : null,
    unsupportedFields.length ? 'season_fields_not_supported_by_parent' : null,
    targetEntryExists ? 'create_target_exists' : null,
    targetFilesExisting ? 'create_target_files_exist' : null,
  ].filter(Boolean);
  return {
    ok: blockedReasons.length === 0,
    allowedToRequestWrite: blockedReasons.length === 0,
    preview, target: preview.target, operations: preview.operations,
    targetEntryExists, targetFilesExisting, blockedReasons,
    baseline: { ok: baseline.ok, totalEntries: baseline.totalEntries, seasonYamlFiles: baseline.seasonYamlFiles, privacyRuleHits: baseline.privacyRuleHits },
  };
}

function serializeSeason(preview) {
  const fields = preview.normalized.fields;
  const lines = [
    `id: ${preview.id}`,
    `title: ${yamlString(fields.title)}`,
    `label: ${yamlString(fields.label)}`,
    `order: ${fields.order}`,
  ];
  for (const field of OPTIONAL_FIELDS) if (fields[field]) lines.push(`${field}: ${yamlString(fields[field])}`);
  lines.push('legacy: {}', '');
  return lines.join('\n');
}

function assertManifestSafe(value) {
  const text = JSON.stringify(value);
  if (/[A-Za-z]:[\\/]+Users[\\/]/i.test(text) || /OneDrive|Data backup/i.test(text) || /\b(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i.test(text)) {
    throw new Error('season_manifest_privacy_violation');
  }
}

export async function createGameSeason({
  payload,
  coverBuffer,
  v2Root = ARCHIVE_DATA_V2_ROOT,
  sourceRoot = ARCHIVE_SOURCE_ROOT,
  projectRoot = process.cwd(),
  expectedMinimumEntries = 282,
  expectedMinimumKinds,
  expectedSeasons = 40,
  expectedMinimumMetadataDisabled = 93,
  expectedLiveParentCovers = 2,
  requireMigrationBaseline = true,
} = {}) {
  const gateOptions = { v2Root, projectRoot, expectedMinimumEntries, expectedMinimumKinds, expectedSeasons, expectedMinimumMetadataDisabled, expectedLiveParentCovers, requireMigrationBaseline };
  const gate = evaluateGameSeasonWriteGate(payload, gateOptions);
  if (!gate.allowedToRequestWrite) throw new Error(`season_payload_blocked:${gate.blockedReasons.join(',')}`);
  if (!Buffer.isBuffer(coverBuffer) || !coverBuffer.length) throw new Error('cover_bytes_required');
  const preview = gate.preview;
  const targetDir = resolveInside(v2Root, preview.target.entryRelativeDir);
  const parentSeasonsDir = path.dirname(targetDir);
  const transactionId = `create-season-${preview.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const transactionDir = resolveInside(v2Root, `migration/archive-studio-v0/transactions/${transactionId}`);
  const pendingDir = resolveInside(v2Root, 'migration/archive-studio-v0/pending-public/games');
  const pendingPath = path.join(pendingDir, `${preview.parentId}--${preview.id}.json`);
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-studio-game-season-'));
  const yaml = Buffer.from(serializeSeason(preview), 'utf8');
  const items = [
    { role: 'season_yaml', relativePath: preview.target.seasonYaml, content: yaml },
    { role: 'cover', relativePath: preview.target.cover, content: coverBuffer },
  ].map(item => ({ ...item, bytes: item.content.length, checksum: sha256(item.content) }));
  const sourceBefore = await snapshotFileMetadata(sourceRoot);
  const created = [];
  let stage = 'staging';
  try {
    for (const item of items) {
      const staged = path.join(stageRoot, `${item.role}.stage`);
      fs.writeFileSync(staged, item.content, { flag: 'wx' });
      if (sha256(fs.readFileSync(staged)) !== item.checksum) throw new Error('season_stage_checksum_failed');
    }
    stage = 'season-write';
    fs.mkdirSync(parentSeasonsDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: false });
    for (const item of items) {
      const target = resolveInside(v2Root, item.relativePath);
      fs.writeFileSync(target, item.content, { flag: 'wx' });
      created.push(target);
      if (sha256(fs.readFileSync(target)) !== item.checksum) throw new Error('season_write_checksum_failed');
    }
    stage = 'shape-check';
    const shape = evaluateGamesV2Shape({
      v2Root, expectedMinimumEntries,
      ...(expectedMinimumKinds ? { expectedMinimumKinds } : {}),
      expectedSeasons: expectedSeasons + 1, expectedMinimumMetadataDisabled, expectedLiveParentCovers, requireMigrationBaseline,
    });
    if (!shape.ok) throw new Error('season_post_write_shape_failed');
    stage = 'source-check';
    const sourceAfter = await snapshotFileMetadata(sourceRoot);
    const sourceUnchanged = sourceBefore.files === sourceAfter.files && sourceBefore.digest === sourceAfter.digest;
    if (!sourceUnchanged) throw new Error('source_metadata_changed');
    stage = 'manifest';
    const catalog = buildBoardPublicCatalog({ board: 'games', v2Root, projectRoot });
    const parent = catalog.entries.find(item => item.id === preview.parentId);
    if (!parent?.publicId) throw new Error('season_public_parent_missing');
    const marker = {
      board: 'games', kind: 'live_game', entryId: preview.parentId, publicId: parent.publicId,
      seasonId: preview.id, replacedAssets: [], transactionId,
    };
    const manifests = {
      preview: { transactionId, mode: 'create', board: 'games', kind: 'season', parentId: preview.parentId, seasonId: preview.id, operations: preview.operations },
      write: { transactionId, createdFiles: items.map(item => ({ role: item.role, relativePath: item.relativePath, bytes: item.bytes, sha256: item.checksum })) },
      rollback: { transactionId, deleteCreatedFiles: items.map(item => item.relativePath).reverse(), removeEmptyEntryDirectory: preview.target.entryRelativeDir },
    };
    assertManifestSafe({ marker, manifests });
    fs.mkdirSync(transactionDir, { recursive: true });
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(path.join(transactionDir, 'preview.json'), `${JSON.stringify(manifests.preview, null, 2)}\n`, { flag: 'wx' });
    fs.writeFileSync(path.join(transactionDir, 'write.json'), `${JSON.stringify(manifests.write, null, 2)}\n`, { flag: 'wx' });
    fs.writeFileSync(path.join(transactionDir, 'rollback.json'), `${JSON.stringify(manifests.rollback, null, 2)}\n`, { flag: 'wx' });
    fs.writeFileSync(pendingPath, `${JSON.stringify(marker, null, 2)}\n`, { flag: 'wx' });
    return {
      ok: true, seasonId: preview.id, parentId: preview.parentId,
      entryRelativeDir: preview.target.entryRelativeDir, transactionId,
      createdEntryFiles: items.length, seasons: shape.seasonYamlFiles,
      sourceUnchanged, publicSyncPending: true, check: shape,
    };
  } catch (error) {
    const rollbackErrors = [];
    const attempt = operation => { try { operation(); } catch (rollbackError) { if (!['ENOENT', 'ENOTEMPTY'].includes(rollbackError?.code)) rollbackErrors.push(String(rollbackError?.message ?? rollbackError)); } };
    attempt(() => fs.rmSync(pendingPath, { force: true }));
    attempt(() => fs.rmSync(transactionDir, { recursive: true, force: true }));
    for (const target of created.reverse()) attempt(() => fs.rmSync(target, { force: true }));
    attempt(() => fs.rmdirSync(targetDir));
    const wrapped = new Error(`Game season create failed during ${stage}; rollback ${rollbackErrors.length ? 'needs review' : 'completed'}`);
    wrapped.code = 'games_season_create_transaction_failed';
    wrapped.statusCode = 500;
    wrapped.stage = stage;
    wrapped.rollback = { attempted: true, completed: rollbackErrors.length === 0, errorCount: rollbackErrors.length };
    wrapped.cause = error;
    throw wrapped;
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}

export async function replaceGameSeasonCover({
  parentId,
  seasonId,
  coverBuffer,
  coverExtension,
  originalName = '',
  v2Root = ARCHIVE_DATA_V2_ROOT,
  sourceRoot = ARCHIVE_SOURCE_ROOT,
  projectRoot = process.cwd(),
  expectedMinimumEntries = 282,
  expectedMinimumKinds,
  expectedSeasons = 41,
  expectedMinimumMetadataDisabled = 93,
  expectedLiveParentCovers = 2,
  requireMigrationBaseline = true,
} = {}) {
  const normalizedParentId = normalize(parentId).toLowerCase();
  const normalizedSeasonId = normalize(seasonId).toLowerCase();
  const extension = normalizeExtension(coverExtension);
  if (!GAME_ID_PATTERN.test(normalizedParentId)) throw new Error('invalid_parent_id');
  if (!SEASON_ID_PATTERN.test(normalizedSeasonId)) throw new Error('invalid_season_id');
  if (!CREATE_COVER_EXTENSIONS.has(extension)) throw new Error('invalid_cover_extension');
  if (!Buffer.isBuffer(coverBuffer) || !coverBuffer.length) throw new Error('cover_bytes_required');

  const baseline = evaluateGamesV2Shape({
    v2Root, expectedMinimumEntries,
    ...(expectedMinimumKinds ? { expectedMinimumKinds } : {}),
    expectedSeasons, expectedMinimumMetadataDisabled, expectedLiveParentCovers, requireMigrationBaseline,
  });
  if (!baseline.ok) throw new Error('games_v2_baseline_failed');

  const seasonRelativeDir = `entries/games/live_game/${normalizedParentId}/seasons/${normalizedSeasonId}`;
  const seasonDir = resolveInside(v2Root, seasonRelativeDir);
  const parentYaml = resolveInside(v2Root, `entries/games/live_game/${normalizedParentId}/entry.yaml`);
  const seasonYaml = resolveInside(v2Root, `${seasonRelativeDir}/season.yaml`);
  if (!existsFile(parentYaml) || !existsFile(seasonYaml)) throw new Error('game_season_missing');
  const parent = parseV2GameYaml(parentYaml);
  const season = parseV2GameYaml(seasonYaml);
  if (parent.errors.length || parent.data.kind !== 'live_game' || season.errors.length) throw new Error('game_season_invalid');

  const currentCovers = listFiles(seasonDir).filter(item => {
    const parsed = path.parse(item.name);
    return parsed.name.toLowerCase() === 'cover' && IMAGE_EXTENSIONS.has(parsed.ext.toLowerCase());
  });
  if (currentCovers.length !== 1) throw new Error('game_season_cover_count_invalid');

  const currentRelativePath = `${seasonRelativeDir}/${currentCovers[0].name}`;
  const targetRelativePath = `${seasonRelativeDir}/cover${extension}`;
  const currentPath = resolveInside(v2Root, currentRelativePath);
  const targetPath = resolveInside(v2Root, targetRelativePath);
  const transactionId = `replace-season-cover-${normalizedSeasonId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const transactionRelativeDir = `migration/archive-studio-v0/transactions/${transactionId}`;
  const transactionDir = resolveInside(v2Root, transactionRelativeDir);
  const backupRelativePath = `${transactionRelativeDir}/backup/${currentCovers[0].name}`;
  const backupPath = resolveInside(v2Root, backupRelativePath);
  const pendingDir = resolveInside(v2Root, 'migration/archive-studio-v0/pending-public/games');
  const pendingPath = path.join(pendingDir, `${normalizedParentId}--${normalizedSeasonId}-cover-${Date.now()}.json`);
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-studio-game-season-cover-'));
  const stagedPath = path.join(stageRoot, `cover${extension}`);
  const newChecksum = sha256(coverBuffer);
  const oldBuffer = fs.readFileSync(currentPath);
  const oldChecksum = sha256(oldBuffer);
  const sourceBefore = await snapshotFileMetadata(sourceRoot);
  let stage = 'staging';
  let targetWritten = false;
  let oldRemoved = false;
  let temporaryTarget = '';
  try {
    fs.writeFileSync(stagedPath, coverBuffer, { flag: 'wx' });
    if (sha256(fs.readFileSync(stagedPath)) !== newChecksum) throw new Error('season_cover_stage_checksum_failed');

    stage = 'transaction-backup';
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(currentPath, backupPath, fs.constants.COPYFILE_EXCL);
    if (sha256(fs.readFileSync(backupPath)) !== oldChecksum) throw new Error('season_cover_backup_checksum_failed');

    const catalog = buildBoardPublicCatalog({ board: 'games', v2Root, projectRoot });
    const publicParent = catalog.entries.find(item => item.id === normalizedParentId);
    if (!publicParent?.publicId) throw new Error('season_public_parent_missing');
    const marker = {
      board: 'games', kind: 'live_game', entryId: normalizedParentId, publicId: publicParent.publicId,
      seasonId: normalizedSeasonId, replacedAssets: ['season_cover'], transactionId,
    };
    const operations = [
      { type: 'replace', role: 'season_cover', relativePath: targetRelativePath, willOverwrite: targetPath === currentPath },
      ...(targetPath === currentPath ? [] : [{ type: 'remove-replaced-source', role: 'previous_season_cover', relativePath: currentRelativePath }]),
    ];
    const manifests = {
      preview: {
        transactionId, mode: 'update', board: 'games', kind: 'season', parentId: normalizedParentId,
        seasonId: normalizedSeasonId, originalName: path.basename(normalize(originalName)), operations,
      },
      write: {
        transactionId,
        replacedFile: { role: 'season_cover', relativePath: targetRelativePath, bytes: coverBuffer.length, sha256: newChecksum },
        previousFile: { role: 'season_cover', relativePath: currentRelativePath, bytes: oldBuffer.length, sha256: oldChecksum },
      },
      rollback: {
        transactionId, restoreFrom: backupRelativePath, restoreTo: currentRelativePath,
        removeReplacement: targetPath === currentPath ? '' : targetRelativePath,
      },
    };
    assertManifestSafe({ marker, manifests });
    fs.writeFileSync(path.join(transactionDir, 'preview.json'), `${JSON.stringify(manifests.preview, null, 2)}\n`, { flag: 'wx' });
    fs.writeFileSync(path.join(transactionDir, 'write.json'), `${JSON.stringify(manifests.write, null, 2)}\n`, { flag: 'wx' });
    fs.writeFileSync(path.join(transactionDir, 'rollback.json'), `${JSON.stringify(manifests.rollback, null, 2)}\n`, { flag: 'wx' });

    stage = 'season-cover-write';
    temporaryTarget = `${targetPath}.studio-${crypto.randomUUID()}.tmp`;
    fs.copyFileSync(stagedPath, temporaryTarget, fs.constants.COPYFILE_EXCL);
    if (targetPath === currentPath) {
      fs.rmSync(currentPath, { force: true });
      oldRemoved = true;
    }
    fs.renameSync(temporaryTarget, targetPath);
    targetWritten = true;
    if (targetPath !== currentPath) {
      fs.rmSync(currentPath, { force: true });
      oldRemoved = true;
    }
    if (sha256(fs.readFileSync(targetPath)) !== newChecksum) throw new Error('season_cover_write_checksum_failed');

    stage = 'shape-check';
    const shape = evaluateGamesV2Shape({
      v2Root, expectedMinimumEntries,
      ...(expectedMinimumKinds ? { expectedMinimumKinds } : {}),
      expectedSeasons, expectedMinimumMetadataDisabled, expectedLiveParentCovers, requireMigrationBaseline,
    });
    if (!shape.ok) throw new Error('season_cover_post_write_shape_failed');

    stage = 'source-check';
    const sourceAfter = await snapshotFileMetadata(sourceRoot);
    const sourceUnchanged = sourceBefore.files === sourceAfter.files && sourceBefore.digest === sourceAfter.digest;
    if (!sourceUnchanged) throw new Error('source_metadata_changed');

    stage = 'pending-public';
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(pendingPath, `${JSON.stringify(marker, null, 2)}\n`, { flag: 'wx' });
    return {
      ok: true, parentId: normalizedParentId, seasonId: normalizedSeasonId, transactionId,
      sourceRelativePath: targetRelativePath, sourceBytes: coverBuffer.length,
      sourceUnchanged, publicSyncPending: true, check: shape,
    };
  } catch (error) {
    const rollbackErrors = [];
    const attempt = operation => { try { operation(); } catch (rollbackError) { if (!['ENOENT'].includes(rollbackError?.code)) rollbackErrors.push(String(rollbackError?.message ?? rollbackError)); } };
    attempt(() => fs.rmSync(pendingPath, { force: true }));
    if (temporaryTarget) attempt(() => fs.rmSync(temporaryTarget, { force: true }));
    if (targetWritten) attempt(() => fs.rmSync(targetPath, { force: true }));
    if ((targetWritten || oldRemoved) && existsFile(backupPath)) {
      attempt(() => fs.copyFileSync(backupPath, currentPath));
    }
    attempt(() => fs.rmSync(transactionDir, { recursive: true, force: true }));
    const wrapped = new Error(`Game season cover replace failed during ${stage}; rollback ${rollbackErrors.length ? 'needs review' : 'completed'}`);
    wrapped.code = 'games_season_cover_replace_transaction_failed';
    wrapped.statusCode = 500;
    wrapped.stage = stage;
    wrapped.rollback = { attempted: true, completed: rollbackErrors.length === 0, errorCount: rollbackErrors.length };
    wrapped.cause = error;
    throw wrapped;
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}

export const GAME_SEASON_RULES = {
  optionalFields: OPTIONAL_FIELDS,
  coverExtensions: [...CREATE_COVER_EXTENSIONS],
  seasonIdPattern: SEASON_ID_PATTERN.source,
};
