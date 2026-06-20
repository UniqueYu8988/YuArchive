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
} from './archive-data-v2-visions-core.mjs';
import {
  assertVisionsPreviewSafe,
  buildVisionsPreview,
} from './archive-studio-v0-visions-preview-core.mjs';
import { evaluateVisionsV2Shape } from './check-archive-data-v2-visions-shape.mjs';
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

function serializeNewVisionEntry(payload, preview) {
  const fields = preview.normalized.fields;
  return [
    `id: ${yamlString(payload.id)}`,
    'board: visions',
    `kind: ${payload.kind}`,
    `title: ${yamlString(fields.title)}`,
    `period: ${yamlString(fields.period)}`,
    `cinema: ${fields.cinema ? 'true' : 'false'}`,
    `quote: ${yamlString(fields.quote)}`,
    `url: ${yamlString(fields.url)}`,
    'legacy: {}',
    '',
  ].join('\n');
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

export async function createVisionEntry({
  payload,
  posterBuffer,
  v2Root = ARCHIVE_DATA_V2_ROOT,
  sourceRoot = ARCHIVE_SOURCE_ROOT,
  expectedMinimumEntries = 112,
  expectedMinimumKinds,
  expectedCharacters = 20,
  requireMigrationBaseline = true,
}) {
  const preview = buildVisionsPreview(payload);
  assertVisionsPreviewSafe(preview);
  if (!preview.ok) throw new Error(`payload_invalid:${preview.errors.map(item => item.code).join(',')}`);
  if (!Buffer.isBuffer(posterBuffer) || !posterBuffer.byteLength) throw new Error('poster_bytes_required');
  const baselineShape = evaluateVisionsV2Shape({
    v2Root,
    expectedMinimumEntries,
    ...(expectedMinimumKinds ? { expectedMinimumKinds } : {}),
    expectedCharacters,
    requireMigrationBaseline,
  });
  if (!baselineShape.ok) throw new Error('baseline_visions_shape_failed');

  const targetEntryDir = resolveInside(v2Root, preview.target.entryRelativeDir);
  const targetKindDir = path.dirname(targetEntryDir);
  const targetKindDirExisted = await exists(targetKindDir);
  if (await exists(targetEntryDir)) throw new Error('target_entry_exists');
  const transactionId = `create-${payload.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const transactionDir = resolveInside(v2Root, `migration/archive-studio-v0/transactions/${transactionId}`);
  const transactionsRoot = path.dirname(transactionDir);
  const studioMigrationRoot = path.dirname(transactionsRoot);
  const transactionsRootExisted = await exists(transactionsRoot);
  const studioMigrationRootExisted = await exists(studioMigrationRoot);
  const sourceBefore = await snapshotFileMetadata(sourceRoot);
  const stageRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-studio-v0-vision-create-'));
  const yaml = Buffer.from(serializeNewVisionEntry(payload, preview), 'utf8');
  const items = [
    { role: 'entry_yaml', relativePath: preview.target.entryYaml, content: yaml },
    { role: 'poster', relativePath: preview.target.poster, content: posterBuffer },
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
        transactionId,
        mode: 'create',
        board: 'visions',
        kind: payload.kind,
        entryId: payload.id,
        scope: preview.target.entryRelativeDir,
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
    const postWriteShape = evaluateVisionsV2Shape({
      v2Root,
      expectedMinimumEntries: baselineShape.totalEntries + 1,
      ...(expectedMinimumKinds ? { expectedMinimumKinds } : {}),
      expectedCharacters,
      requireMigrationBaseline,
    });
    if (!postWriteShape.ok) throw new Error('post_write_visions_shape_failed');
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
      visionsEntries: postWriteShape.totalEntries,
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
    if (!studioMigrationRootExisted) await rollbackStep(() => removeIfEmpty(studioMigrationRoot));
    const wrapped = new Error(`Vision create failed during ${stage}; rollback ${rollbackErrors.length ? 'needs review' : 'completed'}`);
    wrapped.code = 'visions_create_transaction_failed';
    wrapped.statusCode = 500;
    wrapped.stage = stage;
    wrapped.rollback = {
      attempted: true,
      completed: rollbackErrors.length === 0,
      errorCount: rollbackErrors.length,
    };
    wrapped.cause = error;
    throw wrapped;
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }
}
