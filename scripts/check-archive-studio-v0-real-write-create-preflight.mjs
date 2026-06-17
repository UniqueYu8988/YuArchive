import { pathToFileURL } from 'node:url';
import {
  DEFAULT_PAYLOAD_FILE,
  evaluateGateFromProjectJson,
} from './check-archive-studio-v0-real-write-gate.mjs';
import { buildDryRunManifest } from './dry-run-archive-studio-v0-real-write-manifest.mjs';

const REQUIRED_COMMANDS = [
  'git status --short --branch',
  'node scripts/check-archive-data-v2-music-shape.mjs',
  'node scripts/check-archive-studio-v0-transaction-sandbox.mjs',
];

function addCheck(checks, label, passed, detail) {
  checks.push({
    label,
    passed: Boolean(passed),
    detail,
  });
}

function isSingleMusicAlbumScope(scope, entryId) {
  return scope === `entries/music/album/${entryId}`;
}

export async function evaluateCreatePreflight(inputPath = DEFAULT_PAYLOAD_FILE) {
  const gate = await evaluateGateFromProjectJson(inputPath);
  const manifest = buildDryRunManifest(gate);
  const checks = [];

  addCheck(checks, 'payload_mode_create', gate.mode === 'create', `mode=${gate.mode}`);
  addCheck(checks, 'payload_board_music', gate.board === 'music', `board=${gate.board}`);
  addCheck(checks, 'payload_kind_album', gate.kind === 'album', `kind=${gate.kind}`);
  addCheck(checks, 'target_entry_missing', !gate.targetEntryExists, `targetEntryExists=${gate.targetEntryExists}`);
  addCheck(checks, 'gate_allows_request', gate.allowedToRequestWrite, `blockedReasons=${gate.blockedReasons.length}`);
  addCheck(checks, 'dry_run_passed', manifest.status === 'passed', `status=${manifest.status}`);
  addCheck(checks, 'single_entry_scope', isSingleMusicAlbumScope(manifest.scope, manifest.entryId), `scope=${manifest.scope}`);
  addCheck(checks, 'no_backup_for_create', manifest.backupManifestDraft.items.length === 0, `backupItems=${manifest.backupManifestDraft.items.length}`);
  addCheck(checks, 'planned_writes_exist', manifest.writeManifestDraft.items.length > 0, `writeItems=${manifest.writeManifestDraft.items.length}`);
  addCheck(
    checks,
    'rollback_deletes_match_writes',
    manifest.rollbackDraft.deletesCreatedFiles === manifest.writeManifestDraft.items.length,
    `rollbackDeletes=${manifest.rollbackDraft.deletesCreatedFiles}`,
  );

  return {
    payload: gate.payloadLabel,
    entryId: manifest.entryId,
    scope: manifest.scope,
    operationCounts: manifest.operationCounts,
    backupItems: manifest.backupManifestDraft.items.length,
    writeItems: manifest.writeManifestDraft.items.length,
    rollbackDeletes: manifest.rollbackDraft.deletesCreatedFiles,
    blockedReasons: gate.blockedReasons,
    checks,
    requiredCommands: REQUIRED_COMMANDS,
    readyToRequestWrite: checks.every((check) => check.passed),
    writeScope: 'none',
  };
}

function printResult(result) {
  console.log(`[${result.readyToRequestWrite ? 'PASS' : 'WARN'}] Archive Studio v0 real write create preflight`);
  console.log(`  payload: ${result.payload}`);
  console.log(`  entryId: ${result.entryId}`);
  console.log(`  scope: ${result.scope}`);
  console.log(`  operations: ${JSON.stringify(result.operationCounts)}`);
  console.log(`  backupItems: ${result.backupItems}`);
  console.log(`  writeItems: ${result.writeItems}`);
  console.log(`  rollbackDeletes: ${result.rollbackDeletes}`);
  console.log(`  blockedReasons: ${result.blockedReasons.length ? result.blockedReasons.join(', ') : 'none'}`);
  console.log(`  passedChecks: ${result.checks.filter((check) => check.passed).length}`);
  console.log(`  failedChecks: ${result.checks.filter((check) => !check.passed).length}`);
  for (const check of result.checks.filter((item) => !item.passed)) {
    console.log(`  failed: ${check.label} (${check.detail})`);
  }
  console.log(`  requiredExternalCommands: ${result.requiredCommands.length}`);
  for (const command of result.requiredCommands) {
    console.log(`    - ${command}`);
  }
  console.log(`  readyToRequestWrite: ${result.readyToRequestWrite}`);
  console.log(`  writeScope: ${result.writeScope}`);
  console.log(`Result: archive studio v0 real write create preflight ${result.readyToRequestWrite ? 'passed' : 'needs review'}`);
}

async function main() {
  try {
    const result = await evaluateCreatePreflight(process.argv[2] || DEFAULT_PAYLOAD_FILE);
    printResult(result);
    process.exitCode = result.readyToRequestWrite ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Archive Studio v0 real write create preflight');
    console.log(`  error: ${error.message || error}`);
    console.log('  writeScope: none');
    console.log('Result: archive studio v0 real write create preflight failed');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
