import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertPreviewSafe,
  buildMusicAlbumPreview,
  normalizeRelativePath,
} from './archive-studio-v0-music-preview-core.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');
const V2_ROOT = path.join(path.dirname(SOURCE_ROOT), 'ArchiveData-v2');
const V2_MUSIC_ROOT = path.join(V2_ROOT, 'entries', 'music', 'album');
const V2_MIGRATION_ROOT = path.join(V2_ROOT, 'migration');
export const DEFAULT_PAYLOAD_FILE = path.join(
  PROJECT_ROOT,
  'docs',
  'examples',
  'archive-studio-v0-music-album-payload.sample.json',
);

function resolveProjectJsonPath(inputPath = DEFAULT_PAYLOAD_FILE) {
  const resolved = path.resolve(PROJECT_ROOT, inputPath);
  const relative = path.relative(PROJECT_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Payload file must be inside the project directory');
  }
  if (!relative.endsWith('.json')) {
    throw new Error('Payload file must be a JSON file');
  }
  return resolved;
}

function assertInside(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Resolved v2 target escaped the allowed root');
  }
}

function resolveV2Relative(relativePath, v2Root = V2_ROOT) {
  normalizeRelativePath(relativePath);
  const resolved = path.join(v2Root, ...relativePath.split('/'));
  assertInside(v2Root, resolved);
  return resolved;
}

async function fileInfo(filePath) {
  if (!existsSync(filePath)) return null;
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) return null;
  const buffer = await readFile(filePath);
  return {
    bytes: buffer.byteLength,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

async function existsDir(dirPath) {
  try {
    return (await stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
}

async function listEntryDirs(v2MusicRoot = V2_MUSIC_ROOT) {
  if (!(await existsDir(v2MusicRoot))) return [];
  return (await readdir(v2MusicRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function buildTargetState(preview, v2Root = V2_ROOT) {
  const files = [
    ['entry_yaml', preview.target.entryYaml],
    ['content_md', preview.target.contentMd],
    ['cover', preview.target.cover],
    ['audio', preview.target.audio],
  ];

  const state = [];
  for (const [role, relativePath] of files) {
    const targetPath = resolveV2Relative(relativePath, v2Root);
    const info = await fileInfo(targetPath);
    state.push({
      role,
      relativePath,
      exists: Boolean(info),
      bytes: info?.bytes || 0,
      sha256Present: Boolean(info?.sha256),
    });
  }
  return state;
}

function buildDiff(payload, preview, targetState) {
  return targetState.map((item) => {
    const willOverwrite = payload.mode === 'update' && item.exists;
    const blocked = payload.mode === 'create' && item.exists;
    return {
      role: item.role,
      relativePath: item.relativePath,
      exists: item.exists,
      operation: blocked ? 'blocked' : willOverwrite ? 'overwrite' : item.exists ? 'keep' : 'create',
      willOverwrite,
      requiresBackup: willOverwrite,
      blocked,
    };
  });
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] || 0) + 1;
  return counts;
}

export async function evaluateGate(payload, payloadLabel = 'inline-payload', {
  v2Root = V2_ROOT,
  requireMigrationRoot = true,
} = {}) {
  const preview = buildMusicAlbumPreview(payload);
  assertPreviewSafe(preview);

  const v2MusicRoot = path.join(v2Root, 'entries', 'music', 'album');
  const v2MigrationRoot = path.join(v2Root, 'migration');
  const v2Exists = await existsDir(v2Root);
  const v2MusicExists = await existsDir(v2MusicRoot);
  const migrationExists = await existsDir(v2MigrationRoot);
  const entryDirs = await listEntryDirs(v2MusicRoot);
  const targetEntryDir = resolveV2Relative(preview.target.entryRelativeDir, v2Root);
  const targetEntryExists = await existsDir(targetEntryDir);
  const targetState = await buildTargetState(preview, v2Root);
  const diff = buildDiff(payload, preview, targetState);
  const operationCounts = countBy(diff, 'operation');
  const blocked = [
    ...preview.errors.map((error) => error.code),
    !v2Exists ? 'v2_root_missing' : null,
    !v2MusicExists ? 'v2_music_root_missing' : null,
    requireMigrationRoot && !migrationExists ? 'v2_migration_root_missing' : null,
    payload.mode === 'create' && targetEntryExists ? 'create_target_exists' : null,
    payload.mode === 'update' && !targetEntryExists ? 'update_target_missing' : null,
    ...diff.filter((item) => item.blocked).map((item) => `${item.role}_blocked`),
  ].filter(Boolean);

  const backupRequired = diff.some((item) => item.requiresBackup);
  const allowedToRequestWrite = blocked.length === 0;

  return {
    payloadLabel,
    mode: payload.mode,
    board: payload.board,
    kind: payload.kind,
    targetEntryId: preview.target.entryId,
    target: preview.target,
    archiveDataV2Exists: v2Exists,
    musicAlbumRootExists: v2MusicExists,
    migrationRootExists: migrationExists,
    albumEntryDirs: entryDirs.length,
    targetEntryExists,
    targetFilesExisting: targetState.filter((item) => item.exists).length,
    operations: operationCounts,
    diff,
    backupRequired,
    blockedReasons: blocked,
    allowedToRequestWrite,
  };
}

export async function evaluateGateFromProjectJson(inputPath = DEFAULT_PAYLOAD_FILE) {
  const payloadFile = resolveProjectJsonPath(inputPath);
  const payloadLabel = path.relative(PROJECT_ROOT, payloadFile).split(path.sep).join('/');
  const payload = await readJson(payloadFile);
  return evaluateGate(payload, payloadLabel);
}

function printGateResult(result) {
  console.log(`[${result.allowedToRequestWrite ? 'PASS' : 'WARN'}] Archive Studio v0 real write gate`);
  console.log(`  payload: ${result.payloadLabel}`);
  console.log(`  mode: ${result.mode}`);
  console.log(`  board: ${result.board}`);
  console.log(`  kind: ${result.kind}`);
  console.log(`  targetEntryId: ${result.targetEntryId}`);
  console.log(`  archiveDataV2Exists: ${result.archiveDataV2Exists}`);
  console.log(`  musicAlbumRootExists: ${result.musicAlbumRootExists}`);
  console.log(`  migrationRootExists: ${result.migrationRootExists}`);
  console.log(`  albumEntryDirs: ${result.albumEntryDirs}`);
  console.log(`  targetEntryExists: ${result.targetEntryExists}`);
  console.log(`  targetFilesExisting: ${result.targetFilesExisting}`);
  console.log(`  operations: ${JSON.stringify(result.operations)}`);
  console.log(`  backupRequired: ${result.backupRequired}`);
  console.log(`  blockedReasons: ${result.blockedReasons.length ? result.blockedReasons.join(', ') : 'none'}`);
  console.log(`  allowedToRequestWrite: ${result.allowedToRequestWrite}`);
  console.log('  writeScope: none');
  console.log(`Result: archive studio v0 real write gate ${result.allowedToRequestWrite ? 'passed' : 'needs review'}`);
}

async function main() {
  const result = await evaluateGateFromProjectJson(process.argv[2] || DEFAULT_PAYLOAD_FILE);
  printGateResult(result);
  process.exitCode = 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
