import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ARCHIVE_SOURCE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');
export const ARCHIVE_DATA_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Archive');
export const LEGACY_ARCHIVE_DATA_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'ArchiveData-v2');

function existsDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

export function inspectArchiveDataRoots({
  currentRoot = ARCHIVE_DATA_ROOT,
  legacyRoot = LEGACY_ARCHIVE_DATA_ROOT,
} = {}) {
  const currentExists = existsDirectory(currentRoot);
  const legacyExists = existsDirectory(legacyRoot);
  return {
    currentExists,
    legacyExists,
    state: currentExists && legacyExists
      ? 'conflict'
      : currentExists
        ? 'current'
        : legacyExists
          ? 'legacy'
          : 'missing',
  };
}

export function resolveArchiveDataRoot({
  allowLegacy = true,
  allowMissing = false,
  currentRoot = ARCHIVE_DATA_ROOT,
  legacyRoot = LEGACY_ARCHIVE_DATA_ROOT,
} = {}) {
  const state = inspectArchiveDataRoots({ currentRoot, legacyRoot });
  if (state.state === 'conflict') throw new Error('archive_data_root_conflict');
  if (state.state === 'current') return currentRoot;
  if (state.state === 'legacy' && allowLegacy) return legacyRoot;
  if (state.state === 'missing' && allowMissing) return currentRoot;
  if (state.state === 'legacy') throw new Error('archive_data_root_migration_required');
  throw new Error('archive_data_root_missing');
}

export function assertArchiveDataWriteRoot(target) {
  const resolvedTarget = path.resolve(target);
  const state = inspectArchiveDataRoots();
  if (state.state === 'conflict') throw new Error('archive_data_root_conflict');
  const expected = path.resolve(resolveArchiveDataRoot({ allowLegacy: true }));
  if (resolvedTarget !== expected) throw new Error('archive_data_write_root_mismatch');
  return expected;
}
