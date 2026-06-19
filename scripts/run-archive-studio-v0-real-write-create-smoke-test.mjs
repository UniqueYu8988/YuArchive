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
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_PAYLOAD_FILE,
  readJson,
} from './check-archive-studio-v0-real-write-gate.mjs';
import { evaluateMusicV2Shape } from './check-archive-data-v2-music-shape.mjs';
import { buildSmokeTestPlan } from './plan-archive-studio-v0-real-write-create-smoke-test.mjs';

const SOURCE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');
const V2_ROOT = path.join(path.dirname(SOURCE_ROOT), 'ArchiveData-v2');
const AUTHORIZATION_PHRASE = 'I authorize Archive Studio create rollback smoke test';

const EXECUTION_GATES = [
  'authorization_phrase_matches',
  'execute_flag_present',
  'entry_id_matches_payload',
  'preflight_ready',
  'target_entry_missing',
  'write_scope_allowlisted',
];

const EXECUTION_PHASES = [
  'preflight',
  'plan',
  'stage',
  'apply_create',
  'write_transaction_manifest',
  'post_write_checks',
  'rollback_created_files',
  'post_rollback_checks',
  'summary',
];

function parseArgs(argv) {
  const result = {
    execute: false,
    entryId: null,
    payload: DEFAULT_PAYLOAD_FILE,
    authorization: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--execute') {
      result.execute = true;
    } else if (arg === '--entry-id') {
      result.entryId = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--payload') {
      result.payload = argv[index + 1] || DEFAULT_PAYLOAD_FILE;
      index += 1;
    } else if (arg === '--authorization') {
      result.authorization = argv[index + 1] || null;
      index += 1;
    } else if (!arg.startsWith('--')) {
      result.payload = arg;
    }
  }

  return result;
}

