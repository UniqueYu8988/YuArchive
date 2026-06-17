import {
  DEFAULT_PAYLOAD_FILE,
  evaluateGate,
  evaluateGateFromProjectJson,
  readJson,
} from './check-archive-studio-v0-real-write-gate.mjs';

const UPDATE_PAYLOAD_FILE = 'docs/examples/archive-studio-v0-music-album-update.sample.json';
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const createResult = await evaluateGateFromProjectJson(DEFAULT_PAYLOAD_FILE);
expect(createResult.allowedToRequestWrite === true, 'default create payload should be allowed to request write');
expect(createResult.targetEntryExists === false, 'default create target should not exist');
expect(createResult.operations.create === 4, 'default create payload should plan 4 create operations');
expect(createResult.backupRequired === false, 'default create payload should not require backup');

const updatePayload = await readJson(UPDATE_PAYLOAD_FILE);
const updateResult = await evaluateGate(updatePayload, UPDATE_PAYLOAD_FILE);
expect(updateResult.allowedToRequestWrite === true, 'update payload should be allowed to request write');
expect(updateResult.targetEntryExists === true, 'update target should exist');
expect(updateResult.operations.overwrite === 4, 'update payload should plan 4 overwrite operations');
expect(updateResult.backupRequired === true, 'update payload should require backup');

const createExistingPayload = clone(updatePayload);
createExistingPayload.mode = 'create';
const createExistingResult = await evaluateGate(createExistingPayload, 'inline-create-existing');
expect(createExistingResult.allowedToRequestWrite === false, 'create existing payload should be blocked');
expect(createExistingResult.blockedReasons.includes('create_target_exists'), 'create existing payload should report create_target_exists');
expect(createExistingResult.operations.blocked === 4, 'create existing payload should report blocked target files');

const updateMissingPayload = clone(updatePayload);
updateMissingPayload.id = 'archive-studio-missing-update-target';
const updateMissingResult = await evaluateGate(updateMissingPayload, 'inline-update-missing');
expect(updateMissingResult.allowedToRequestWrite === false, 'update missing payload should be blocked');
expect(updateMissingResult.blockedReasons.includes('update_target_missing'), 'update missing payload should report update_target_missing');

const invalidPayload = clone(updatePayload);
invalidPayload.id = '../outside';
const invalidResult = await evaluateGate(invalidPayload, 'inline-invalid-id');
expect(invalidResult.allowedToRequestWrite === false, 'invalid id payload should be blocked');
expect(invalidResult.blockedReasons.includes('invalid_entry_id'), 'invalid id payload should report invalid_entry_id');

if (failures.length > 0) {
  console.log('[FAIL] Archive Studio v0 real write gate scenarios');
  for (const failure of failures) {
    console.log(`  - ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('[PASS] Archive Studio v0 real write gate scenarios');
  console.log('  cases: create allowed, update allowed, create existing blocked, update missing blocked, invalid id blocked');
  console.log('  writeScope: none');
  console.log('Result: archive studio v0 real write gate scenarios passed');
}
