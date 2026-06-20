import crypto from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ARCHIVE_DATA_V2_ROOT,
  ARCHIVE_SOURCE_ROOT,
} from './archive-data-v2-games-core.mjs';
import {
  assertGamesPreviewSafe,
  buildGamesPreview,
} from './archive-studio-v0-games-preview-core.mjs';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';
import { snapshotFileMetadata } from './archive-studio-v0-music-create-core.mjs';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function exists(target) {
  try {
    await readFile(target);
    return true;
  } catch (error) {
    if (error.code !== 'EISDIR') return false;
    return true;
  }
}

function resolveInside(root, relativePath) {
  if (
    typeof relativePath !== 'string'
    || path.isAbsolute(relativePath)
    || relativePath.includes('..')
    || relativePath.includes('\\')
  ) throw new Error('unsafe_relative_path');
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('path_escaped_root');
  return resolved;
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function serializeNewGameEntry(payload, preview) {
  const fields = preview.normalized.fields;
  const lines = [
    `id: ${payload.id}`,
    'board: games',
    'kind: normal_game',
    `title: ${yamlString(fields.title)}`,
    `year: ${fields.year}`,
    `metadata_enabled: ${fields.metadata_enabled ? 'true' : 'false'}`,
  ];
  if (fields.metadata_enabled) {
    lines.push(
      `english_title: ${yamlString(fields.english_title)}`,
      `url: ${yamlString(fields.url)}`,
      `platform: ${yamlString(fields.platform)}`,
      `price: ${yamlString(fields.price)}`,
      `rating: ${fields.rating === '' ? '""' : fields.rating}`,
      `playtime: ${yamlString(fields.playtime)}`,
      `completed: ${fields.completed ? 'true' : 'false'}`,
      `genre: ${yamlString(fields.genre)}`,
    );
  }
  lines.push('legacy: {}', '');
  return lines.join('\n');
}

async function verifyFile(target, expected) {
  const actual = await readFile(target);
  if (actual.byteLength !== expected.bytes || sha256(actual) !== expected.sha256) {
    throw new Error(`checksum_mismatch:${expected.role}`);
  }
}

async function removeIfEmpty(directory) {
  try {
    await rmdir(directory);
  } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error;
  }
}

