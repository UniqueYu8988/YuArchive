import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import {
  clone,
  createPayload,
  prepareBackup,
  resetSandbox,
  resolveSandboxPath,
  rollbackTransaction,
  runHappyPathSandbox,
  runTransaction,
  SANDBOX_ROOT,
  WRITE_ROOT,
} from './archive-studio-v0-music-transaction-sandbox.mjs';

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

async function expectRejects(fn, messagePart, label) {
  try {
    await fn();
    failures.push(`${label}: expected rejection`);
  } catch (error) {
    expect(String(error.message || error).includes(messagePart), `${label}: unexpected error message`);
  }
}

const happyPath = await runHappyPathSandbox();
expect(happyPath.length === 2, 'happy path should run create and update');
expect(happyPath[0].rollback.deleted === 4, 'create rollback should delete created files');
expect(happyPath[1].rollback.restored === 4, 'update rollback should restore overwritten files');

await resetSandbox();
const invalidPayload = clone(createPayload);
invalidPayload.id = '../outside';
await expectRejects(
  () => runTransaction({ transactionId: 'tx-invalid-payload', payload: invalidPayload }),
  'Sandbox transaction blocked',
  'invalid payload should stop before write',
);
expect(!existsSync(resolveSandboxPath(WRITE_ROOT, 'entries/music/album/invalid-id/entry.yaml')), 'invalid payload should not write placeholder entry');

await resetSandbox();
await expectRejects(
  async () => {
    const escaped = resolveSandboxPath(WRITE_ROOT, '../outside/entry.yaml');
    await writeFile(escaped, 'should-not-write', 'utf8');
  },
  'Unsafe relative path',
  'path escape should be rejected',
);

await resetSandbox();
await expectRejects(
  () => prepareBackup('tx-backup-missing-target', [
    {
      role: 'entry_yaml',
      relativePath: 'entries/music/album/missing/entry.yaml',
      requiresBackup: true,
    },
  ]),
  'no such file',
  'backup should fail before target write when source is missing',
);
expect(!existsSync(resolveSandboxPath(WRITE_ROOT, 'entries/music/album/missing/entry.yaml')), 'backup failure should not create target file');

await resetSandbox();
await expectRejects(
  () => rollbackTransaction(
    {
      transactionId: 'tx-write',
      items: [
        {
          operation: 'create',
          targetRelativePath: 'entries/music/album/example/entry.yaml',
        },
      ],
    },
    {
      transactionId: 'tx-other',
      items: [],
    },
  ),
  'transaction id mismatch',
  'rollback should reject mismatched manifests',
);

expect(SANDBOX_ROOT.includes('yuarchive-archive-studio-v0-transaction-sandbox'), 'self-check should use the system temp sandbox label');

if (failures.length > 0) {
  console.log('[FAIL] Archive Studio v0 transaction sandbox self-check');
  for (const failure of failures) {
    console.log(`  - ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('[PASS] Archive Studio v0 transaction sandbox self-check');
  console.log('  cases: happy path, invalid payload, path escape, missing backup source, rollback manifest mismatch');
  console.log('  writeScope: system-temp-only');
  console.log('Result: archive studio v0 transaction sandbox checks passed');
}
