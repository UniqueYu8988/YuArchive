import { pathToFileURL } from 'node:url';
import {
  buildTextsMigrationPlan,
  TEXTS_SOURCE_ROOT,
} from './archive-data-v2-texts-core.mjs';

export function evaluateTextsMigrationPlan({ textsRoot = TEXTS_SOURCE_ROOT } = {}) {
  const plan = buildTextsMigrationPlan({ textsRoot });
  return {
    ok: plan.ok,
    sourceFiles: plan.inventory.allFiles.length,
    sourceMarkdown: plan.inventory.markdownFiles.length,
    sourceImages: plan.inventory.imageFiles.length,
    sourceSectionConfigs: plan.inventory.sectionConfig.sections.size,
    plannedEntries: plan.entries,
    kindCounts: plan.kindCounts,
    targetRoles: plan.targetRoles,
    plannedTargets: plan.targets.length,
    sourceManifestRecords: plan.sourceManifestRecords,
    duplicateIds: plan.duplicateIds,
    duplicateTargets: plan.duplicateTargets,
    missingCovers: plan.missingCovers,
    unexpectedCovers: plan.unexpectedCovers,
    orphanImages: plan.orphanImages,
    dateStatus: plan.dateStatus,
    datePolicyViolations: plan.datePolicyViolations,
    blockedReasons: plan.blockedReasons,
    writeActions: 0,
  };
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Archive Texts migration plan`);
  for (const key of [
    'sourceFiles',
    'sourceMarkdown',
    'sourceImages',
    'sourceSectionConfigs',
    'plannedEntries',
    'plannedTargets',
    'sourceManifestRecords',
    'duplicateIds',
    'duplicateTargets',
    'missingCovers',
    'unexpectedCovers',
    'orphanImages',
    'datePolicyViolations',
    'writeActions',
  ]) console.log(`  ${key}: ${result[key]}`);
  console.log(`  kindCounts: ${JSON.stringify(result.kindCounts)}`);
  console.log(`  targetRoles: ${JSON.stringify(result.targetRoles)}`);
  console.log(`  dateStatus: ${JSON.stringify(result.dateStatus)}`);
  console.log(`  blockedReasons: ${result.blockedReasons.length ? result.blockedReasons.join(', ') : 'none'}`);
  console.log(`Result: archive data v2 texts migration plan ${result.ok ? 'passed' : 'failed'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluateTextsMigrationPlan();
  printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}