function assertManifestSafe(value) {
  const serialized = JSON.stringify(value);
  const blocked = [
    /[A-Za-z]:[\\/]+Users[\\/]/,
    /OneDrive/i,
    /Data backup/i,
    /\b(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i,
  ];
  if (blocked.some(rule => rule.test(serialized))) throw new Error('transaction_manifest_privacy_violation');
}

export async function createGameEntry({
  payload,
  coverBuffer,
  v2Root = ARCHIVE_DATA_V2_ROOT,
  sourceRoot = ARCHIVE_SOURCE_ROOT,
  expectedMinimumEntries = 282,
  expectedMinimumKinds,
  expectedSeasons = 40,
  expectedMinimumMetadataDisabled = 93,
  expectedLiveParentCovers = 2,
  requireMigrationBaseline = true,
}) {
  const preview = buildGamesPreview(payload);
  assertGamesPreviewSafe(preview);
  if (!preview.ok) throw new Error(`payload_invalid:${preview.errors.map(item => item.code).join(',')}`);
  if (!Buffer.isBuffer(coverBuffer) || !coverBuffer.byteLength) throw new Error('cover_bytes_required');
  const baseline = evaluateGamesV2Shape({
    v2Root,
    expectedMinimumEntries,
    ...(expectedMinimumKinds ? { expectedMinimumKinds } : {}),
    expectedSeasons,
    expectedMinimumMetadataDisabled,
    expectedLiveParentCovers,
    requireMigrationBaseline,
  });
  if (!baseline.ok) throw new Error('baseline_games_shape_failed');

  const targetEntryDir = resolveInside(v2Root, preview.target.entryRelativeDir);
  const targetKindDir = path.dirname(targetEntryDir);
  const targetKindDirExisted = await exists(targetKindDir);
  if (await exists(targetEntryDir)) throw new Error('target_entry_exists');
  const transactionId = `create-${payload.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const transactionDir = resolveInside(v2Root, `migration/archive-studio-v0/transactions/${transactionId}`);
  const transactionsRoot = path.dirname(transactionDir);
  const studioRoot = path.dirname(transactionsRoot);
  const transactionsRootExisted = await exists(transactionsRoot);
  const studioRootExisted = await exists(studioRoot);
  const sourceBefore = await snapshotFileMetadata(sourceRoot);
  const stageRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-studio-v0-game-create-'));
  const yaml = Buffer.from(serializeNewGameEntry(payload, preview), 'utf8');
  const items = [
    { role: 'entry_yaml', relativePath: preview.target.entryYaml, content: yaml },
    { role: 'cover', relativePath: preview.target.cover, content: coverBuffer },
  ].map(item => ({ ...item, bytes: item.content.byteLength, sha256: sha256(item.content) }));
  const createdFiles = [];
  let stage = 'staging';

  try {
    for (const item of items) {
      const staged = path.join(stageRoot, `${item.role}.stage`);
      await writeFile(staged, item.content, { flag: 'wx' });
      await verifyFile(staged, item);
    }
    stage = 'entry-write';
    await mkdir(targetKindDir, { recursive: true });
    await mkdir(targetEntryDir, { recursive: false });
    for (const item of items) {
      const target = resolveInside(v2Root, item.relativePath);
      await writeFile(target, item.content, { flag: 'wx' });
      createdFiles.push(target);
      await verifyFile(target, item);
    }
    stage = 'manifest-write';
    await mkdir(transactionDir, { recursive: true });
    const manifestItems = items.map(({ role, relativePath, bytes, sha256: checksum }) => ({
      role, operation: 'create', relativePath, bytes, sha256: checksum,
    }));
    const manifests = {
      'preview.json': {
        transactionId, mode: 'create', board: 'games', kind: 'normal_game',
        entryId: payload.id, scope: preview.target.entryRelativeDir,
        files: manifestItems.map(({ role, relativePath, bytes }) => ({ role, relativePath, bytes })),
      },
      'write.json': { transactionId, createdFiles: manifestItems },
      'rollback.json': {
        transactionId,
        deleteCreatedFiles: [...manifestItems].reverse().map(item => item.relativePath),
        removeEmptyEntryDirectory: preview.target.entryRelativeDir,
      },
    };
    assertManifestSafe(manifests);
    for (const [name, value] of Object.entries(manifests)) {
      const target = path.join(transactionDir, name);
      await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
      createdFiles.push(target);
    }
    stage = 'post-write-check';
    const postWriteShape = evaluateGamesV2Shape({
      v2Root,
      expectedMinimumEntries: baseline.totalEntries + 1,
      ...(expectedMinimumKinds ? { expectedMinimumKinds } : {}),
      expectedSeasons,
      expectedMinimumMetadataDisabled: expectedMinimumMetadataDisabled + (preview.normalized.fields.metadata_enabled ? 0 : 1),
      expectedLiveParentCovers,
      requireMigrationBaseline,
    });
    if (!postWriteShape.ok) throw new Error('post_write_games_shape_failed');
    stage = 'source-boundary-check';
    const sourceAfter = await snapshotFileMetadata(sourceRoot);
    const sourceUnchanged = sourceBefore.files === sourceAfter.files && sourceBefore.digest === sourceAfter.digest;
    if (!sourceUnchanged) throw new Error('source_metadata_changed');
    return {
      ok: true,
      entryId: payload.id,
      entryRelativeDir: preview.target.entryRelativeDir,
      transactionId,
      createdEntryFiles: items.length,
      createdTransactionFiles: 3,
      gamesEntries: postWriteShape.totalEntries,
      kindCounts: postWriteShape.kindCounts,
      sourceFilesChecked: sourceBefore.files,
      sourceUnchanged,
      writeScope: preview.target.entryRelativeDir,
    };
  } catch (error) {
    const rollbackErrors = [];
    const rollbackStep = async operation => {
      try {
        await operation();
      } catch (rollbackError) {
        if (['ENOENT', 'ENOTDIR'].includes(rollbackError?.code)) return;
        rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : 'unknown_rollback_error');
      }
    };
    for (const target of [...createdFiles].reverse()) await rollbackStep(() => rm(target, { force: true }));
    await rollbackStep(() => removeIfEmpty(targetEntryDir));
    if (!targetKindDirExisted) await rollbackStep(() => removeIfEmpty(targetKindDir));
    await rollbackStep(() => rm(transactionDir, { recursive: true, force: true }));
    if (!transactionsRootExisted) await rollbackStep(() => removeIfEmpty(transactionsRoot));
    if (!studioRootExisted) await rollbackStep(() => removeIfEmpty(studioRoot));
    const wrapped = new Error(`Game create failed during ${stage}; rollback ${rollbackErrors.length ? 'needs review' : 'completed'}`);
    wrapped.code = 'games_create_transaction_failed';
    wrapped.statusCode = 500;
    wrapped.stage = stage;
    wrapped.rollback = { attempted: true, completed: rollbackErrors.length === 0, errorCount: rollbackErrors.length };
    wrapped.cause = error;
    throw wrapped;
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }
}
