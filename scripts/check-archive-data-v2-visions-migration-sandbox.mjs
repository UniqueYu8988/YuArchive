import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { evaluateVisionsV2Shape } from './check-archive-data-v2-visions-shape.mjs';
import { runVisionsMigration } from './migrate-archive-data-v2-visions.mjs';

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-data-v2-visions-migration-check-'));
  try {
    const plan = runVisionsMigration({ v2Root: tempRoot });
    assert.equal(plan.ok, true);
    assert.equal(plan.mode, 'plan');
    assert.equal(plan.writeScope, 'none');

    const blocked = runVisionsMigration({
      execute: true,
      authorization: 'wrong authorization',
      v2Root: tempRoot,
    });
    assert.equal(blocked.ok, false);
    assert(blocked.blockedReasons.includes('authorization_phrase_mismatch'));

    const result = runVisionsMigration({
      execute: true,
      authorization: 'I authorize ArchiveData-v2 Visions migration',
      v2Root: tempRoot,
    });
    assert.equal(result.ok, true);
    assert.equal(result.entries, 112);
    assert.equal(result.characters, 20);
    assert.equal(result.sourceChangedFiles, 0);
    const shape = evaluateVisionsV2Shape({ v2Root: tempRoot });
    assert.equal(shape.ok, true);

    console.log('[PASS] ArchiveData-v2 Visions migration sandbox');
    console.log('  planMode: passed');
    console.log('  invalidAuthorizationBlocked: passed');
    console.log(`  entries: ${result.entries}`);
    console.log(`  characters: ${result.characters}`);
    console.log(`  manifestRecords: ${result.manifestRecords}`);
    console.log(`  sourceChangedFiles: ${result.sourceChangedFiles}`);
    console.log('  writeScope: system-temp-only');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
