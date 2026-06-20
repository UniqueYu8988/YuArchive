import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARCHIVE_DATA_V2_ROOT,
  buildVisionsMigrationPlan,
  checksumFile,
  existsDir,
  existsFile,
  normalizeRelative,
  serializeCharacterYaml,
  serializeShowcaseEntryYaml,
  serializeVisionEntryYaml,
  serializeVisionsPeriodsYaml,
  sha256,
  VISIONS_SOURCE_ROOT,
} from './archive-data-v2-visions-core.mjs';
import { evaluateVisionsV2Shape } from './check-archive-data-v2-visions-shape.mjs';

const AUTHORIZATION_PHRASE = 'I authorize ArchiveData-v2 Visions migration';

function parseArgs(args) {
  const result = { execute: false, authorization: '', resumeIdenticalResiduals: false };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--execute') result.execute = true;
    if (args[index] === '--authorization') result.authorization = args[index + 1] ?? '';
    if (args[index] === '--resume-identical-residuals') result.resumeIdenticalResiduals = true;
  }
  return result;
}

function resolveInside(root, relativePath) {
  if (
    typeof relativePath !== 'string'
    || path.isAbsolute(relativePath)
    || relativePath.includes('..')
    || relativePath.includes('\\')
  ) throw new Error('unsafe_relative_path');
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('path_escaped_root');
  return resolved;
}

function sourceBaseline(files, sourceRoot) {
  return new Map(files.map(file => [normalizeRelative(sourceRoot, file), checksumFile(file)]));
}

function compareSourceBaseline(before, files, sourceRoot) {
  let changed = 0;
  let missing = 0;
  for (const file of files) {
    const key = normalizeRelative(sourceRoot, file);
    if (!existsFile(file)) {
      missing += 1;
      continue;
    }
    if (before.get(key) !== checksumFile(file)) changed += 1;
  }
  return { changed, missing };
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeText(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, value, { encoding: 'utf8', flag: 'wx' });
}

function writeBuffer(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, value, { flag: 'wx' });
}

function buildLegacyReport(plan) {
  return [
    '# ArchiveData-v2 Visions Legacy Field Report',
    '',
    `- Ordinary entries: ${plan.ordinaryEntries}`,
    `- Movie: ${plan.kindCounts.movie}`,
    `- Series: ${plan.kindCounts.series}`,
    `- Showcase: ${plan.kindCounts.showcase}`,
    `- Characters: ${plan.characters}`,
    `- Duplicate titles across periods: ${plan.duplicateTitlesAcrossPeriods}`,
    `- Source/live differing entries: ${plan.liveDifferingEntries}`,
    `- Source/live field differences: ${JSON.stringify(plan.liveFieldDifferences)}`,
    '- Compatibility policy: source YAML is authoritative; series maps to legacy type tv',
    '- Synthetic years: compatibility-only',
    '- Unmapped files: 0',
    '- Full local paths: none',
    '- Old source writes: none',
    '',
  ].join('\n');
}

