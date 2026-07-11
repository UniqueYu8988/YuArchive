import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateLegacyDataArchiveCoverage } from './audit-legacy-data-archive-coverage.mjs';
import { evaluateLegacyGenerationPublishDependencies } from './audit-legacy-generation-publish-dependencies.mjs';
import { evaluateLegacyPublishScriptGuard } from './check-legacy-publish-script-guard.mjs';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';
import { evaluateMusicV2Shape } from './check-archive-data-v2-music-shape.mjs';
import { evaluateTextsV2Shape } from './check-archive-data-v2-texts-shape.mjs';
import { evaluateVisionsV2Shape } from './check-archive-data-v2-visions-shape.mjs';
import { buildArchiveMigrationColdStoragePlan } from './plan-archive-migration-cold-storage.mjs';
import { buildLegacyDataColdStoragePlan } from './plan-legacy-data-cold-storage.mjs';
import { evaluateRetiredColdStorageState } from './check-retired-cold-storage-state.mjs';

const PROJECT_ROOT = process.cwd();
const ARCHIVE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Archive');
const LEGACY_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');
const MIGRATION_ROOT = path.join(ARCHIVE_ROOT, 'migration');

function runNodeScript(script) {
  try {
    execFileSync(process.execPath, [script], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return { ok: true, detail: 'passed' };
  } catch (error) {
    return {
      ok: false,
      detail: String(error.stdout || error.stderr || error.message || 'failed').split(/\r?\n/)[0],
    };
  }
}

function existsDir(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function listDirSafe(target) {
  try {
    return fs.readdirSync(target, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walkFiles(root) {
  const files = [];
  for (const entry of listDirSafe(root)) {
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(current));
    else if (entry.isFile()) files.push(current);
  }
  return files;
}

function gitStatus() {
  const output = execFileSync('git', ['status', '--short', '--branch'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  const lines = output.split(/\r?\n/).filter(Boolean);
  return {
    ok: lines.length === 1,
    branch: lines[0] ?? '',
    dirtyLines: Math.max(0, lines.length - 1),
  };
}

function migrationState() {
  const exists = existsDir(MIGRATION_ROOT);
  const files = exists ? walkFiles(MIGRATION_ROOT) : [];
  const transactionRoot = path.join(MIGRATION_ROOT, 'archive-studio-v0', 'transactions');
  const transactions = existsDir(transactionRoot)
    ? listDirSafe(transactionRoot).filter(entry => entry.isDirectory()).length
    : 0;
  const boardRoots = ['games', 'music', 'texts', 'visions'].filter(board => existsDir(path.join(MIGRATION_ROOT, board)));
  return {
    exists,
    files: files.length,
    transactions,
    boardMigrationRoots: boardRoots.length,
    retirementBlocker: exists && files.length > 0,
  };
}

function buildExperiments() {
  const experiments = [];

  const status = gitStatus();
  experiments.push({
    name: 'git_worktree_clean',
    ok: status.ok,
    detail: `${status.branch}; dirtyLines=${status.dirtyLines}`,
    retirementRequired: true,
  });

  experiments.push({
    name: 'public_data_shape',
    ...runNodeScript('scripts/check-public-data-shape.mjs'),
    retirementRequired: true,
  });

  experiments.push({
    name: 'generated_data_privacy',
    ...runNodeScript('scripts/check-generated-data-privacy.mjs'),
    retirementRequired: true,
  });

  const games = evaluateGamesV2Shape();
  experiments.push({
    name: 'archive_games_shape',
    ok: games.ok,
    detail: `entries=${games.totalEntries}; malformed=${games.malformedEntries}`,
    retirementRequired: true,
  });

  const music = evaluateMusicV2Shape();
  experiments.push({
    name: 'archive_music_shape',
    ok: music.ok,
    detail: `entries=${music.albumEntryDirs}; malformed=${music.malformedEntryDirs}`,
    retirementRequired: true,
  });

  const texts = evaluateTextsV2Shape();
  experiments.push({
    name: 'archive_texts_shape',
    ok: texts.ok,
    detail: `entries=${texts.totalEntries}; malformed=${texts.malformedEntries}`,
    retirementRequired: true,
  });

  const visions = evaluateVisionsV2Shape();
  experiments.push({
    name: 'archive_visions_shape',
    ok: visions.ok,
    detail: `entries=${visions.totalEntries}; malformed=${visions.malformedEntries}`,
    retirementRequired: true,
  });

  experiments.push({
    name: 'archive_studio_public_sync_sandbox',
    ...runNodeScript('scripts/check-archive-studio-public-sync.mjs'),
    retirementRequired: true,
  });

  experiments.push({
    name: 'archive_studio_update_sandbox',
    ...runNodeScript('scripts/check-archive-studio-updates.mjs'),
    retirementRequired: true,
  });

  const coverage = evaluateLegacyDataArchiveCoverage();
  experiments.push({
    name: 'legacy_data_archive_coverage',
    ok: coverage.ok,
    detail: `retirementReady=${coverage.retirementReady}; blockingDependencies=${coverage.blockers.blockingDependencies}`,
    retirementRequired: true,
    retirementBlocker: !coverage.retirementReady,
  });

  const dependencies = evaluateLegacyGenerationPublishDependencies();
  experiments.push({
    name: 'legacy_generation_publish_dependencies',
    ok: dependencies.ok,
    detail: `retirementReady=${dependencies.retirementReady}; blockers=${dependencies.blockers.length}`,
    retirementRequired: true,
    retirementBlocker: !dependencies.retirementReady,
  });

  const publishGuard = evaluateLegacyPublishScriptGuard();
  experiments.push({
    name: 'legacy_publish_script_guard',
    ok: publishGuard.ok,
    detail: `guarded=${publishGuard.guarded}`,
    retirementRequired: false,
    retirementBlocker: !publishGuard.guarded,
  });

  const coldStorage = evaluateRetiredColdStorageState();
  experiments.push({
    name: 'retired_cold_storage_state',
    ok: coldStorage.ok,
    detail: `legacyData=${coldStorage.legacyData.ok}; legacyFiles=${coldStorage.legacyData.files}; migration=${coldStorage.migration.ok}; migrationFiles=${coldStorage.migration.files}`,
    retirementRequired: !existsDir(LEGACY_ROOT) || !existsDir(MIGRATION_ROOT),
  });

  const migration = migrationState();
  experiments.push({
    name: 'archive_migration_retirement_state',
    ok: true,
    detail: `exists=${migration.exists}; files=${migration.files}; transactions=${migration.transactions}; boardRoots=${migration.boardMigrationRoots}`,
    retirementRequired: true,
    retirementBlocker: migration.retirementBlocker,
  });

  if (existsDir(MIGRATION_ROOT)) {
    const migrationColdStorage = buildArchiveMigrationColdStoragePlan();
    experiments.push({
      name: 'archive_migration_cold_storage_plan',
      ok: migrationColdStorage.ok,
      detail: `files=${migrationColdStorage.files}; mode=${migrationColdStorage.recommendedMode}; deletionRecommendedNow=${migrationColdStorage.deletionRecommendedNow}`,
      retirementRequired: true,
    });
  }

  if (existsDir(LEGACY_ROOT)) {
    const legacyDataColdStorage = buildLegacyDataColdStoragePlan();
    experiments.push({
      name: 'legacy_data_cold_storage_plan',
      ok: legacyDataColdStorage.ok,
      detail: `files=${legacyDataColdStorage.files}; mode=${legacyDataColdStorage.recommendedMode}; deletionRecommendedNow=${legacyDataColdStorage.deletionRecommendedNow}`,
      retirementRequired: true,
    });
  }

  experiments.push({
    name: 'legacy_data_exists_for_cold_backup_decision',
    ok: existsDir(LEGACY_ROOT) || coldStorage.legacyData.ok,
    detail: `exists=${existsDir(LEGACY_ROOT)}; coldStored=${coldStorage.legacyData.ok}`,
    retirementRequired: true,
    retirementBlocker: existsDir(LEGACY_ROOT),
  });

  return experiments;
}

function summarize(experiments) {
  const runtimeRequired = experiments.filter(item => item.retirementRequired);
  const runtimeReady = runtimeRequired.every(item => item.ok);
  const retirementBlockers = experiments.filter(item => item.retirementBlocker);
  const retirementReady = runtimeReady && retirementBlockers.length === 0;
  return { runtimeReady, retirementReady, retirementBlockers };
}

function printResult(experiments, summary) {
  console.log('[PASS] Legacy Data / migration retirement experiments completed');
  console.log(`  runtimeReady: ${summary.runtimeReady}`);
  console.log(`  retirementReady: ${summary.retirementReady}`);
  console.log('');
  for (const item of experiments) {
    const marker = item.ok ? 'PASS' : 'FAIL';
    const blocker = item.retirementBlocker ? ' BLOCKER' : '';
    console.log(`[${marker}] ${item.name}${blocker}`);
    console.log(`  ${item.detail}`);
  }
  console.log('');
  console.log(`Retirement blockers: ${summary.retirementBlockers.length}`);
  for (const item of summary.retirementBlockers) console.log(`  - ${item.name}: ${item.detail}`);
  console.log('');
  console.log('Decision:');
  if (summary.retirementReady) {
    console.log('  old Data and Archive/migration may proceed to explicit user-confirmed transfer/delete planning');
  } else if (summary.runtimeReady) {
    console.log('  runtime workflow is healthy, but retirement remains blocked');
  } else {
    console.log('  runtime checks failed; do not plan retirement');
  }
}

export function evaluateRetirementReadinessExperiments() {
  const experiments = buildExperiments();
  const summary = summarize(experiments);
  return { experiments, summary };
}

function main() {
  const { experiments, summary } = evaluateRetirementReadinessExperiments();
  printResult(experiments, summary);
  process.exitCode = summary.runtimeReady ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
