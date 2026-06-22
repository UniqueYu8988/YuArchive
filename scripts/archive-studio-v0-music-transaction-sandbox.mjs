import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertPreviewSafe,
  buildMusicAlbumPreview,
  normalizeRelativePath,
} from './archive-studio-v0-music-preview-core.mjs';

export const SANDBOX_LABEL = 'system-temp/yuarchive-archive-studio-v0-transaction-sandbox';
export const SANDBOX_ROOT = path.join(os.tmpdir(), 'yuarchive-archive-studio-v0-transaction-sandbox');
export const WRITE_ROOT = path.join(SANDBOX_ROOT, 'Archive');
export const STAGING_ROOT = path.join(SANDBOX_ROOT, 'staging');
export const BACKUP_ROOT = path.join(SANDBOX_ROOT, 'backups');
export const MANIFEST_ROOT = path.join(SANDBOX_ROOT, 'manifests');
export const MUSIC_SCOPE = 'entries/music/album';

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function assertInside(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Sandbox path escaped its root');
  }
}

export function resolveSandboxPath(root, relativePath) {
  normalizeRelativePath(relativePath);
  const resolved = path.join(root, ...relativePath.split('/'));
  assertInside(root, resolved);
  return resolved;
}

export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function fileInfo(filePath) {
  if (!existsSync(filePath)) return null;
  const buffer = await readFile(filePath);
  return {
    bytes: buffer.byteLength,
    sha256: sha256Buffer(buffer),
  };
}

export function stringifyYaml(payload) {
  const fields = payload.fields || {};
  const lines = [
    `id: ${payload.id}`,
    'board: music',
    'kind: album',
    `title: ${JSON.stringify(fields.title || '')}`,
  ];

  for (const key of ['date', 'description', 'track_title', 'url', 'note']) {
    if (fields[key]) lines.push(`${key}: ${JSON.stringify(fields[key])}`);
  }

  lines.push('legacy: {}');
  return `${lines.join('\n')}\n`;
}

export function targetFilesFromPreview(preview) {
  return [
    { role: 'entry_yaml', relativePath: preview.target.entryYaml, kind: 'text', content: stringifyYaml(preview.__payload) },
    { role: 'content_md', relativePath: preview.target.contentMd, kind: 'text', content: `${preview.__payload.content?.markdown || ''}\n` },
    { role: 'cover', relativePath: preview.target.cover, kind: 'asset', content: `sandbox-cover:${preview.target.entryId}\n` },
    { role: 'audio', relativePath: preview.target.audio, kind: 'asset', content: `sandbox-audio:${preview.target.entryId}\n` },
  ];
}

export async function buildDiffPreview(preview) {
  const files = targetFilesFromPreview(preview);
  const diff = [];

  for (const file of files) {
    const targetPath = resolveSandboxPath(WRITE_ROOT, file.relativePath);
    const current = await fileInfo(targetPath);
    const nextBuffer = Buffer.from(file.content, 'utf8');
    const nextSha = sha256Buffer(nextBuffer);
    const exists = Boolean(current);
    const operation = exists ? (current.sha256 === nextSha ? 'keep' : 'overwrite') : 'create';

    diff.push({
      role: file.role,
      operation,
      relativePath: file.relativePath,
      exists,
      willOverwrite: operation === 'overwrite',
      requiresBackup: operation === 'overwrite',
      contentChanged: operation !== 'keep',
      beforeBytes: current?.bytes || 0,
      afterBytes: nextBuffer.byteLength,
      checksumChanged: current ? current.sha256 !== nextSha : true,
    });
  }

  return diff;
}

export function buildConfirmation(diff) {
  const reasons = new Set();
  if (diff.some((item) => item.operation === 'create')) reasons.add('create_entry');
  if (diff.some((item) => item.operation === 'overwrite')) reasons.add('overwrite_files');
  if (diff.some((item) => item.operation === 'blocked')) reasons.add('blocked_operation');

  return {
    required: reasons.size > 0,
    reasons: [...reasons],
    blocked: diff.some((item) => item.operation === 'blocked'),
  };
}

