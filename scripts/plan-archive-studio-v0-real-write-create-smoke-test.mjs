import { pathToFileURL } from 'node:url';
import {
  DEFAULT_PAYLOAD_FILE,
  evaluateGateFromProjectJson,
} from './check-archive-studio-v0-real-write-gate.mjs';
import { buildDryRunManifest } from './dry-run-archive-studio-v0-real-write-manifest.mjs';
import { evaluateCreatePreflight } from './check-archive-studio-v0-real-write-create-preflight.mjs';

const POST_WRITE_CHECKS = [
  'node scripts/check-archive-data-v2-music-shape.mjs',
  'node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs',
  'node scripts/check-generated-data-privacy.mjs',
  'git status --short --branch',
];

function plannedTransactionPaths(transactionId) {
  return [
    `migration/archive-studio-v0/transactions/${transactionId}/preview.json`,
    `migration/archive-studio-v0/transactions/${transactionId}/write.json`,
    `migration/archive-studio-v0/transactions/${transactionId}/rollback.json`,
  ];
}

export async function buildSmokeTestPlan(inputPath = DEFAULT_PAYLOAD_FILE) {
  const [preflight, gate] = await Promise.all([
    evaluateCreatePreflight(inputPath),
    evaluateGateFromProjectJson(inputPath),
  ]);
  const manifest = buildDryRunManifest(gate);
  const transactionId = `smoke-test-${manifest.mode}-${manifest.entryId}`;
  const plannedWriteFiles = manifest.writeManifestDraft.items.map((item) => ({
    role: item.role,
    operation: item.operation,
    targetRelativePath: item.targetRelativePath,
  }));

  return {
    payload: preflight.payload,
    mode: manifest.mode,
    board: manifest.board,
    kind: manifest.kind,
    entryId: manifest.entryId,
    scope: manifest.scope,
    transactionId,
    readyToRequestWrite: preflight.readyToRequestWrite,
    blockedReasons: preflight.blockedReasons,
    plannedWriteFiles,
    plannedTransactionFiles: plannedTransactionPaths(transactionId),
    rollbackPlan: {
      deleteCreatedFiles: manifest.rollbackDraft.deletesCreatedFiles,
      restoreBackups: manifest.rollbackDraft.restoresBackups,
      scope: manifest.scope,
    },
    postWriteChecks: POST_WRITE_CHECKS,
    writeScope: 'none',
  };
}

function printPlan(plan) {
  console.log(`[${plan.readyToRequestWrite ? 'PASS' : 'WARN'}] Archive Studio v0 real write create smoke test plan`);
  console.log(`  payload: ${plan.payload}`);
  console.log(`  mode: ${plan.mode}`);
  console.log(`  board: ${plan.board}`);
  console.log(`  kind: ${plan.kind}`);
  console.log(`  entryId: ${plan.entryId}`);
  console.log(`  scope: ${plan.scope}`);
  console.log(`  transactionId: ${plan.transactionId}`);
  console.log(`  plannedWriteFiles: ${plan.plannedWriteFiles.length}`);
  for (const item of plan.plannedWriteFiles) {
    console.log(`    - ${item.role}: ${item.operation} ${item.targetRelativePath}`);
  }
  console.log(`  plannedTransactionFiles: ${plan.plannedTransactionFiles.length}`);
  for (const relativePath of plan.plannedTransactionFiles) {
    console.log(`    - ${relativePath}`);
  }
  console.log(`  rollbackDeletes: ${plan.rollbackPlan.deleteCreatedFiles}`);
  console.log(`  rollbackRestores: ${plan.rollbackPlan.restoreBackups}`);
  console.log(`  postWriteChecks: ${plan.postWriteChecks.length}`);
  for (const command of plan.postWriteChecks) {
    console.log(`    - ${command}`);
  }
  console.log(`  blockedReasons: ${plan.blockedReasons.length ? plan.blockedReasons.join(', ') : 'none'}`);
  console.log(`  readyToRequestWrite: ${plan.readyToRequestWrite}`);
  console.log(`  writeScope: ${plan.writeScope}`);
  console.log(`Result: archive studio v0 real write create smoke test plan ${plan.readyToRequestWrite ? 'passed' : 'needs review'}`);
}

async function main() {
  try {
    const plan = await buildSmokeTestPlan(process.argv[2] || DEFAULT_PAYLOAD_FILE);
    printPlan(plan);
    process.exitCode = plan.readyToRequestWrite ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Archive Studio v0 real write create smoke test plan');
    console.log(`  error: ${error.message || error}`);
    console.log('  writeScope: none');
    console.log('Result: archive studio v0 real write create smoke test plan failed');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
