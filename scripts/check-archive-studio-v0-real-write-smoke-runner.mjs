import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_PAYLOAD_FILE } from './check-archive-studio-v0-real-write-gate.mjs';
import { buildSmokeTestPlan } from './plan-archive-studio-v0-real-write-create-smoke-test.mjs';
import {
  executeCreateRollbackSmokeTest,
  runSmokeTest,
} from './run-archive-studio-v0-real-write-create-smoke-test.mjs';

async function listTree(root) {
  const records = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isDirectory()) {
        records.push(`${relative}/`);
        await visit(absolute);
      } else if (entry.isFile()) {
        records.push(relative);
      }
    }
  }
  await visit(root);
  return records.sort();
}

async function main() {
  const sandboxRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-studio-v0-runner-check-'));
  const v2Root = path.join(sandboxRoot, 'ArchiveData-v2');
  const sourceRoot = path.join(sandboxRoot, 'source');
  await mkdir(path.join(v2Root, 'entries', 'music', 'album'), { recursive: true });
  await mkdir(sourceRoot, { recursive: true });

  try {
    const payload = JSON.parse(await readFile(DEFAULT_PAYLOAD_FILE, 'utf8'));
    const plan = await buildSmokeTestPlan(DEFAULT_PAYLOAD_FILE);
    const baselineTree = await listTree(v2Root);

    const planMode = await runSmokeTest([]);
    assert.equal(planMode.ok, true);
    assert.equal(planMode.executed, false);

    const blockedExecute = await runSmokeTest([
      '--execute',
      '--entry-id',
      payload.id,
      '--authorization',
      'wrong authorization',
    ]);
    assert.equal(blockedExecute.ok, false);
    assert.equal(blockedExecute.executed, false);
    assert(blockedExecute.blockedReasons.includes('authorization_phrase_mismatch'));

    const result = await executeCreateRollbackSmokeTest({
      payload,
      plan,
      v2Root,
      sourceRoot,
      requireMigrationBaseline: false,
      expectedMinimumEntries: 0,
    });

    assert.equal(result.ok, true);
    assert.equal(result.postWriteEntries, 1);
    assert.equal(result.postRollbackEntries, 0);
    assert.equal(result.rollbackCompleted, true);
    assert.equal(result.sourceUnchanged, true);
    assert.equal(result.v2Restored, true);
    assert.deepEqual(await listTree(v2Root), baselineTree);

    let injectedFailure = null;
    try {
      await executeCreateRollbackSmokeTest({
        payload,
        plan,
        v2Root,
        sourceRoot,
        requireMigrationBaseline: false,
        expectedMinimumEntries: 0,
        testFailAfterEntryWrites: 2,
      });
    } catch (error) {
      injectedFailure = error;
    }
    assert(injectedFailure);
    assert.match(injectedFailure.message, /^execution_failed_after_rollback:injected_smoke_failure$/);
    assert.deepEqual(await listTree(v2Root), baselineTree);

    console.log('[PASS] Archive Studio v0 smoke runner sandbox check');
    console.log('  planMode: passed');
    console.log('  unauthorizedExecuteBlocked: passed');
    console.log('  sandboxCreateEntries: 1');
    console.log('  sandboxRollbackEntries: 0');
    console.log('  sandboxResidualFiles: 0');
    console.log('  injectedPartialWriteRollback: passed');
    console.log('  sourceUnchanged: true');
    console.log('  writeScope: system-temp-only');
  } finally {
    await rm(sandboxRoot, { recursive: true, force: true });
  }
}

await main();
