import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ARCHIVE_DATA_ROOT,
  inspectArchiveDataRoots,
  resolveArchiveDataRoot,
} from './archive-paths.mjs';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'yuarchive-paths-'));
const currentRoot = path.join(sandbox, 'Archive');
const legacyRoot = path.join(sandbox, 'ArchiveData-v2');
try {
  assert.equal(inspectArchiveDataRoots({ currentRoot, legacyRoot }).state, 'missing');
  assert.equal(
    resolveArchiveDataRoot({ currentRoot, legacyRoot, allowMissing: true }),
    currentRoot,
  );

  fs.mkdirSync(legacyRoot);
  assert.equal(inspectArchiveDataRoots({ currentRoot, legacyRoot }).state, 'legacy');
  assert.equal(resolveArchiveDataRoot({ currentRoot, legacyRoot }), legacyRoot);

  fs.mkdirSync(currentRoot);
  assert.equal(inspectArchiveDataRoots({ currentRoot, legacyRoot }).state, 'conflict');
  assert.throws(
    () => resolveArchiveDataRoot({ currentRoot, legacyRoot }),
    /archive_data_root_conflict/,
  );

  fs.rmSync(legacyRoot, { recursive: true });
  assert.equal(inspectArchiveDataRoots({ currentRoot, legacyRoot }).state, 'current');
  assert.equal(resolveArchiveDataRoot({ currentRoot, legacyRoot }), currentRoot);
  assert.equal(resolveArchiveDataRoot(), ARCHIVE_DATA_ROOT);

  console.log('[PASS] Archive data root resolution');
  console.log('  missing/current/legacy: passed');
  console.log('  dualRootConflict: blocked');
  console.log('  configuredRoot: Archive');
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
