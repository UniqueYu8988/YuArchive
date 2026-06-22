import crypto from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ARCHIVE_SOURCE_ROOT,
  resolveArchiveDataRoot,
} from './archive-paths.mjs';
import {
  assertPreviewSafe,
  buildMusicAlbumPreview,
} from './archive-studio-v0-music-preview-core.mjs';
import { evaluateMusicV2Shape } from './check-archive-data-v2-music-shape.mjs';

export { ARCHIVE_SOURCE_ROOT };
export const ARCHIVE_DATA_ROOT = resolveArchiveDataRoot({ allowLegacy: true, allowMissing: true });
export const ARCHIVE_DATA_V2_ROOT = ARCHIVE_DATA_ROOT;

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function resolveInside(root, relativePath) {
  if (
    typeof relativePath !== 'string'
    || path.isAbsolute(relativePath)
    || relativePath.includes('..')
    || relativePath.includes('\\')
  ) {
    throw new Error('unsafe_relative_path');
  }
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('path_escaped_root');
  return resolved;
}

export async function snapshotFileMetadata(root) {
  const records = [];
  if (!(await exists(root))) return { files: 0, digest: sha256(Buffer.from('[]')) };

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        const fileStat = await stat(absolute);
        records.push([
          path.relative(root, absolute).split(path.sep).join('/'),
          fileStat.size,
          Math.trunc(fileStat.mtimeMs),
        ]);
      }
    }
  }

  await visit(root);
  return {
    files: records.length,
    digest: sha256(Buffer.from(JSON.stringify(records))),
  };
}

function yamlScalar(value) {
  return JSON.stringify(String(value));
}

export function serializeMusicAlbumEntryYaml(payload) {
  const fields = payload.fields || {};
  const lines = [
    `id: ${yamlScalar(payload.id)}`,
    'board: music',
    'kind: album',
    `title: ${yamlScalar(fields.title)}`,
  ];
  for (const key of ['date', 'url', 'note', 'description', 'track_title']) {
    if (fields[key] !== undefined && fields[key] !== '') {
      lines.push(`${key}: ${yamlScalar(fields[key])}`);
    }
  }
  lines.push('legacy: {}');
  return `${lines.join('\n')}\n`;
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
  if (blocked.some((rule) => rule.test(serialized))) throw new Error('transaction_manifest_privacy_violation');
}

