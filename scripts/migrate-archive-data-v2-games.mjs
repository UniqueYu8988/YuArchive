import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARCHIVE_DATA_V2_ROOT,
  GAMES_SOURCE_ROOT,
  checksumFile,
  existsDir,
  existsFile,
  normalizeRelative,
  scanGamesSource,
  serializeGameEntryYaml,
  serializeGamesConfigYaml,
  serializeSeasonYaml,
  sha256,
} from './archive-data-v2-games-core.mjs';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';
import { planGamesMigration } from './plan-archive-data-v2-games-migration.mjs';

const AUTHORIZATION_PHRASE = 'I authorize Archive Games migration';

function parseArgs(args) {
  const result = { execute: false, authorization: '' };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--execute') result.execute = true;
    else if (args[index] === '--authorization') {
      result.authorization = args[index + 1] ?? '';
      index += 1;
    }
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

function sourceBaseline(files) {
  return new Map(files.map(file => [file.sourceRelativePath, checksumFile(file.sourcePath)]));
}

function compareSourceBaseline(before, files) {
  let changed = 0;
  let missing = 0;
  for (const file of files) {
    if (!existsFile(file.sourcePath)) {
      missing += 1;
      continue;
    }
    if (before.get(file.sourceRelativePath) !== checksumFile(file.sourcePath)) changed += 1;
  }
  return { changed, missing };
}

function addTarget(targetsBySource, sourceRelative, target) {
  if (!sourceRelative) return;
  if (!targetsBySource.has(sourceRelative)) targetsBySource.set(sourceRelative, []);
  targetsBySource.get(sourceRelative).push(target);
}

function buildLegacyReport(scan) {
  const kinds = Object.fromEntries(['normal_game', 'dlc', 'live_game'].map(kind => [
    kind,
    scan.entries.filter(entry => entry.kind === kind).length,
  ]));
  const seasons = scan.entries.reduce((sum, entry) => sum + (entry.seasons?.length || 0), 0);
  const inferredParents = scan.entries.filter(entry => entry.kind === 'dlc' && entry.parentInferred).length;
  const metadataDisabled = scan.entries.filter(entry => !entry.metadataEnabled).length;
  return [
    '# Archive Games Legacy Field Report',
    '',
    `- Normal games: ${kinds.normal_game}`,
    `- DLC: ${kinds.dlc}`,
    `- Live games: ${kinds.live_game}`,
    `- Seasons: ${seasons}`,
    `- Metadata disabled: ${metadataDisabled}`,
    `- Inferred DLC parents: ${inferredParents}`,
    '- Steam search URLs: compatibility-only, not migrated as source facts',
    '- Live parent cover fallback: compatibility-only',
    '- Season target year: config-only',
    '- Unmapped files: 0',
    '- Full local paths: none',
    '- Old source writes: none',
    '',
  ].join('\n');
}

function stageMigration(scan, stageRoot) {
  const targetsBySource = new Map();
  for (const entry of scan.entries) {
    const entryRoot = `entries/games/${entry.kind}/${entry.id}`;
    const yamlRelative = `${entryRoot}/entry.yaml`;
    const yaml = serializeGameEntryYaml(entry);
    writeText(resolveInside(stageRoot, yamlRelative), yaml);
    if (entry.kind === 'live_game') addTarget(targetsBySource, entry.sourceRelativePath, {
      role: 'entry_yaml', relativePath: yamlRelative, sha256: sha256(Buffer.from(yaml, 'utf8')),
    });
    else if (entry.metadataEnabled) addTarget(targetsBySource, `${entry.sourceFolder}/meta.yaml`, {
      role: 'entry_yaml', relativePath: yamlRelative, sha256: sha256(Buffer.from(yaml, 'utf8')),
    });
    else addTarget(targetsBySource, entry.sourceRelativePath, {
      role: 'entry_yaml', relativePath: yamlRelative, sha256: sha256(Buffer.from(yaml, 'utf8')),
    });

    if (entry.coverPath) {
      const coverRelative = `${entryRoot}/cover${entry.coverExtension}`;
      const bytes = fs.readFileSync(entry.coverPath);
      writeBuffer(resolveInside(stageRoot, coverRelative), bytes);
      if (sha256(bytes) !== entry.coverChecksum) throw new Error('cover_checksum_mismatch');
      addTarget(targetsBySource, entry.coverRelativePath, {
        role: entry.kind === 'live_game' ? 'live_cover' : 'cover',
        relativePath: coverRelative,
        sha256: entry.coverChecksum,
      });
    }

    for (const season of entry.seasons || []) {
      const seasonRoot = `${entryRoot}/seasons/${season.id}`;
      const seasonYamlRelative = `${seasonRoot}/season.yaml`;
      const seasonYaml = serializeSeasonYaml(season);
      writeText(resolveInside(stageRoot, seasonYamlRelative), seasonYaml);
      addTarget(targetsBySource, entry.sourceRelativePath, {
        role: 'season_yaml', relativePath: seasonYamlRelative, sha256: sha256(Buffer.from(seasonYaml, 'utf8')),
      });
      addTarget(targetsBySource, season.sourceRelativePath, {
        role: 'season_yaml', relativePath: seasonYamlRelative, sha256: sha256(Buffer.from(seasonYaml, 'utf8')),
      });
      const coverRelative = `${seasonRoot}/cover${season.coverExtension}`;
      const bytes = fs.readFileSync(season.coverPath);
      writeBuffer(resolveInside(stageRoot, coverRelative), bytes);
      if (sha256(bytes) !== season.coverChecksum) throw new Error('season_cover_checksum_mismatch');
      addTarget(targetsBySource, season.sourceRelativePath, {
        role: 'season_cover', relativePath: coverRelative, sha256: season.coverChecksum,
      });
    }
  }

  const configRelative = 'config/games.yaml';
  writeText(resolveInside(stageRoot, configRelative), serializeGamesConfigYaml(scan.entries));
  const manifest = scan.sourceFiles.map(file => ({
    board: 'games',
    sourceRole: file.role,
    sourceRelative: file.sourceRelativePath,
    sourceSha256: file.sourceChecksum,
    targetRoles: targetsBySource.get(file.sourceRelativePath) || [],
    status: 'mapped',
  }));
  if (manifest.some(record => !record.targetRoles.length)) throw new Error('manifest_source_without_target');
  writeText(resolveInside(stageRoot, 'migration/games/migration-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeText(resolveInside(stageRoot, 'migration/games/unmapped-files.json'), '[]\n');
  writeText(resolveInside(stageRoot, 'migration/games/legacy-field-report.md'), buildLegacyReport(scan));
  return manifest;
}

function assertTargetsAbsent(v2Root) {
  const targets = [
    path.join(v2Root, 'entries', 'games'),
    path.join(v2Root, 'config', 'games.yaml'),
    path.join(v2Root, 'migration', 'games'),
  ];
  if (targets.some(target => existsDir(target) || existsFile(target))) throw new Error('games_v2_target_already_exists');
}

function relativeFiles(root) {
  if (!existsDir(root)) return [];
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

function copyTree(sourceRoot, targetRoot) {
  fs.mkdirSync(targetRoot, { recursive: true });
  for (const relativePath of relativeFiles(sourceRoot)) {
    const source = resolveInside(sourceRoot, relativePath);
    const target = resolveInside(targetRoot, relativePath);
    ensureParent(target);
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  }
}

function copyStagedOutput(stageRoot, v2Root) {
  copyTree(path.join(stageRoot, 'entries', 'games'), path.join(v2Root, 'entries', 'games'));
  const configTarget = path.join(v2Root, 'config', 'games.yaml');
  ensureParent(configTarget);
  fs.copyFileSync(path.join(stageRoot, 'config', 'games.yaml'), configTarget, fs.constants.COPYFILE_EXCL);
  copyTree(path.join(stageRoot, 'migration', 'games'), path.join(v2Root, 'migration', 'games'));
}

function rollbackTargets(v2Root) {
  fs.rmSync(path.join(v2Root, 'entries', 'games'), { recursive: true, force: true });
  fs.rmSync(path.join(v2Root, 'config', 'games.yaml'), { force: true });
  fs.rmSync(path.join(v2Root, 'migration', 'games'), { recursive: true, force: true });
}

function shapeSummary(shape) {
  return {
    failures: shape.failures,
    totalEntries: shape.totalEntries,
    kindCounts: shape.kindCounts,
    seasonYamlFiles: shape.seasonYamlFiles,
    invalidParentReferences: shape.invalidParentReferences,
    manifestRecords: shape.manifestRecords,
    privacyRuleHits: shape.privacyRuleHits,
  };
}

export function runGamesMigration({
  execute = false,
  authorization = '',
  v2Root = ARCHIVE_DATA_V2_ROOT,
} = {}) {
  const plan = planGamesMigration();
  const summary = {
    ok: plan.ok,
    mode: execute ? 'execute-requested' : 'plan',
    entries: plan.entries,
    kinds: plan.kinds,
    seasons: plan.seasons,
    manifestRecords: plan.sourceFiles,
    blockedReasons: [],
    executeImplemented: true,
    writeScope: 'none',
  };
  if (!execute) return summary;
  if (authorization !== AUTHORIZATION_PHRASE) {
    return { ...summary, ok: false, blockedReasons: ['authorization_phrase_mismatch'] };
  }
  if (!plan.ok) return { ...summary, ok: false, blockedReasons: ['migration_plan_failed'] };
  assertTargetsAbsent(v2Root);

  const scan = scanGamesSource();
  if (scan.errors.length) throw new Error('games_source_scan_failed');
  const before = sourceBaseline(scan.sourceFiles);
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-data-v2-games-migration-'));
  let copied = false;
  try {
    const manifest = stageMigration(scan, stageRoot);
    const stagedShape = evaluateGamesV2Shape({ v2Root: stageRoot });
    if (!stagedShape.ok) throw new Error(`staged_games_shape_failed:${JSON.stringify(shapeSummary(stagedShape))}`);
    copyStagedOutput(stageRoot, v2Root);
    copied = true;
    const finalShape = evaluateGamesV2Shape({ v2Root });
    if (!finalShape.ok) throw new Error(`final_games_shape_failed:${JSON.stringify(shapeSummary(finalShape))}`);
    const sourceAfter = compareSourceBaseline(before, scan.sourceFiles);
    if (sourceAfter.changed || sourceAfter.missing) throw new Error('old_games_source_changed');
    return {
      ok: true,
      mode: 'execute',
      entries: finalShape.totalEntries,
      kindCounts: finalShape.kindCounts,
      ordinaryCovers: finalShape.ordinaryCovers,
      liveParentCovers: finalShape.liveParentCovers,
      seasons: finalShape.seasonYamlFiles,
      manifestRecords: manifest.length,
      unmappedFiles: finalShape.unmappedFiles,
      sourceBaselineFiles: before.size,
      sourceChangedFiles: sourceAfter.changed,
      sourceMissingFiles: sourceAfter.missing,
      privacyRuleHits: finalShape.privacyRuleHits,
      writeScope: 'archive-data-v2-games-only',
      buildArchiveRun: false,
      publishRun: false,
    };
  } catch (error) {
    if (copied) rollbackTargets(v2Root);
    throw error;
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Archive Games migration`);
  for (const [key, value] of Object.entries(result)) {
    if (['ok', 'kinds', 'kindCounts', 'blockedReasons'].includes(key)) continue;
    console.log(`  ${key}: ${value}`);
  }
  if (result.kinds) console.log(`  kinds: ${JSON.stringify(result.kinds)}`);
  if (result.kindCounts) console.log(`  kindCounts: ${JSON.stringify(result.kindCounts)}`);
  console.log(`  blockedReasons: ${result.blockedReasons?.length ? result.blockedReasons.join(', ') : 'none'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  try {
    const result = runGamesMigration(options);
    printResult(result);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Archive Games migration');
    console.log(`  error: ${error.message || error}`);
    process.exitCode = 1;
  }
}
