import { pathToFileURL } from 'node:url';
import {
  buildVisionsMigrationPlan,
  VISIONS_LIVE_JSON,
  VISIONS_SOURCE_ROOT,
} from './archive-data-v2-visions-core.mjs';

export function evaluateVisionsMigrationPlan({
  visionsRoot = VISIONS_SOURCE_ROOT,
  liveJsonPath = VISIONS_LIVE_JSON,
} = {}) {
  const plan = buildVisionsMigrationPlan({ visionsRoot, liveJsonPath });
  return {
    ok: plan.ok,
    sourceFiles: plan.inventory.allFiles.length,
    sourceImages: plan.inventory.imageFiles.length,
    sourceMetaFiles: plan.inventory.metaFiles.length,
    plannedOrdinaryEntries: plan.ordinaryEntries,
    plannedShowcaseEntries: plan.showcaseEntries,
    plannedCharacters: plan.characters,
    plannedTargets: plan.targets.length,
    sourceManifestRecords: plan.sourceManifestRecords,
    kindCounts: plan.kindCounts,
    targetRoles: plan.targetRoles,
    duplicateIds: plan.duplicateIds,
    duplicateTargets: plan.duplicateTargets,
    duplicateTitlesAcrossPeriods: plan.duplicateTitlesAcrossPeriods,
    liveDifferingEntries: plan.liveDifferingEntries,
    liveFieldDifferences: plan.liveFieldDifferences,
    liveTotalFieldDifferences: plan.liveTotalFieldDifferences,
    blockedReasons: plan.blockedReasons,
    writeActions: 0,
  };
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] ArchiveData-v2 Visions migration plan`);
  for (const key of [
    'sourceFiles',
    'sourceImages',
    'sourceMetaFiles',
    'plannedOrdinaryEntries',
    'plannedShowcaseEntries',
    'plannedCharacters',
    'plannedTargets',
    'sourceManifestRecords',
    'duplicateIds',
    'duplicateTargets',
    'duplicateTitlesAcrossPeriods',
    'liveDifferingEntries',
    'liveTotalFieldDifferences',
    'writeActions',
  ]) console.log(`  ${key}: ${result[key]}`);
  console.log(`  kindCounts: ${JSON.stringify(result.kindCounts)}`);
  console.log(`  targetRoles: ${JSON.stringify(result.targetRoles)}`);
  console.log(`  liveFieldDifferences: ${JSON.stringify(result.liveFieldDifferences)}`);
  console.log(`  blockedReasons: ${result.blockedReasons.length ? result.blockedReasons.join(', ') : 'none'}`);
  console.log(`Result: archive data v2 visions migration plan ${result.ok ? 'passed' : 'failed'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluateVisionsMigrationPlan();
  printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}
