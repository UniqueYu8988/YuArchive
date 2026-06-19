import path from 'node:path';
import {
  ARCHIVE_DATA_V2_ROOT,
  existsDir,
  existsFile,
} from './archive-data-v2-texts-core.mjs';
import {
  assertTextsPreviewSafe,
  buildTextsPreview,
} from './archive-studio-v0-texts-preview-core.mjs';
import { evaluateTextsV2Shape } from './check-archive-data-v2-texts-shape.mjs';

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (
    path.isAbsolute(relativePath)
    || relativePath.includes('\\')
    || relativePath.split('/').includes('..')
    || relative.startsWith('..')
    || path.isAbsolute(relative)
  ) throw new Error('unsafe_texts_gate_path');
  return resolved;
}

export function evaluateTextsWriteGate(payload, {
  v2Root = ARCHIVE_DATA_V2_ROOT,
  expectedMinimumEntries = 132,
  expectedMinimumKinds,
  requireMigrationBaseline = true,
} = {}) {
  const preview = buildTextsPreview(payload);
  assertTextsPreviewSafe(preview);
  const baseline = evaluateTextsV2Shape({
    v2Root,
    expectedMinimumEntries,
    ...(expectedMinimumKinds ? { expectedMinimumKinds } : {}),
    requireMigrationBaseline,
  });
  const targetEntryDir = resolveInside(v2Root, preview.target.entryRelativeDir);
  const targetEntryExists = existsDir(targetEntryDir);
  const targetFiles = [
    preview.target.entryYaml,
    preview.target.contentMd,
    preview.target.cover,
  ].filter(Boolean);
  const targetFilesExisting = targetFiles.filter(relativePath => existsFile(resolveInside(v2Root, relativePath))).length;
  const blockedReasons = [
    ...preview.errors.map(error => error.code),
    !baseline.ok ? 'texts_v2_baseline_failed' : null,
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

