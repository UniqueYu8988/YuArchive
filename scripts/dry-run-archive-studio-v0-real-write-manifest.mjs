import path from 'node:path';
import {
  DEFAULT_PAYLOAD_FILE,
  evaluateGateFromProjectJson,
} from './check-archive-studio-v0-real-write-gate.mjs';

function buildDryRunManifest(gate) {
  const transactionId = `dry-run-${gate.mode}-${gate.targetEntryId}`;
  const writeItems = gate.diff
    .filter((item) => item.operation === 'create' || item.operation === 'overwrite')
    .map((item) => ({
      role: item.role,
      operation: item.operation,
      targetRelativePath: item.relativePath,
      requiresBackup: item.requiresBackup,
      status: 'planned',
    }));

  const backupItems = gate.diff
    .filter((item) => item.requiresBackup)
    .map((item) => ({
      role: item.role,
      targetRelativePath: item.relativePath,
      backupLabel: `system-temp/archive-studio-v0/backups/${transactionId}/${path.posix.basename(item.relativePath)}`,
      status: 'planned',
    }));

  return {
    transactionId,
    dryRun: true,
    allowedToRequestWrite: gate.allowedToRequestWrite,
    blockedReasons: gate.blockedReasons,
    mode: gate.mode,
    board: gate.board,
    kind: gate.kind,
    entryId: gate.targetEntryId,
    scope: gate.target.entryRelativeDir,
    operationCounts: gate.operations,
    backupRequired: gate.backupRequired,
    target: {
      entryRelativeDir: gate.target.entryRelativeDir,
      entryYaml: gate.target.entryYaml,
      contentMd: gate.target.contentMd,
      cover: gate.target.cover,
      audio: gate.target.audio,
    },
    backupManifestDraft: {
      transactionId,
      scope: gate.target.entryRelativeDir,
      items: backupItems,
    },
    writeManifestDraft: {
      transactionId,
      mode: gate.mode,
      scope: gate.target.entryRelativeDir,
      items: writeItems,
      checks: [
        {
          command: 'node scripts/check-archive-data-v2-music-shape.mjs',
          required: true,
        },
        {
          command: 'node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs',
          required: false,
        },
      ],
    },
    rollbackDraft: {
      transactionId,
      deletesCreatedFiles: writeItems.filter((item) => item.operation === 'create').length,
      restoresBackups: backupItems.length,
      status: 'planned',
    },
  };
}

function printManifestSummary(manifest, payloadLabel) {
  console.log(`[${manifest.allowedToRequestWrite ? 'PASS' : 'WARN'}] Archive Studio v0 real write dry-run manifest`);
  console.log(`  payload: ${payloadLabel}`);
  console.log(`  transactionId: ${manifest.transactionId}`);
  console.log(`  mode: ${manifest.mode}`);
  console.log(`  entryId: ${manifest.entryId}`);
  console.log(`  scope: ${manifest.scope}`);
  console.log(`  operations: ${JSON.stringify(manifest.operationCounts)}`);
  console.log(`  backupItems: ${manifest.backupManifestDraft.items.length}`);
  console.log(`  writeItems: ${manifest.writeManifestDraft.items.length}`);
  console.log(`  rollbackDeletes: ${manifest.rollbackDraft.deletesCreatedFiles}`);
  console.log(`  rollbackRestores: ${manifest.rollbackDraft.restoresBackups}`);
  console.log(`  blockedReasons: ${manifest.blockedReasons.length ? manifest.blockedReasons.join(', ') : 'none'}`);
  console.log(`  allowedToRequestWrite: ${manifest.allowedToRequestWrite}`);
  console.log('  writeScope: none');
  console.log(`Result: archive studio v0 real write dry-run manifest ${manifest.allowedToRequestWrite ? 'passed' : 'needs review'}`);
}

const inputPath = process.argv[2] || DEFAULT_PAYLOAD_FILE;
const gate = await evaluateGateFromProjectJson(inputPath);
const manifest = buildDryRunManifest(gate);
printManifestSummary(manifest, gate.payloadLabel);
