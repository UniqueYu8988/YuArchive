import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';
import { runGamesMigration } from './migrate-archive-data-v2-games.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-data-v2-games-migration-check-'));
try {
  const plan = runGamesMigration({ v2Root: tempRoot });
  assert.equal(plan.ok, true);
  assert.equal(plan.mode, 'plan');
  assert.equal(plan.writeScope, 'none');

  const blocked = runGamesMigration({
    execute: true,
    authorization: 'wrong authorization',
    v2Root: tempRoot,
  });
  assert.equal(blocked.ok, false);
  assert(blocked.blockedReasons.includes('authorization_phrase_mismatch'));

  const result = runGamesMigration({
    execute: true,
    authorization: 'I authorize ArchiveData-v2 Games migration',
    v2Root: tempRoot,
  });
  assert.equal(result.ok, true);
  assert.equal(result.entries, 282);
  assert.equal(result.seasons, 40);
  assert.equal(result.manifestRecords, 329);
  assert.equal(result.sourceChangedFiles, 0);
  const shape = evaluateGamesV2Shape({ v2Root: tempRoot });
  assert.equal(shape.ok, true);

  console.log('[PASS] ArchiveData-v2 Games migration sandbox');
  console.log('  planMode: passed');
  console.log('  invalidAuthorizationBlocked: passed');
  console.log(`  entries: ${result.entries}`);
  console.log(`  seasons: ${result.seasons}`);
  console.log(`  manifestRecords: ${result.manifestRecords}`);
  console.log(`  sourceChangedFiles: ${result.sourceChangedFiles}`);
  console.log('  writeScope: system-temp-only');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
