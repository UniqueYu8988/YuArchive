import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertPreviewSafe,
  buildMusicAlbumPreview,
} from './archive-studio-v0-music-preview-core.mjs';
import { evaluateGate } from './check-archive-studio-v0-real-write-gate.mjs';
import { buildDryRunManifest } from './dry-run-archive-studio-v0-real-write-manifest.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');
const V2_MUSIC_ROOT = path.join(path.dirname(SOURCE_ROOT), 'Archive', 'entries', 'music', 'album');
const SAMPLE_PAYLOAD = path.join(PROJECT_ROOT, 'docs', 'examples', 'archive-studio-v0-music-album-payload.sample.json');
const RUNNER_FILE = path.join(PROJECT_ROOT, 'scripts', 'run-archive-studio-v0-real-write-create-smoke-test.mjs');
const SAFE_SCOPE = /^entries\/music\/album\/[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const SAFE_TARGET = /^entries\/music\/album\/[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?\/(entry\.yaml|content\.md|cover\.[a-z0-9]+|audio\.[a-z0-9]+)$/;
const PRIVACY_RULES = [
  /[A-Za-z]:[\\/]+Users[\\/]/,
  /OneDrive/i,
  /Data backup/i,
  /\b(password|secret|token|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i,
];

async function snapshotTreeMetadata(root) {
  const records = [];

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
    digest: crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex'),
  };
}

function addCheck(checks, name, passed) {
  checks.push({ name, passed: Boolean(passed) });
}

function privacyHits(value) {
  const serialized = JSON.stringify(value);
  return PRIVACY_RULES.filter((rule) => rule.test(serialized)).length;
}

async function main() {
  const sourceBefore = await snapshotTreeMetadata(SOURCE_ROOT);
  const payload = JSON.parse(await readFile(SAMPLE_PAYLOAD, 'utf8'));
  const preview = buildMusicAlbumPreview(payload);
  assertPreviewSafe(preview);
  const gate = await evaluateGate(payload, 'readiness-audit');
  const manifest = buildDryRunManifest(gate);
  const runnerSource = await readFile(RUNNER_FILE, 'utf8');

  const entryDirs = (await readdir(V2_MUSIC_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert(entryDirs.length > 0, 'Music v2 must contain at least one existing entry for conflict audit');

  const conflictPayload = {
    ...payload,
    id: entryDirs[0],
  };
  const conflictGate = await evaluateGate(conflictPayload, 'conflict-audit');
  const sourceAfter = await snapshotTreeMetadata(SOURCE_ROOT);
  const checks = [];

  addCheck(checks, 'preview_valid', preview.ok);
  addCheck(checks, 'gate_allows_new_create_request', gate.allowedToRequestWrite);
  addCheck(checks, 'scope_allowlisted', SAFE_SCOPE.test(manifest.scope));
  addCheck(
    checks,
    'target_paths_allowlisted',
    Object.values(manifest.target).every((relativePath) => (
      relativePath === manifest.target.entryRelativeDir
        ? SAFE_SCOPE.test(relativePath)
        : SAFE_TARGET.test(relativePath)
    )),
  );
  addCheck(checks, 'single_entry_scope', manifest.scope === preview.target.entryRelativeDir);
  addCheck(checks, 'create_has_no_backup_items', manifest.backupManifestDraft.items.length === 0);
  addCheck(checks, 'create_has_planned_writes', manifest.writeManifestDraft.items.length > 0);
  addCheck(
    checks,
    'rollback_matches_created_files',
    manifest.rollbackDraft.deletesCreatedFiles === manifest.writeManifestDraft.items.length,
  );
  addCheck(checks, 'existing_target_is_blocked', !conflictGate.allowedToRequestWrite && conflictGate.targetEntryExists);
  addCheck(checks, 'existing_target_reason_present', conflictGate.blockedReasons.includes('create_target_exists'));
  addCheck(checks, 'privacy_rules_clear', privacyHits({ preview, gate, manifest, conflictGate }) === 0);
  addCheck(checks, 'runner_requires_authorization_phrase', runnerSource.includes('authorization_phrase_mismatch'));
  addCheck(checks, 'runner_requires_entry_id', runnerSource.includes('entry_id_required'));
  addCheck(checks, 'source_file_count_unchanged', sourceBefore.files === sourceAfter.files);
  addCheck(checks, 'source_metadata_digest_unchanged', sourceBefore.digest === sourceAfter.digest);

  const failed = checks.filter((check) => !check.passed);
  console.log(`[${failed.length ? 'FAIL' : 'PASS'}] Archive Studio v0 real write readiness audit`);
  console.log(`  checks: ${checks.length}`);
  console.log(`  passed: ${checks.length - failed.length}`);
  console.log(`  failed: ${failed.length}`);
  console.log(`  sourceFilesChecked: ${sourceBefore.files}`);
  console.log(`  privacyRuleHits: ${privacyHits({ preview, gate, manifest, conflictGate })}`);
  console.log(`  existingTargetConflictBlocked: ${!conflictGate.allowedToRequestWrite}`);
  console.log(`  plannedWrites: ${manifest.writeManifestDraft.items.length}`);
  console.log(`  rollbackDeletes: ${manifest.rollbackDraft.deletesCreatedFiles}`);
  console.log('  executeGate: authorization + entry id + preflight');
  console.log('  writeScope: none-during-audit');
  for (const check of failed) console.log(`  failedCheck: ${check.name}`);
  console.log(`Result: real write readiness audit ${failed.length ? 'failed' : 'passed'}`);
  process.exitCode = failed.length ? 1 : 0;
}

await main();
