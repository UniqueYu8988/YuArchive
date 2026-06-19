import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARCHIVE_DATA_V2_ROOT,
  buildTextsMigrationPlan,
  checksumFile,
  existsDir,
  existsFile,
  serializeTextEntryYaml,
  serializeTextsSectionsYaml,
  sha256,
  TEXTS_SOURCE_ROOT,
} from './archive-data-v2-texts-core.mjs';
import { evaluateTextsV2Shape } from './check-archive-data-v2-texts-shape.mjs';

const AUTHORIZATION_PHRASE = 'I authorize ArchiveData-v2 Texts migration';

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

function sourceBaseline(files) {
  return new Map(files.map(file => [path.relative(TEXTS_SOURCE_ROOT, file).split(path.sep).join('/'), checksumFile(file)]));
}

function compareSourceBaseline(before, files) {
  let changed = 0;
  let missing = 0;
  for (const file of files) {
    const key = path.relative(TEXTS_SOURCE_ROOT, file).split(path.sep).join('/');
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

function relativeToV2(filePath, root) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function buildLegacyReport(plan) {
  const legacyCounts = {};
  for (const entry of plan.inventory.entries) {
    for (const key of Object.keys(entry.legacyFields)) {
      legacyCounts[key] = (legacyCounts[key] ?? 0) + 1;
    }
  }
  return [
    '# ArchiveData-v2 Texts Legacy Field Report',
    '',
    `- Entries: ${plan.entries}`,
    `- Article: ${plan.kindCounts.article ?? 0}`,
    `- Book note: ${plan.kindCounts.book_note ?? 0}`,
    `- Series note: ${plan.kindCounts.series_note ?? 0}`,
    `- Legacy field usage: ${JSON.stringify(legacyCounts)}`,
    '- Unmapped files: 0',
    '- Full local paths: none',
    '- Old source writes: none',
    '',
  ].join('\n');
}

function stageMigration(plan, stageRoot) {
  const manifest = [];
  for (const entry of plan.inventory.entries) {
    const entryRoot = `entries/texts/${entry.kind}/${entry.id}`;
    const entryYamlRelative = `${entryRoot}/entry.yaml`;
    const contentRelative = `${entryRoot}/content.md`;
    const entryYaml = serializeTextEntryYaml(entry);
    const content = `${entry.content}\n`;
    writeText(resolveInside(stageRoot, entryYamlRelative), entryYaml);
    writeText(resolveInside(stageRoot, contentRelative), content);

    const targetRoles = [
      { role: 'entry_yaml', relativePath: entryYamlRelative, sha256: sha256(Buffer.from(entryYaml, 'utf8')) },
      { role: 'content_md', relativePath: contentRelative, sha256: sha256(Buffer.from(content, 'utf8')) },
    ];
    manifest.push({
      board: 'texts',
      kind: entry.kind,
      entryId: entry.id,
      sourceRole: 'markdown',
      sourceRelative: entry.sourceRelativePath,
      sourceSha256: entry.sourceChecksum,
      targetRoles,
      status: 'transformed_frontmatter_and_content',
    });

    if (entry.coverPath) {
      const coverRelative = `${entryRoot}/cover${path.extname(entry.coverPath).toLowerCase()}`;
      const coverBytes = fs.readFileSync(entry.coverPath);
      writeBuffer(resolveInside(stageRoot, coverRelative), coverBytes);
      const copiedChecksum = sha256(coverBytes);
      if (copiedChecksum !== entry.coverChecksum) throw new Error('cover_checksum_mismatch');
      manifest.push({
        board: 'texts',
        kind: entry.kind,
        entryId: entry.id,
        sourceRole: 'cover',
        sourceRelative: entry.coverRelativePath,
        sourceSha256: entry.coverChecksum,
        targetRoles: [{ role: 'cover', relativePath: coverRelative, sha256: copiedChecksum }],
        status: 'copied',
      });
    }
  }

  const configRelative = 'config/texts-sections.yaml';
  const config = serializeTextsSectionsYaml(plan.inventory.sectionConfig);
  writeText(resolveInside(stageRoot, configRelative), config);
  manifest.push({
    board: 'texts',
    kind: 'config',
    entryId: null,
    sourceRole: 'sections_yaml',
    sourceRelative: 'sections.yaml',
    sourceSha256: checksumFile(plan.inventory.sectionsPath),
    targetRoles: [{
      role: 'sections_config',
      relativePath: configRelative,
      sha256: sha256(Buffer.from(config, 'utf8')),
    }],
    status: 'transformed_section_config',
  });

  if (manifest.length !== plan.sourceManifestRecords) throw new Error('manifest_record_count_mismatch');
  writeText(
    resolveInside(stageRoot, 'migration/texts/migration-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeText(resolveInside(stageRoot, 'migration/texts/unmapped-files.json'), '[]\n');
  writeText(resolveInside(stageRoot, 'migration/texts/legacy-field-report.md'), buildLegacyReport(plan));
  return manifest;
}

function assertTargetsAbsent(v2Root) {
  const targets = [
    path.join(v2Root, 'entries', 'texts'),
    path.join(v2Root, 'config', 'texts-sections.yaml'),
    path.join(v2Root, 'migration', 'texts'),
  ];
  const existing = targets.filter(target => existsDir(target) || existsFile(target));
  if (existing.length) throw new Error('texts_v2_target_already_exists');
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
    const staged = resolveInside(stagedRoot, relativePath);
    const target = resolveInside(targetRoot, relativePath);
    if (!filesEqual(staged, target)) throw new Error('nonidentical_generated_residual');
  }
}

function assertResidualsMatchStage(stageRoot, v2Root) {
  assertDirectoryResidualMatches(
    path.join(stageRoot, 'entries', 'texts'),
    path.join(v2Root, 'entries', 'texts'),
  );
  assertDirectoryResidualMatches(
    path.join(stageRoot, 'migration', 'texts'),
    path.join(v2Root, 'migration', 'texts'),
  );
  const stagedConfig = path.join(stageRoot, 'config', 'texts-sections.yaml');
  const targetConfig = path.join(v2Root, 'config', 'texts-sections.yaml');
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
    copyFileIdempotent(
      resolveInside(sourceRoot, relativePath),
      resolveInside(targetRoot, relativePath),
    );
  }
}

function copyStagedOutput(stageRoot, v2Root) {
  copyTreeIdempotent(
    path.join(stageRoot, 'entries', 'texts'),
    path.join(v2Root, 'entries', 'texts'),
  );
  copyFileIdempotent(
    path.join(stageRoot, 'config', 'texts-sections.yaml'),
    path.join(v2Root, 'config', 'texts-sections.yaml'),
  );
  copyTreeIdempotent(
    path.join(stageRoot, 'migration', 'texts'),
    path.join(v2Root, 'migration', 'texts'),
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
  removeWithRetry(path.join(v2Root, 'entries', 'texts'), { recursive: true, force: true });
  removeWithRetry(path.join(v2Root, 'config', 'texts-sections.yaml'), { force: true });
  removeWithRetry(path.join(v2Root, 'migration', 'texts'), { recursive: true, force: true });
  for (const directory of [
    path.join(v2Root, 'config'),
    path.join(v2Root, 'entries'),
  ]) {
    try {
      fs.rmdirSync(directory);
    } catch (error) {
      if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error;
    }
  }
}

function shapeFailureSummary(shape) {
  return {
    failures: shape.failures,
    totalEntries: shape.totalEntries,
    malformedEntries: shape.malformedEntries,
    invalidIds: shape.invalidIds,
    sectionKindMismatches: shape.sectionKindMismatches,
    datePolicyViolations: shape.datePolicyViolations,
    configErrors: shape.configErrors,
    configMissingSections: shape.configMissingSections,
    configKindMismatches: shape.configKindMismatches,
    manifestRecords: shape.manifestRecords,
    unmappedFiles: shape.unmappedFiles,
    privacyRuleHits: shape.privacyRuleHits,
    privacyRules: shape.privacyRules,
  };
}

export function runTextsMigration({
  execute = false,
  authorization = '',
  resumeIdenticalResiduals = false,
  textsRoot = TEXTS_SOURCE_ROOT,
  v2Root = ARCHIVE_DATA_V2_ROOT,
} = {}) {
  const plan = buildTextsMigrationPlan({ textsRoot });
  const planSummary = {
    ok: plan.ok,
    mode: execute ? 'execute-requested' : 'plan',
    entries: plan.entries,
    targets: plan.targets.length,
    manifestRecords: plan.sourceManifestRecords,
    blockedReasons: [...plan.blockedReasons],
    executeImplemented: true,
    writeScope: 'none',
  };
  if (!execute) return planSummary;
  if (authorization !== AUTHORIZATION_PHRASE) {
    return {
      ...planSummary,
      ok: false,
      blockedReasons: [...planSummary.blockedReasons, 'authorization_phrase_mismatch'],
    };
  }
  if (!plan.ok) return planSummary;
  if (!resumeIdenticalResiduals) assertTargetsAbsent(v2Root);

  const before = sourceBaseline(plan.inventory.allFiles);
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-data-v2-texts-migration-'));
  let copied = false;
  try {
    const manifest = stageMigration(plan, stageRoot);
    const stagedShape = evaluateTextsV2Shape({ v2Root: stageRoot });
    if (!stagedShape.ok) {
      throw new Error(`staged_texts_shape_failed:${JSON.stringify(shapeFailureSummary(stagedShape))}`);
    }
    if (resumeIdenticalResiduals) assertResidualsMatchStage(stageRoot, v2Root);
    copyStagedOutput(stageRoot, v2Root);
    copied = true;
    sleep(1500);
    const finalShape = evaluateTextsV2Shape({ v2Root });
    if (!finalShape.ok) {
      throw new Error(`final_texts_shape_failed:${JSON.stringify(shapeFailureSummary(finalShape))}`);
    }
    const sourceAfter = compareSourceBaseline(before, plan.inventory.allFiles);
    if (sourceAfter.changed || sourceAfter.missing) throw new Error('old_texts_source_changed');
    return {
      ok: true,
      mode: 'execute',
      entries: finalShape.totalEntries,
      kindCounts: finalShape.kindCounts,
      entryYamlFiles: finalShape.entryYamlFiles,
      contentFiles: finalShape.contentFiles,
      coverFiles: finalShape.coverFiles,
      manifestRecords: manifest.length,
      unmappedFiles: finalShape.unmappedFiles,
      sourceBaselineFiles: before.size,
      sourceChangedFiles: sourceAfter.changed,
      sourceMissingFiles: sourceAfter.missing,
      privacyRuleHits: finalShape.privacyRuleHits,
      writeScope: 'archive-data-v2-texts-only',
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
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] ArchiveData-v2 Texts migration`);
  for (const [key, value] of Object.entries(result)) {
    if (key === 'ok' || key === 'kindCounts' || key === 'blockedReasons') continue;
    console.log(`  ${key}: ${value}`);
  }
  if (result.kindCounts) console.log(`  kindCounts: ${JSON.stringify(result.kindCounts)}`);
  console.log(`  blockedReasons: ${result.blockedReasons?.length ? result.blockedReasons.join(', ') : 'none'}`);
  console.log(`Result: archive data v2 texts migration ${result.ok ? 'passed' : 'failed'}`);
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : 'unknown_error';
  return message
    .replace(/[A-Za-z]:[\\/][^\s'"]+/g, '[local-path]')
    .replace(/OneDrive/gi, '[external-data]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = runTextsMigration(args);
    printResult(result);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] ArchiveData-v2 Texts migration');
    console.log(`  error: ${safeErrorMessage(error)}`);
    console.log('Result: archive data v2 texts migration failed');
    process.exitCode = 1;
  }
}