function stageMigration(plan, stageRoot) {
  const manifest = [];
  const entriesByMeta = new Map();
  for (const entry of plan.inventory.entries) {
    const entryRoot = `entries/visions/${entry.kind}/${entry.id}`;
    const yamlRelative = `${entryRoot}/entry.yaml`;
    const posterRelative = `${entryRoot}/poster${path.extname(entry.sourcePath).toLowerCase()}`;
    const yaml = serializeVisionEntryYaml(entry);
    writeText(resolveInside(stageRoot, yamlRelative), yaml);
    const poster = fs.readFileSync(entry.sourcePath);
    writeBuffer(resolveInside(stageRoot, posterRelative), poster);
    if (sha256(poster) !== entry.sourceChecksum) throw new Error('poster_checksum_mismatch');

    const metaTargets = entriesByMeta.get(entry.sourceMetaRelativePath) ?? [];
    metaTargets.push({
      role: 'entry_yaml',
      relativePath: yamlRelative,
      sha256: sha256(Buffer.from(yaml, 'utf8')),
    });
    entriesByMeta.set(entry.sourceMetaRelativePath, metaTargets);
    manifest.push({
      board: 'visions',
      kind: entry.kind,
      entryId: entry.id,
      sourceRole: 'poster',
      sourceRelative: entry.sourceRelativePath,
      sourceSha256: entry.sourceChecksum,
      targetRoles: [{
        role: 'poster',
        relativePath: posterRelative,
        sha256: entry.sourceChecksum,
      }],
      status: 'copied',
    });
  }

  for (const metaPath of plan.inventory.metaFiles.filter(file => !file.endsWith(`${path.sep}角色橱窗${path.sep}meta.yaml`))) {
    const sourceRelative = normalizeRelative(plan.inventory.visionsRoot, metaPath);
    manifest.push({
      board: 'visions',
      kind: 'metadata',
      entryId: null,
      sourceRole: 'group_meta_yaml',
      sourceRelative,
      sourceSha256: checksumFile(metaPath),
      targetRoles: entriesByMeta.get(sourceRelative) ?? [],
      status: 'transformed_group_metadata',
    });
  }

  const showcase = plan.inventory.showcase;
  const showcaseRoot = `entries/visions/showcase/${showcase.id}`;
  const showcaseYamlRelative = `${showcaseRoot}/entry.yaml`;
  const showcaseYaml = serializeShowcaseEntryYaml(showcase);
  writeText(resolveInside(stageRoot, showcaseYamlRelative), showcaseYaml);
  const showcaseMetaTargets = [{
    role: 'showcase_entry_yaml',
    relativePath: showcaseYamlRelative,
    sha256: sha256(Buffer.from(showcaseYaml, 'utf8')),
  }];

  for (const character of showcase.characters) {
    const characterRoot = `${showcaseRoot}/characters/${character.id}`;
    const yamlRelative = `${characterRoot}/character.yaml`;
    const avatarRelative = `${characterRoot}/avatar${path.extname(character.avatarPath).toLowerCase()}`;
    const clipRelative = `${characterRoot}/clip${path.extname(character.gifPath).toLowerCase()}`;
    const yaml = serializeCharacterYaml(character);
    writeText(resolveInside(stageRoot, yamlRelative), yaml);
    showcaseMetaTargets.push({
      role: 'character_yaml',
      relativePath: yamlRelative,
      sha256: sha256(Buffer.from(yaml, 'utf8')),
    });
    for (const [role, sourcePath, sourceRelative, sourceChecksum, targetRelative] of [
      ['character_avatar', character.avatarPath, character.avatarRelativePath, character.avatarChecksum, avatarRelative],
      ['character_clip', character.gifPath, character.gifRelativePath, character.gifChecksum, clipRelative],
    ]) {
      const bytes = fs.readFileSync(sourcePath);
      writeBuffer(resolveInside(stageRoot, targetRelative), bytes);
      if (sha256(bytes) !== sourceChecksum) throw new Error(`${role}_checksum_mismatch`);
      manifest.push({
        board: 'visions',
        kind: 'showcase',
        entryId: character.id,
        sourceRole: role === 'character_avatar' ? 'avatar' : 'clip',
        sourceRelative,
        sourceSha256: sourceChecksum,
        targetRoles: [{ role, relativePath: targetRelative, sha256: sourceChecksum }],
        status: 'copied',
      });
    }
  }
  manifest.push({
    board: 'visions',
    kind: 'showcase',
    entryId: showcase.id,
    sourceRole: 'showcase_meta_yaml',
    sourceRelative: showcase.sourceMetaRelativePath,
    sourceSha256: checksumFile(showcase.sourceMetaPath),
    targetRoles: showcaseMetaTargets,
    status: 'transformed_showcase_metadata',
  });

  const configRelative = 'config/visions-periods.yaml';
  const config = serializeVisionsPeriodsYaml();
  writeText(resolveInside(stageRoot, configRelative), config);
  if (manifest.length !== plan.sourceManifestRecords) throw new Error('manifest_record_count_mismatch');
  writeText(
    resolveInside(stageRoot, 'migration/visions/migration-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeText(resolveInside(stageRoot, 'migration/visions/unmapped-files.json'), '[]\n');
  writeText(resolveInside(stageRoot, 'migration/visions/legacy-field-report.md'), buildLegacyReport(plan));
  return manifest;
}

function assertTargetsAbsent(v2Root) {
  const targets = [
    path.join(v2Root, 'entries', 'visions'),
    path.join(v2Root, 'config', 'visions-periods.yaml'),
    path.join(v2Root, 'migration', 'visions'),
  ];
  if (targets.some(target => existsDir(target) || existsFile(target))) {
    throw new Error('visions_v2_target_already_exists');
  }
}

function filesEqual(left, right) {
  return existsFile(left) && existsFile(right) && checksumFile(left) === checksumFile(right);
}

function relativeFiles(root) {
  if (!existsDir(root)) return [];
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

function assertDirectoryResidualMatches(stagedRoot, targetRoot) {
  if (!existsDir(targetRoot)) return;
  for (const relativePath of relativeFiles(targetRoot)) {
    if (!filesEqual(resolveInside(stagedRoot, relativePath), resolveInside(targetRoot, relativePath))) {
      throw new Error('nonidentical_generated_residual');
    }
  }
}

function assertResidualsMatchStage(stageRoot, v2Root) {
  assertDirectoryResidualMatches(
    path.join(stageRoot, 'entries', 'visions'),
    path.join(v2Root, 'entries', 'visions'),
  );
  assertDirectoryResidualMatches(
    path.join(stageRoot, 'migration', 'visions'),
    path.join(v2Root, 'migration', 'visions'),
  );
  const stagedConfig = path.join(stageRoot, 'config', 'visions-periods.yaml');
  const targetConfig = path.join(v2Root, 'config', 'visions-periods.yaml');
  if (existsFile(targetConfig) && !filesEqual(stagedConfig, targetConfig)) {
    throw new Error('nonidentical_generated_config_residual');
  }
}

function copyFileIdempotent(source, target) {
  ensureParent(target);
  if (existsFile(target)) {
    if (!filesEqual(source, target)) throw new Error('target_file_conflict');
    return;
  }
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
}

function copyTreeIdempotent(sourceRoot, targetRoot) {
  fs.mkdirSync(targetRoot, { recursive: true });
  for (const relativePath of relativeFiles(sourceRoot)) {
    copyFileIdempotent(resolveInside(sourceRoot, relativePath), resolveInside(targetRoot, relativePath));
  }
}

function copyStagedOutput(stageRoot, v2Root) {
  copyTreeIdempotent(
    path.join(stageRoot, 'entries', 'visions'),
    path.join(v2Root, 'entries', 'visions'),
  );
  copyFileIdempotent(
    path.join(stageRoot, 'config', 'visions-periods.yaml'),
    path.join(v2Root, 'config', 'visions-periods.yaml'),
  );
  copyTreeIdempotent(
    path.join(stageRoot, 'migration', 'visions'),
    path.join(v2Root, 'migration', 'visions'),
  );
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function removeWithRetry(target, options) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    fs.rmSync(target, options);
    if (!fs.existsSync(target)) return;
    sleep(500);
  }
  throw new Error('rollback_target_residual');
}

function rollbackTargets(v2Root) {
  removeWithRetry(path.join(v2Root, 'entries', 'visions'), { recursive: true, force: true });
  removeWithRetry(path.join(v2Root, 'config', 'visions-periods.yaml'), { force: true });
  removeWithRetry(path.join(v2Root, 'migration', 'visions'), { recursive: true, force: true });
}

function shapeFailureSummary(shape) {
  return {
    failures: shape.failures,
    totalEntries: shape.totalEntries,
    totalCharacters: shape.totalCharacters,
    malformedEntries: shape.malformedEntries,
    malformedCharacters: shape.malformedCharacters,
    invalidIds: shape.invalidIds,
    invalidCharacterIds: shape.invalidCharacterIds,
    periodErrors: shape.periodErrors,
    characterOrderErrors: shape.characterOrderErrors,
    manifestRecords: shape.manifestRecords,
    unmappedFiles: shape.unmappedFiles,
    privacyRuleHits: shape.privacyRuleHits,
  };
}

export function runVisionsMigration({
  execute = false,
  authorization = '',
  resumeIdenticalResiduals = false,
  visionsRoot = VISIONS_SOURCE_ROOT,
  v2Root = ARCHIVE_DATA_V2_ROOT,
} = {}) {
  const plan = buildVisionsMigrationPlan({ visionsRoot });
  const summary = {
    ok: plan.ok,
    mode: execute ? 'execute-requested' : 'plan',
    ordinaryEntries: plan.ordinaryEntries,
    showcaseEntries: plan.showcaseEntries,
    characters: plan.characters,
    targets: plan.targets.length,
    manifestRecords: plan.sourceManifestRecords,
    blockedReasons: [...plan.blockedReasons],
    executeImplemented: true,
    writeScope: 'none',
  };
  if (!execute) return summary;
  if (authorization !== AUTHORIZATION_PHRASE) {
    return { ...summary, ok: false, blockedReasons: [...summary.blockedReasons, 'authorization_phrase_mismatch'] };
  }
  if (!plan.ok) return summary;
  if (!resumeIdenticalResiduals) assertTargetsAbsent(v2Root);

  const before = sourceBaseline(plan.inventory.allFiles, visionsRoot);
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-data-v2-visions-migration-'));
  let copied = false;
  try {
    const manifest = stageMigration(plan, stageRoot);
    const stagedShape = evaluateVisionsV2Shape({ v2Root: stageRoot });
    if (!stagedShape.ok) {
      throw new Error(`staged_visions_shape_failed:${JSON.stringify(shapeFailureSummary(stagedShape))}`);
    }
    if (resumeIdenticalResiduals) assertResidualsMatchStage(stageRoot, v2Root);
    copyStagedOutput(stageRoot, v2Root);
    copied = true;
    sleep(1500);
    const finalShape = evaluateVisionsV2Shape({ v2Root });
    if (!finalShape.ok) {
      throw new Error(`final_visions_shape_failed:${JSON.stringify(shapeFailureSummary(finalShape))}`);
    }
    const sourceAfter = compareSourceBaseline(before, plan.inventory.allFiles, visionsRoot);
    if (sourceAfter.changed || sourceAfter.missing) throw new Error('old_visions_source_changed');
    return {
      ok: true,
      mode: 'execute',
      entries: finalShape.totalEntries,
      kindCounts: finalShape.kindCounts,
      posterFiles: finalShape.posterFiles,
      characters: finalShape.totalCharacters,
      avatarFiles: finalShape.avatarFiles,
      clipFiles: finalShape.clipFiles,
      manifestRecords: manifest.length,
      unmappedFiles: finalShape.unmappedFiles,
      sourceBaselineFiles: before.size,
      sourceChangedFiles: sourceAfter.changed,
      sourceMissingFiles: sourceAfter.missing,
      privacyRuleHits: finalShape.privacyRuleHits,
      writeScope: 'archive-data-v2-visions-only',
      buildArchiveRun: false,
      publishRun: false,
    };
  } catch (error) {
    let rollbackError = null;
    if (copied) {
      try {
        rollbackTargets(v2Root);
      } catch (caught) {
        rollbackError = caught;
      }
    }
    if (rollbackError) {
      throw new Error(`${error instanceof Error ? error.message : 'migration_failed'};rollback:${rollbackError.message}`);
    }
    throw error;
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] ArchiveData-v2 Visions migration`);
  for (const [key, value] of Object.entries(result)) {
    if (['ok', 'kindCounts', 'blockedReasons'].includes(key)) continue;
    console.log(`  ${key}: ${value}`);
  }
  if (result.kindCounts) console.log(`  kindCounts: ${JSON.stringify(result.kindCounts)}`);
  console.log(`  blockedReasons: ${result.blockedReasons?.length ? result.blockedReasons.join(', ') : 'none'}`);
  console.log(`Result: archive data v2 visions migration ${result.ok ? 'passed' : 'failed'}`);
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : 'unknown_error';
  return message
    .replace(/[A-Za-z]:[\\/][^\s'"]+/g, '[local-path]')
    .replace(/OneDrive/gi, '[external-data]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = runVisionsMigration(parseArgs(process.argv.slice(2)));
    printResult(result);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] ArchiveData-v2 Visions migration');
    console.log(`  error: ${safeErrorMessage(error)}`);
    console.log('Result: archive data v2 visions migration failed');
    process.exitCode = 1;
  }
}
