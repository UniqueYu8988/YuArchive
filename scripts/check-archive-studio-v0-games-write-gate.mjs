import path from 'node:path';
import {
  ARCHIVE_DATA_V2_ROOT,
  existsDir,
  existsFile,
} from './archive-data-v2-games-core.mjs';
import {
  assertGamesPreviewSafe,
  buildGamesPreview,
} from './archive-studio-v0-games-preview-core.mjs';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (
    path.isAbsolute(relativePath)
    || relativePath.includes('\\')
    || relativePath.split('/').includes('..')
    || relative.startsWith('..')
    || path.isAbsolute(relative)
  ) throw new Error('unsafe_games_gate_path');
  return resolved;
}

export function evaluateGamesWriteGate(payload, {
  v2Root = ARCHIVE_DATA_V2_ROOT,
  expectedMinimumEntries = 282,
  expectedMinimumKinds,
  expectedSeasons = 40,
  expectedMinimumMetadataDisabled = 93,
  expectedLiveParentCovers = 2,
  requireMigrationBaseline = true,
} = {}) {
  const preview = buildGamesPreview(payload);
  assertGamesPreviewSafe(preview);
  const baseline = evaluateGamesV2Shape({
    v2Root,
    expectedMinimumEntries,
    ...(expectedMinimumKinds ? { expectedMinimumKinds } : {}),
    expectedSeasons,
    expectedMinimumMetadataDisabled,
    expectedLiveParentCovers,
    requireMigrationBaseline,
  });
  const targetEntryDir = resolveInside(v2Root, preview.target.entryRelativeDir);
  const targetEntryExists = existsDir(targetEntryDir);
  const targetFiles = [preview.target.entryYaml, preview.target.cover];
  const targetFilesExisting = targetFiles.filter(relativePath => existsFile(resolveInside(v2Root, relativePath))).length;
  const blockedReasons = [
    ...preview.errors.map(error => error.code),
    !baseline.ok ? 'games_v2_baseline_failed' : null,
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
      invalidParentReferences: baseline.invalidParentReferences,
      privacyRuleHits: baseline.privacyRuleHits,
    },
  };
}