function printPlanSummary(plan, options, blockedReasons) {
  const blocked = blockedReasons.length > 0;
  console.log(`[${blocked ? 'WARN' : 'PASS'}] Archive Studio v0 real write create smoke test runner`);
  console.log(`  mode: ${options.execute ? 'execute-requested' : 'plan'}`);
  console.log(`  entryIdMatches: ${!options.entryId || options.entryId === plan.entryId}`);
  console.log(`  plannedWriteFiles: ${plan.plannedWriteFiles.length}`);
  console.log(`  plannedTransactionFiles: ${plan.plannedTransactionFiles.length}`);
  console.log(`  rollbackDeletes: ${plan.rollbackPlan.deleteCreatedFiles}`);
  console.log(`  rollbackRestores: ${plan.rollbackPlan.restoreBackups}`);
  console.log(`  executionGates: ${EXECUTION_GATES.length}`);
  console.log(`  executionPhases: ${EXECUTION_PHASES.length}`);
  console.log(`  readyToRequestWrite: ${plan.readyToRequestWrite}`);
  console.log(`  blockedReasons: ${blocked ? blockedReasons.join(', ') : 'none'}`);
  console.log(`  executeImplemented: true`);
  console.log(`  writeScope: ${options.execute ? 'pending-gates' : 'none'}`);
  console.log(`Result: smoke test runner ${blocked ? 'needs review' : 'passed in plan mode'}`);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function resolveInside(root, relativePath) {
  if (path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) {
    throw new Error('unsafe_relative_path');
  }
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('path_escaped_root');
  return resolved;
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function snapshotFileMetadata(root) {
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

function serializeYaml(payload) {
  const fields = payload.fields || {};
  const values = {
    id: payload.id,
    board: payload.board,
    kind: payload.kind,
    title: fields.title,
    date: fields.date,
    description: fields.description,
    track_title: fields.track_title,
    url: fields.url,
    note: fields.note,
  };
  const lines = [];
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    lines.push(`${key}: ${JSON.stringify(String(value))}`);
  }
  if (fields.legacy && Object.keys(fields.legacy).length) {
    lines.push(`legacy: ${JSON.stringify(fields.legacy)}`);
  }
  return `${lines.join('\n')}\n`;
}

function buildStagingItems(payload, plan) {
  const byRole = new Map([
    ['entry_yaml', Buffer.from(serializeYaml(payload), 'utf8')],
    ['content_md', Buffer.from(payload.content?.markdown || '', 'utf8')],
    ['cover', Buffer.from('Archive Studio smoke test cover placeholder\n', 'utf8')],
    ['audio', Buffer.from('Archive Studio smoke test audio placeholder\n', 'utf8')],
  ]);

  return plan.plannedWriteFiles.map((item) => {
    const content = byRole.get(item.role);
    if (!content) throw new Error(`unsupported_staging_role:${item.role}`);
    return {
      role: item.role,
      relativePath: item.targetRelativePath,
      content,
      bytes: content.byteLength,
      sha256: sha256(content),
    };
  });
}

function assertPlanAllowlist(plan, stagingItems) {
  const entryPrefix = `${plan.scope}/`;
  if (!/^entries\/music\/album\/[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(plan.scope)) {
    throw new Error('scope_not_allowlisted');
  }
  if (stagingItems.length !== 4 || stagingItems.some((item) => !item.relativePath.startsWith(entryPrefix))) {
    throw new Error('entry_write_not_allowlisted');
  }
  const transactionPrefix = `migration/archive-studio-v0/transactions/${plan.transactionId}/`;
  if (
    plan.plannedTransactionFiles.length !== 3
    || plan.plannedTransactionFiles.some((relativePath) => !relativePath.startsWith(transactionPrefix))
  ) {
    throw new Error('transaction_write_not_allowlisted');
  }
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

export async function executeCreateRollbackSmokeTest({
  payload,
  plan,
  v2Root = V2_ROOT,
  sourceRoot = SOURCE_ROOT,
  requireMigrationBaseline = true,
  expectedMinimumEntries = 33,
  testFailAfterEntryWrites = null,
}) {
  const stagingItems = buildStagingItems(payload, plan);
  assertPlanAllowlist(plan, stagingItems);

  const targetEntryDir = resolveInside(v2Root, plan.scope);
  const transactionDirRelative = `migration/archive-studio-v0/transactions/${plan.transactionId}`;
  const transactionDir = resolveInside(v2Root, transactionDirRelative);
  const transactionsRoot = path.dirname(transactionDir);
  const studioMigrationRoot = path.dirname(transactionsRoot);
  const migrationRoot = path.dirname(studioMigrationRoot);
  const transactionsRootExisted = await exists(transactionsRoot);
  const studioMigrationRootExisted = await exists(studioMigrationRoot);
  const migrationRootExisted = await exists(migrationRoot);

  if (await exists(targetEntryDir)) throw new Error('target_entry_exists');
  if (await exists(transactionDir)) throw new Error('transaction_dir_exists');

  const sourceBefore = await snapshotFileMetadata(sourceRoot);
  const v2Before = await snapshotFileMetadata(v2Root);
  const baselineShape = evaluateMusicV2Shape({
    v2Root,
    expectedMinimumEntries,
    requireMigrationBaseline,
  });
  if (!baselineShape.ok) throw new Error('baseline_music_shape_failed');

  const stageRoot = await mkdtemp(path.join(os.tmpdir(), 'archive-studio-v0-smoke-'));
  const createdEntryFiles = [];
  let postWriteShape = null;
  let rollbackCompleted = false;
  let executionError = null;
  let rollbackError = null;

  try {
    await mkdir(stageRoot, { recursive: true });
    for (const item of stagingItems) {
      const staged = path.join(stageRoot, `${item.role}.stage`);
      await writeFile(staged, item.content, { flag: 'wx' });
      await verifyFile(staged, item);
    }

    await mkdir(targetEntryDir, { recursive: false });
    for (const item of stagingItems) {
      const target = resolveInside(v2Root, item.relativePath);
      await writeFile(target, item.content, { flag: 'wx' });
      createdEntryFiles.push({ ...item, target });
      await verifyFile(target, item);
      if (testFailAfterEntryWrites === createdEntryFiles.length) {
        throw new Error('injected_smoke_failure');
      }
    }

    await mkdir(transactionDir, { recursive: true });
    const previewManifest = {
      transactionId: plan.transactionId,
      mode: plan.mode,
      board: plan.board,
      kind: plan.kind,
      entryId: plan.entryId,
      scope: plan.scope,
      plannedWrites: stagingItems.map(({ role, relativePath, bytes, sha256: checksum }) => ({
        role,
        relativePath,
        bytes,
        sha256: checksum,
      })),
      writeScope: plan.scope,
    };
    const writeManifest = {
      transactionId: plan.transactionId,
      createdFiles: stagingItems.map(({ role, relativePath, bytes, sha256: checksum }) => ({
        role,
        operation: 'create',
        relativePath,
        bytes,
        sha256: checksum,
      })),
    };
    const rollbackManifest = {
      transactionId: plan.transactionId,
      deleteCreatedFiles: [...stagingItems].reverse().map((item) => item.relativePath),
      removeEmptyEntryDirectory: plan.scope,
      writeScope: plan.scope,
    };
    const manifests = [previewManifest, writeManifest, rollbackManifest];
    for (let index = 0; index < plan.plannedTransactionFiles.length; index += 1) {
      const target = resolveInside(v2Root, plan.plannedTransactionFiles[index]);
      await writeFile(target, `${JSON.stringify(manifests[index], null, 2)}\n`, { flag: 'wx' });
    }

    postWriteShape = evaluateMusicV2Shape({
      v2Root,
      expectedMinimumEntries: baselineShape.albumEntryDirs + 1,
      requireMigrationBaseline,
    });
    if (!postWriteShape.ok) throw new Error('post_write_music_shape_failed');
  } catch (error) {
    executionError = error;
  } finally {
    try {
      for (const item of [...createdEntryFiles].reverse()) {
        await rm(item.target, { force: true });
      }
      await removeIfEmpty(targetEntryDir);
      await rm(transactionDir, { recursive: true, force: true });
      if (!transactionsRootExisted) await removeIfEmpty(transactionsRoot);
      if (!studioMigrationRootExisted) await removeIfEmpty(studioMigrationRoot);
      if (!migrationRootExisted) await removeIfEmpty(migrationRoot);
      await rm(stageRoot, { recursive: true, force: true });
      rollbackCompleted = true;
    } catch (error) {
      rollbackError = error;
    }
  }

  const postRollbackShape = evaluateMusicV2Shape({
    v2Root,
    expectedMinimumEntries,
    requireMigrationBaseline,
  });
  const sourceAfter = await snapshotFileMetadata(sourceRoot);
  const v2After = await snapshotFileMetadata(v2Root);
  const sourceUnchanged = sourceBefore.files === sourceAfter.files && sourceBefore.digest === sourceAfter.digest;
  const v2Restored = v2Before.files === v2After.files && v2Before.digest === v2After.digest;

  if (rollbackError) throw new Error(`rollback_failed:${rollbackError.message || rollbackError}`);
  if (!postRollbackShape.ok) throw new Error('post_rollback_music_shape_failed');
  if (!sourceUnchanged) throw new Error('source_metadata_changed');
  if (!v2Restored) throw new Error('v2_metadata_not_restored');
  if (executionError) throw new Error(`execution_failed_after_rollback:${executionError.message || executionError}`);

  return {
    ok: true,
    entryFilesCreated: stagingItems.length,
    transactionFilesCreated: plan.plannedTransactionFiles.length,
    postWriteEntries: postWriteShape.albumEntryDirs,
    postRollbackEntries: postRollbackShape.albumEntryDirs,
    rollbackCompleted,
    sourceFilesChecked: sourceBefore.files,
    sourceUnchanged,
    v2Restored,
    executeImplemented: true,
    writeScope: 'single-smoke-test-entry-rolled-back',
  };
}

export async function runSmokeTest(argv = []) {
  const options = parseArgs(argv);
  const plan = await buildSmokeTestPlan(options.payload);
  const blockedReasons = [];

  if (options.entryId && options.entryId !== plan.entryId) blockedReasons.push('entry_id_mismatch');
  if (!plan.readyToRequestWrite) blockedReasons.push('preflight_not_ready');

  if (!options.execute) {
    printPlanSummary(plan, options, blockedReasons);
    return { plan, options, blockedReasons, ok: blockedReasons.length === 0, executed: false };
  }

  if (!options.entryId) blockedReasons.push('entry_id_required');
  if (options.authorization !== AUTHORIZATION_PHRASE) blockedReasons.push('authorization_phrase_mismatch');
  if (blockedReasons.length) {
    printPlanSummary(plan, options, blockedReasons);
    return { plan, options, blockedReasons, ok: false, executed: false };
  }

  const payload = await readJson(options.payload);
  const result = await executeCreateRollbackSmokeTest({ payload, plan });
  console.log('[PASS] Archive Studio v0 create + rollback smoke test');
  console.log(`  entryFilesCreated: ${result.entryFilesCreated}`);
  console.log(`  transactionFilesCreated: ${result.transactionFilesCreated}`);
  console.log(`  postWriteEntries: ${result.postWriteEntries}`);
  console.log(`  postRollbackEntries: ${result.postRollbackEntries}`);
  console.log(`  rollbackCompleted: ${result.rollbackCompleted}`);
  console.log(`  sourceFilesChecked: ${result.sourceFilesChecked}`);
  console.log(`  sourceUnchanged: ${result.sourceUnchanged}`);
  console.log(`  v2Restored: ${result.v2Restored}`);
  console.log(`  executeImplemented: ${result.executeImplemented}`);
  console.log(`  writeScope: ${result.writeScope}`);
  console.log('Result: archive studio v0 create + rollback smoke test passed');
  return { plan, options, blockedReasons: [], ok: true, executed: true, result };
}

async function main() {
  try {
    const result = await runSmokeTest(process.argv.slice(2));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Archive Studio v0 real write create smoke test runner');
    console.log(`  error: ${error.message || error}`);
    console.log('  rollback: attempted');
    console.log('Result: archive studio v0 real write create smoke test runner failed');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