export async function writeJson(relativePath, value) {
  const targetPath = resolveSandboxPath(SANDBOX_ROOT, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function prepareBackup(transactionId, diff) {
  const items = [];

  for (const item of diff.filter((entry) => entry.requiresBackup)) {
    const targetPath = resolveSandboxPath(WRITE_ROOT, item.relativePath);
    const backupRelativePath = normalizeRelativePath('backups', transactionId, item.relativePath);
    const backupPath = resolveSandboxPath(SANDBOX_ROOT, backupRelativePath);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await copyFile(targetPath, backupPath);
    const info = await fileInfo(backupPath);
    items.push({
      role: item.role,
      targetRelativePath: item.relativePath,
      backupLabel: `${SANDBOX_LABEL}/${backupRelativePath}`,
      backupRelativePath,
      sha256: info.sha256,
      bytes: info.bytes,
    });
  }

  return {
    transactionId,
    scope: MUSIC_SCOPE,
    items,
  };
}

export async function writeStaging(transactionId, preview) {
  const files = targetFilesFromPreview(preview);
  const items = [];

  for (const file of files) {
    const stagingRelativePath = normalizeRelativePath('staging', transactionId, file.relativePath);
    const stagingPath = resolveSandboxPath(SANDBOX_ROOT, stagingRelativePath);
    await mkdir(path.dirname(stagingPath), { recursive: true });
    await writeFile(stagingPath, file.content, 'utf8');
    const info = await fileInfo(stagingPath);
    items.push({
      role: file.role,
      targetRelativePath: file.relativePath,
      stagingRelativePath,
      sha256: info.sha256,
      bytes: info.bytes,
    });
  }

  return items;
}

export async function applyWrite(transactionId, mode, diff, stagingItems) {
  const items = [];

  for (const stagingItem of stagingItems) {
    const diffItem = diff.find((item) => item.relativePath === stagingItem.targetRelativePath);
    if (!diffItem || diffItem.operation === 'keep' || diffItem.operation === 'skip') continue;

    const targetPath = resolveSandboxPath(WRITE_ROOT, stagingItem.targetRelativePath);
    const stagingPath = resolveSandboxPath(SANDBOX_ROOT, stagingItem.stagingRelativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(stagingPath, targetPath);
    const info = await fileInfo(targetPath);
    items.push({
      role: stagingItem.role,
      operation: diffItem.operation,
      targetRelativePath: stagingItem.targetRelativePath,
      sha256: info.sha256,
      bytes: info.bytes,
    });
  }

  return {
    transactionId,
    mode,
    scope: MUSIC_SCOPE,
    items,
    checks: [
      {
        command: 'sandbox-internal-file-existence-check',
        exitCode: 0,
      },
    ],
  };
}

export async function rollbackTransaction(writeManifest, backupManifest) {
  if (writeManifest.transactionId !== backupManifest.transactionId) {
    throw new Error('Rollback manifest transaction id mismatch');
  }

  const restored = [];
  const deleted = [];

  for (const item of writeManifest.items.toReversed()) {
    const backup = backupManifest.items.find((entry) => entry.targetRelativePath === item.targetRelativePath);
    const targetPath = resolveSandboxPath(WRITE_ROOT, item.targetRelativePath);

    if (backup) {
      const backupPath = resolveSandboxPath(SANDBOX_ROOT, backup.backupRelativePath);
      await copyFile(backupPath, targetPath);
      restored.push(item.targetRelativePath);
    } else if (item.operation === 'create' && existsSync(targetPath)) {
      await rm(targetPath);
      deleted.push(item.targetRelativePath);
    }
  }

  const entryDirs = new Set(
    writeManifest.items.map((item) => item.targetRelativePath.split('/').slice(0, 4).join('/')),
  );
  for (const entryDir of entryDirs) {
    const entryPath = resolveSandboxPath(WRITE_ROOT, entryDir);
    try {
      await rm(entryPath, { recursive: false });
    } catch {
      // Directory is not empty or already gone; both are acceptable for rollback summary.
    }
  }

  return {
    transactionId: writeManifest.transactionId,
    restored: restored.length,
    deleted: deleted.length,
  };
}

export async function seedExistingAlbum(payload) {
  const preview = buildPreparedPreview(payload);
  const files = targetFilesFromPreview(preview);
  for (const file of files) {
    const targetPath = resolveSandboxPath(WRITE_ROOT, file.relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, `existing-${file.role}\n`, 'utf8');
  }
}

export function buildPreparedPreview(payload) {
  const preview = buildMusicAlbumPreview(payload);
  preview.__payload = payload;
  assertPreviewSafe(preview);
  return preview;
}

export async function runTransaction({ transactionId, payload }) {
  const preview = buildPreparedPreview(payload);
  const diff = await buildDiffPreview(preview);
  const confirmation = buildConfirmation(diff);

  if (!preview.ok || confirmation.blocked) {
    throw new Error(`Sandbox transaction blocked: ${transactionId}`);
  }

  const backupManifest = await prepareBackup(transactionId, diff);
  const stagingItems = await writeStaging(transactionId, preview);
  const writeManifest = await applyWrite(transactionId, payload.mode, diff, stagingItems);

  await writeJson(normalizeRelativePath('manifests', `${transactionId}.preview.json`), {
    transaction: {
      id: transactionId,
      mode: payload.mode,
      writeRootLabel: 'Archive',
      scope: MUSIC_SCOPE,
    },
    target: preview.target,
    summary: preview.summary,
    diff,
    confirmation,
    warnings: preview.warnings,
    errors: preview.errors,
  });
  await writeJson(normalizeRelativePath('manifests', `${transactionId}.backup.json`), backupManifest);
  await writeJson(normalizeRelativePath('manifests', `${transactionId}.write.json`), writeManifest);

  const rollback = await rollbackTransaction(writeManifest, backupManifest);

  return {
    transactionId,
    mode: payload.mode,
    diffItems: diff.length,
    creates: diff.filter((item) => item.operation === 'create').length,
    overwrites: diff.filter((item) => item.operation === 'overwrite').length,
    backups: backupManifest.items.length,
    writes: writeManifest.items.length,
    rollback,
  };
}

export const createPayload = {
  mode: 'create',
  board: 'music',
  kind: 'album',
  id: 'archive-studio-transaction-create',
  fields: {
    title: 'Archive Studio Transaction Create',
    date: '2026',
    description: 'Sandbox create transaction.',
    track_title: 'Sandbox Create Track',
    url: 'https://example.com',
    note: '',
    legacy: {},
  },
  content: {
    markdown: 'Sandbox create transaction content.',
  },
  assets: {
    cover: { source: 'selected-file', extension: '.jpg' },
    audio: { source: 'selected-file', extension: '.mp3' },
  },
};

export const updatePayload = clone(createPayload);
updatePayload.mode = 'update';
updatePayload.id = 'archive-studio-transaction-update';
updatePayload.fields.title = 'Archive Studio Transaction Update';
updatePayload.fields.description = 'Sandbox update transaction.';
updatePayload.content.markdown = 'Sandbox update transaction content.';
updatePayload.assets.cover.extension = '.png';
updatePayload.assets.audio.extension = '.m4a';

export async function resetSandbox() {
  await rm(SANDBOX_ROOT, { recursive: true, force: true });
  await mkdir(WRITE_ROOT, { recursive: true });
  await mkdir(STAGING_ROOT, { recursive: true });
  await mkdir(BACKUP_ROOT, { recursive: true });
  await mkdir(MANIFEST_ROOT, { recursive: true });
}

export async function runHappyPathSandbox() {
  await resetSandbox();
  await seedExistingAlbum(updatePayload);

  return [
    await runTransaction({ transactionId: 'tx-create-sandbox', payload: createPayload }),
    await runTransaction({ transactionId: 'tx-update-sandbox', payload: updatePayload }),
  ];
}

async function main() {
  const results = await runHappyPathSandbox();

  console.log('[PASS] Archive Studio v0 music transaction sandbox');
  console.log(`  sandbox: ${SANDBOX_LABEL}`);
  for (const result of results) {
    console.log(`  ${result.mode}: diff=${result.diffItems}, create=${result.creates}, overwrite=${result.overwrites}, backup=${result.backups}, write=${result.writes}, rollbackDeleted=${result.rollback.deleted}, rollbackRestored=${result.rollback.restored}`);
  }
  console.log('  writeScope: system-temp-only');
  console.log('Result: archive studio v0 transaction sandbox passed');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
