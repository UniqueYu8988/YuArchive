import path from 'node:path';
import {
  ARCHIVE_DATA_V2_ROOT,
  existsDir,
  existsFile,
} from './archive-data-v2-visions-core.mjs';
import {
  assertVisionsPreviewSafe,
  buildVisionsPreview,
} from './archive-studio-v0-visions-preview-core.mjs';
import { evaluateVisionsV2Shape } from './check-archive-data-v2-visions-shape.mjs';

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (
    path.isAbsolute(relativePath)
    || relativePath.includes('\\')
    || relativePath.split('/').includes('..')
    || relative.startsWith('..')
    || path.isAbsolute(relative)
  ) throw new Error('unsafe_visions_gate_path');
  return resolved;
}

export function evaluateVisionsWriteGate(payload, {
  v2Root = ARCHIVE_DATA_V2_ROOT,
  expectedMinimumEntries = 112,
  expectedMinimumKinds,
  expectedCharacters = 20,
  requireMigrationBaseline = true,
} = {}) {
  const preview = buildVisionsPreview(payload);
  assertVisionsPreviewSafe(preview);
  const baseline = evaluateVisionsV2Shape({
    v2Root,
    expectedMinimumEntries,
    ...(expectedMinimumKinds ? { expectedMinimumKinds } : {}),
    expectedCharacters,
    requireMigrationBaseline,
  });
  const targetEntryDir = resolveInside(v2Root, preview.target.entryRelativeDir);
  const targetEntryExists = existsDir(targetEntryDir);
  const targetFiles = [preview.target.entryYaml, preview.target.poster];
  const targetFilesExisting = targetFiles.filter(relativePath => (
    existsFile(resolveInside(v2Root, relativePath))
  )).length;
  const blockedReasons = [
    ...preview.errors.map(error => error.code),
    !baseline.ok ? 'visions_v2_baseline_failed' : null,
    targetEntryExists ? 'create_target_exists' : null,
    targetFilesExisting ? 'create_target_files_exist' : null,
  ].filter(Boolean);
  return {
    ok: blockedReasons.length === 0,
    allowedToRequestWrite: blockedReasons.length === 0,
    preview,
    target: preview.target,
    targetEntryExists,
    targetFilesExisting,
    operations: preview.operations,
    blockedReasons,
    baseline: {
      ok: baseline.ok,
      totalEntries: baseline.totalEntries,
      malformedEntries: baseline.malformedEntries,
      privacyRuleHits: baseline.privacyRuleHits,
    },
  };
}
