import { pathToFileURL } from 'node:url';
import { DEFAULT_PAYLOAD_FILE } from './check-archive-studio-v0-real-write-gate.mjs';
import { buildSmokeTestPlan } from './plan-archive-studio-v0-real-write-create-smoke-test.mjs';

const EXECUTION_GATES = [
  'current_task_user_authorized_execute',
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
    } else if (!arg.startsWith('--')) {
      result.payload = arg;
    }
  }

  return result;
}

function printRunnerSummary(plan, options, blockedReasons) {
  const blocked = blockedReasons.length > 0;
  console.log(`[${blocked ? 'WARN' : 'PASS'}] Archive Studio v0 real write create smoke test runner`);
  console.log(`  mode: ${options.execute ? 'execute-requested' : 'plan'}`);
  console.log(`  payload: ${plan.payload}`);
  console.log(`  entryId: ${plan.entryId}`);
  console.log(`  requestedEntryId: ${options.entryId || 'none'}`);
  console.log(`  scope: ${plan.scope}`);
  console.log(`  transactionId: ${plan.transactionId}`);
  console.log(`  plannedWriteFiles: ${plan.plannedWriteFiles.length}`);
  console.log(`  plannedTransactionFiles: ${plan.plannedTransactionFiles.length}`);
  console.log(`  rollbackDeletes: ${plan.rollbackPlan.deleteCreatedFiles}`);
  console.log(`  rollbackRestores: ${plan.rollbackPlan.restoreBackups}`);
  console.log(`  postWriteChecks: ${plan.postWriteChecks.length}`);
  console.log(`  executionGates: ${EXECUTION_GATES.length}`);
  for (const gate of EXECUTION_GATES) {
    console.log(`    - ${gate}`);
  }
  console.log(`  executionPhases: ${EXECUTION_PHASES.length}`);
  for (const phase of EXECUTION_PHASES) {
    console.log(`    - ${phase}`);
  }
  console.log(`  readyToRequestWrite: ${plan.readyToRequestWrite}`);
  console.log(`  blockedReasons: ${blocked ? blockedReasons.join(', ') : 'none'}`);
  console.log('  executeImplemented: false');
  console.log('  writeScope: none');
  console.log(`Result: archive studio v0 real write create smoke test runner ${blocked ? 'needs review' : 'passed in plan mode'}`);
}

export async function runSmokeTestPlanMode(argv = []) {
  const options = parseArgs(argv);
  const plan = await buildSmokeTestPlan(options.payload);
  const blockedReasons = [];

  if (options.entryId && options.entryId !== plan.entryId) {
    blockedReasons.push('entry_id_mismatch');
  }
  if (!plan.readyToRequestWrite) {
    blockedReasons.push('preflight_not_ready');
  }
  if (options.execute) {
    blockedReasons.push('execute_mode_not_enabled_in_plan_runner');
  }

  printRunnerSummary(plan, options, blockedReasons);
  return {
    plan,
    options,
    blockedReasons,
    executionGates: EXECUTION_GATES,
    executionPhases: EXECUTION_PHASES,
    ok: blockedReasons.length === 0,
  };
}

async function main() {
  try {
    const result = await runSmokeTestPlanMode(process.argv.slice(2));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Archive Studio v0 real write create smoke test runner');
    console.log(`  error: ${error.message || error}`);
    console.log('  executeImplemented: false');
    console.log('  writeScope: none');
    console.log('Result: archive studio v0 real write create smoke test runner failed');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
