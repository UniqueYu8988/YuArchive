import crypto from 'node:crypto';
import {
  readFile,
  rm,
  rmdir,
  stat,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARCHIVE_DATA_V2_ROOT,
  ARCHIVE_SOURCE_ROOT,
} from './archive-data-v2-texts-core.mjs';
import { createTextEntry } from './archive-studio-v0-texts-create-core.mjs';
import { snapshotFileMetadata } from './archive-studio-v0-music-create-core.mjs';
import { evaluateTextsV2Shape } from './check-archive-data-v2-texts-shape.mjs';

const AUTHORIZATION_PHRASE = 'I authorize Archive Studio Texts create rollback smoke test';
const EXPECTED_BASELINE_ENTRIES = 132;

function parseArgs(argv) {
  const result = { execute: false, authorization: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--execute') {
      result.execute = true;
    } else if (argv[index] === '--authorization') {
      result.authorization = argv[index + 1] || null;
      index += 1;
    }
  }
  return result;
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
    || relativePath.includes('\\')
    || relativePath.split('/').includes('..')
  ) throw new Error('unsafe_relative_path');
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('path_escaped_root');
  return resolved;
}

async function removeIfEmpty(directory) {
  try {
    await rmdir(directory);
  } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error;
  }
}

function buildPayload() {
  const now = new Date();
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  return {
    id: `text-${day}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
    mode: 'create',
    board: 'texts',
    kind: 'article',
    fields: {
      title: 'Archive Studio Texts smoke test',
      section: 'miscellany',
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      summary: 'Temporary create and rollback verification.',
      tags: ['smoke-test'],
    },
    content: {
      markdown: 'Temporary Texts entry used only for create and rollback verification.',
    },
    assets: {},
  };
}

async function rollbackCreatedText({ result, v2Root, transactionsRootExisted, studioRootExisted }) {
  const transactionRelativeDir = `migration/archive-studio-v0/transactions/${result.transactionId}`;
  const transactionDir = resolveInside(v2Root, transactionRelativeDir);
  const rollbackPath = path.join(transactionDir, 'rollback.json');
  const rollback = JSON.parse(await readFile(rollbackPath, 'utf8'));
  if (
    rollback.transactionId !== result.transactionId
    || !Array.isArray(rollback.deleteCreatedFiles)
    || rollback.removeEmptyEntryDirectory !== result.entryRelativeDir
  ) throw new Error('rollback_manifest_mismatch');

  for (const relativePath of rollback.deleteCreatedFiles) {
    await rm(resolveInside(v2Root, relativePath), { force: true });
  }
  await removeIfEmpty(resolveInside(v2Root, result.entryRelativeDir));
  await rm(transactionDir, { recursive: true, force: true });

  const transactionsRoot = path.dirname(transactionDir);
  const studioRoot = path.dirname(transactionsRoot);
  if (!transactionsRootExisted) await removeIfEmpty(transactionsRoot);
  if (!studioRootExisted) await removeIfEmpty(studioRoot);
}

async function settleRollback({ result, v2Root, transactionsRootExisted, studioRootExisted }) {
  const entryDir = resolveInside(v2Root, result.entryRelativeDir);
  const transactionDir = resolveInside(
    v2Root,
    `migration/archive-studio-v0/transactions/${result.transactionId}`,
  );
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!(await exists(entryDir)) && !(await exists(transactionDir))) return;
    await rollbackCreatedText({ result, v2Root, transactionsRootExisted, studioRootExisted });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('rollback_residuals_remain');
}

export async function executeTextsCreateRollbackSmokeTest({
  v2Root = ARCHIVE_DATA_V2_ROOT,
  sourceRoot = ARCHIVE_SOURCE_ROOT,
} = {}) {
  const baselineShape = evaluateTextsV2Shape({
    v2Root,
    expectedMinimumEntries: EXPECTED_BASELINE_ENTRIES,
    requireMigrationBaseline: true,
  });
  if (!baselineShape.ok || baselineShape.totalEntries !== EXPECTED_BASELINE_ENTRIES) {
    throw new Error('unexpected_texts_baseline');
  }

  const sourceBefore = await snapshotFileMetadata(sourceRoot);
  const v2Before = await snapshotFileMetadata(v2Root);
  const transactionsRoot = resolveInside(v2Root, 'migration/archive-studio-v0/transactions');
  const studioRoot = path.dirname(transactionsRoot);
  const transactionsRootExisted = await exists(transactionsRoot);
  const studioRootExisted = await exists(studioRoot);
  const payload = buildPayload();
  let createResult = null;

  try {
    createResult = await createTextEntry({
      payload,
      v2Root,
      sourceRoot,
      expectedMinimumEntries: EXPECTED_BASELINE_ENTRIES,
      requireMigrationBaseline: true,
    });
    if (createResult.textsEntries !== EXPECTED_BASELINE_ENTRIES + 1) {
      throw new Error('unexpected_post_create_entry_count');
    }
  } finally {
    if (createResult) {
      await rollbackCreatedText({
        result: createResult,
        v2Root,
        transactionsRootExisted,
        studioRootExisted,
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
      await settleRollback({
        result: createResult,
        v2Root,
        transactionsRootExisted,
        studioRootExisted,
      });
    }
  }

  const postRollbackShape = evaluateTextsV2Shape({
    v2Root,
    expectedMinimumEntries: EXPECTED_BASELINE_ENTRIES,
    requireMigrationBaseline: true,
  });
  const sourceAfter = await snapshotFileMetadata(sourceRoot);
  const v2After = await snapshotFileMetadata(v2Root);
  const sourceUnchanged = sourceBefore.files === sourceAfter.files && sourceBefore.digest === sourceAfter.digest;
  const v2Restored = v2Before.files === v2After.files && v2Before.digest === v2After.digest;
  if (!postRollbackShape.ok || postRollbackShape.totalEntries !== EXPECTED_BASELINE_ENTRIES) {
    throw new Error('post_rollback_texts_shape_failed');
  }
  if (!sourceUnchanged) throw new Error('source_metadata_changed');
  if (!v2Restored) throw new Error('v2_metadata_not_restored');

  return {
    ok: true,
    createdEntryFiles: createResult.createdEntryFiles,
    createdTransactionFiles: createResult.createdTransactionFiles,
    postWriteEntries: createResult.textsEntries,
    postRollbackEntries: postRollbackShape.totalEntries,
    sourceFilesChecked: sourceBefore.files,
    sourceUnchanged,
    v2Restored,
    rollbackCompleted: true,
  };
}

export async function run(argv = []) {
  const options = parseArgs(argv);
  if (!options.execute) {
    console.log('[PASS] Archive Studio Texts create + rollback smoke test plan');
    console.log('  mode: plan');
    console.log('  writeScope: none');
    console.log('  plannedEntryFiles: 2');
    console.log('  plannedTransactionFiles: 3');
    console.log('  expectedBaselineEntries: 132');
    console.log('  sourceWriteAllowed: false');
    return { ok: true, executed: false };
  }
  if (options.authorization !== AUTHORIZATION_PHRASE) {
    console.log('[WARN] Archive Studio Texts create + rollback smoke test blocked');
    console.log('  reason: authorization_phrase_mismatch');
    console.log('  writeScope: none');
    return { ok: false, executed: false };
  }

  const result = await executeTextsCreateRollbackSmokeTest();
  console.log('[PASS] Archive Studio Texts create + rollback smoke test');
  console.log(`  entryFilesCreated: ${result.createdEntryFiles}`);
  console.log(`  transactionFilesCreated: ${result.createdTransactionFiles}`);
  console.log(`  postWriteEntries: ${result.postWriteEntries}`);
  console.log(`  postRollbackEntries: ${result.postRollbackEntries}`);
  console.log(`  rollbackCompleted: ${result.rollbackCompleted}`);
  console.log(`  sourceFilesChecked: ${result.sourceFilesChecked}`);
  console.log(`  sourceUnchanged: ${result.sourceUnchanged}`);
  console.log(`  v2Restored: ${result.v2Restored}`);
  console.log('  writeScope: single-temporary-text-entry-rolled-back');
  return { ok: true, executed: true, result };
}

async function main() {
  try {
    const result = await run(process.argv.slice(2));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Archive Studio Texts create + rollback smoke test');
    console.log(`  error: ${error.message || error}`);
    console.log('  rollback: attempted when create completed');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
