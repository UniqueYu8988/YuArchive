import {
  DEFAULT_PAYLOAD_FILE,
  evaluateGate,
  evaluateGateFromProjectJson,
  readJson,
} from './check-archive-studio-v0-real-write-gate.mjs';
import { buildDryRunManifest } from './dry-run-archive-studio-v0-real-write-manifest.mjs';

const UPDATE_PAYLOAD_FILE = 'docs/examples/archive-studio-v0-music-album-update.sample.json';
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const createGate = await evaluateGateFromProjectJson(DEFAULT_PAYLOAD_FILE);
const createManifest = buildDryRunManifest(createGate);
expect(createManifest.status === 'passed', 'create dry-run should pass');
expect(createManifest.writeManifestDraft.items.length === 4, 'create dry-run should plan 4 write items');
expect(createManifest.backupManifestDraft.items.length === 0, 'create dry-run should not plan backup items');
expect(createManifest.rollbackDraft.deletesCreatedFiles === 4, 'create rollback should plan 4 deletions');

const updatePayload = await readJson(UPDATE_PAYLOAD_FILE);
const updateGate = await evaluateGate(updatePayload, UPDATE_PAYLOAD_FILE);
const updateManifest = buildDryRunManifest(updateGate);
expect(updateManifest.status === 'passed', 'update dry-run should pass');
expect(updateManifest.writeManifestDraft.items.length === 4, 'update dry-run should plan 4 write items');
expect(updateManifest.backupManifestDraft.items.length === 4, 'update dry-run should plan 4 backup items');
expect(updateManifest.rollbackDraft.restoresBackups === 4, 'update rollback should plan 4 restores');

const createExistingPayload = clone(updatePayload);
createExistingPayload.mode = 'create';
const createExistingManifest = buildDryRunManifest(await evaluateGate(createExistingPayload, 'inline-create-existing'));
expect(createExistingManifest.status === 'needs_review', 'create existing dry-run should need review');
expect(createExistingManifest.allowedToRequestWrite === false, 'create existing dry-run should not allow write');
expect(createExistingManifest.writeManifestDraft.items.length === 0, 'blocked create dry-run should not plan writes');
expect(createExistingManifest.backupManifestDraft.items.length === 0, 'blocked create dry-run should not plan backups');
expect(createExistingManifest.blockedReasons.includes('create_target_exists'), 'blocked create dry-run should report create_target_exists');

const updateMissingPayload = clone(updatePayload);
updateMissingPayload.id = 'archive-studio-missing-update-target';
const updateMissingManifest = buildDryRunManifest(await evaluateGate(updateMissingPayload, 'inline-update-missing'));
expect(updateMissingManifest.status === 'needs_review', 'update missing dry-run should need review');
expect(updateMissingManifest.allowedToRequestWrite === false, 'update missing dry-run should not allow write');
expect(updateMissingManifest.writeManifestDraft.items.length === 0, 'blocked update dry-run should not plan writes');
expect(updateMissingManifest.backupManifestDraft.items.length === 0, 'blocked update dry-run should not plan backups');
expect(updateMissingManifest.blockedReasons.includes('update_target_missing'), 'blocked update dry-run should report update_target_missing');

if (failures.length > 0) {
  console.log('[FAIL] Archive Studio v0 real write dry-run manifest scenarios');
  for (const failure of failures) {
    console.log(`  - ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('[PASS] Archive Studio v0 real write dry-run manifest scenarios');
  console.log('  cases: create passed, update passed, create existing needs review, update missing needs review');
  console.log('  writeScope: none');
  console.log('Result: archive studio v0 real write dry-run manifest scenarios passed');
}