export async function createMusicAlbumEntry({
  payload,
  coverBuffer,
  audioBuffer,
  v2Root = ARCHIVE_DATA_V2_ROOT,
  sourceRoot = ARCHIVE_SOURCE_ROOT,
  expectedMinimumEntries = 33,
  requireMigrationBaseline = true,
}) {
  if (!Buffer.isBuffer(coverBuffer) || !coverBuffer.byteLength) throw new Error('cover_bytes_required');
  if (!Buffer.isBuffer(audioBuffer) || !audioBuffer.byteLength) throw new Error('audio_bytes_required');

  const preview = buildMusicAlbumPreview(payload);
  assertPreviewSafe(preview);
  if (!preview.ok) throw new Error(`payload_invalid:${preview.errors.map((item) => item.code).join(',')}`);

  const baselineShape = evaluateMusicV2Shape({
    v2Root,
    expectedMinimumEntries,
    requireMigrationBaseline,
  });
  if (!baselineShape.ok) throw new Error('baseline_music_shape_failed');

  const targetEntryDir = resolveInside(v2Root, preview.target.entryRelativeDir);
  if (await exists(targetEntryDir)) throw new Error('target_entry_exists');

  const transactionId = `create-${payload.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const transactionRelativeDir = `migration/archive-studio-v0/transactions/${transactionId}`;
  const transactionDir = resolveInside(v2Root, transactionRelativeDir);
  const transactionsRoot = path.dirname(transactionDir);
  const studioMigrationRoot = path.dirname(transactionsRoot);
  const migrationRoot = path.dirname(studioMigrationRoot);
  const transactionsRootExisted = await exists(transactionsRoot);
  const studioMigrationRootExisted = await exists(studioMigrationRoot);
  const migrationRootExisted = await exists(migrationRoot);
  if (await exists(transactionDir)) throw new Error('transaction_dir_exists');

  const sourceBefore = await snapshotFileMetadata(sourceRoot);
  const stageRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-studio-v0-create-'));
  const items = [
    { role: 'entry_yaml', relativePath: preview.target.entryYaml, content: Buffer.from(serializeMusicAlbumEntryYaml(payload), 'utf8') },
    { role: 'content_md', relativePath: preview.target.contentMd, content: Buffer.from(payload.content?.markdown || '', 'utf8') },
    { role: 'cover', relativePath: preview.target.cover, content: coverBuffer },
    { role: 'audio', relativePath: preview.target.audio, content: audioBuffer },
  ].map((item) => ({
    ...item,
    bytes: item.content.byteLength,
    sha256: sha256(item.content),
  }));
  const createdFiles = [];
  let success = false;
  let stage = 'staging';

  try {
    for (const item of items) {
      const staged = path.join(stageRoot, `${item.role}.stage`);
      await writeFile(staged, item.content, { flag: 'wx' });
      await verifyFile(staged, item);
    }

    stage = 'entry-write';
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
      role,
      operation: 'create',
      relativePath,
      bytes,
      sha256: checksum,
    }));
    const previewManifest = {
      transactionId,
      mode: 'create',
      board: 'music',
      kind: 'album',
      entryId: payload.id,
      scope: preview.target.entryRelativeDir,
      files: manifestItems.map(({ role, relativePath, bytes }) => ({ role, relativePath, bytes })),
    };
    const writeManifest = { transactionId, createdFiles: manifestItems };
    const rollbackManifest = {
      transactionId,
      deleteCreatedFiles: [...manifestItems].reverse().map((item) => item.relativePath),
      removeEmptyEntryDirectory: preview.target.entryRelativeDir,
    };
    assertManifestSafe({ previewManifest, writeManifest, rollbackManifest });
    for (const [name, value] of [
      ['preview.json', previewManifest],
      ['write.json', writeManifest],
      ['rollback.json', rollbackManifest],
    ]) {
      const target = path.join(transactionDir, name);
      await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
      createdFiles.push(target);
    }

    stage = 'post-write-check';
    const postWriteShape = evaluateMusicV2Shape({
      v2Root,
      expectedMinimumEntries: baselineShape.albumEntryDirs + 1,
      requireMigrationBaseline,
    });
    if (!postWriteShape.ok) throw new Error('post_write_music_shape_failed');

    stage = 'source-boundary-check';
    const sourceAfter = await snapshotFileMetadata(sourceRoot);
    const sourceUnchanged = sourceBefore.files === sourceAfter.files && sourceBefore.digest === sourceAfter.digest;
    if (!sourceUnchanged) throw new Error('source_metadata_changed');

    success = true;
    return {
      ok: true,
      entryId: payload.id,
      entryRelativeDir: preview.target.entryRelativeDir,
      transactionId,
      createdEntryFiles: items.length,
      createdTransactionFiles: 3,
      musicEntries: postWriteShape.albumEntryDirs,
      sourceFilesChecked: sourceBefore.files,
      sourceUnchanged,
      writeScope: preview.target.entryRelativeDir,
    };
  } catch (error) {
    const rollbackErrors = [];
    const rollbackStep = async (operation) => {
      try {
        await operation();
      } catch (rollbackError) {
        if (['ENOENT', 'ENOTDIR'].includes(rollbackError?.code)) return;
        rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : 'unknown_rollback_error');
      }
    };
    for (const target of [...createdFiles].reverse()) {
      await rollbackStep(() => rm(target, { force: true }));
    }
    await rollbackStep(() => removeIfEmpty(targetEntryDir));
    await rollbackStep(() => rm(transactionDir, { recursive: true, force: true }));
    if (!transactionsRootExisted) await rollbackStep(() => removeIfEmpty(transactionsRoot));
    if (!studioMigrationRootExisted) await rollbackStep(() => removeIfEmpty(studioMigrationRoot));
    if (!migrationRootExisted) await rollbackStep(() => removeIfEmpty(migrationRoot));

    const wrapped = new Error(`Create failed during ${stage}; rollback ${rollbackErrors.length ? 'needs review' : 'completed'}`);
    wrapped.code = 'create_transaction_failed';
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
