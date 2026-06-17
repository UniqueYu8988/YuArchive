import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const DEFAULT_PAYLOAD_FILE = path.join(
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

function resolveV2Relative(relativePath) {
  normalizeRelativePath(relativePath);
  const resolved = path.join(V2_ROOT, ...relativePath.split('/'));
  assertInside(V2_ROOT, resolved);
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

async function readJson(filePath) {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
}

async function listEntryDirs() {
  if (!(await existsDir(V2_MUSIC_ROOT))) return [];
  return (await readdir(V2_MUSIC_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function buildTargetState(preview) {
  const files = [
    ['entry_yaml', preview.target.entryYaml],
    ['content_md', preview.target.contentMd],
    ['cover', preview.target.cover],
    ['audio', preview.target.audio],
  ];

  const state = [];
  for (const [role, relativePath] of files) {
    const targetPath = resolveV2Relative(relativePath);
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

async function main() {
  const payloadFile = resolveProjectJsonPath(process.argv[2] || DEFAULT_PAYLOAD_FILE);
  const payloadLabel = path.relative(PROJECT_ROOT, payloadFile).split(path.sep).join('/');
  const payload = await readJson(payloadFile);
  const preview = buildMusicAlbumPreview(payload);
  assertPreviewSafe(preview);

  const v2Exists = await existsDir(V2_ROOT);
  const v2MusicExists = await existsDir(V2_MUSIC_ROOT);
  const migrationExists = await existsDir(V2_MIGRATION_ROOT);
  const entryDirs = await listEntryDirs();
  const targetEntryDir = resolveV2Relative(preview.target.entryRelativeDir);
  const targetEntryExists = await existsDir(targetEntryDir);
  const targetState = await buildTargetState(preview);
  const diff = buildDiff(payload, preview, targetState);
  const operationCounts = countBy(diff, 'operation');
  const blocked = [
    ...preview.errors.map((error) => error.code),
    !v2Exists ? 'v2_root_missing' : null,
    !v2MusicExists ? 'v2_music_root_missing' : null,
    !migrationExists ? 'v2_migration_root_missing' : null,
    payload.mode === 'create' && targetEntryExists ? 'create_target_exists' : null,
    payload.mode === 'update' && !targetEntryExists ? 'update_target_missing' : null,
    ...diff.filter((item) => item.blocked).map((item) => `${item.role}_blocked`),
  ].filter(Boolean);

  const backupRequired = diff.some((item) => item.requiresBackup);
  const allowedToRequestWrite = blocked.length === 0;

  console.log(`[${allowedToRequestWrite ? 'PASS' : 'WARN'}] Archive Studio v0 real write gate`);
  console.log(`  payload: ${payloadLabel}`);
  console.log(`  mode: ${payload.mode}`);
  console.log(`  board: ${payload.board}`);
  console.log(`  kind: ${payload.kind}`);
  console.log(`  targetEntryId: ${preview.target.entryId}`);
  console.log(`  archiveDataV2Exists: ${v2Exists}`);
  console.log(`  musicAlbumRootExists: ${v2MusicExists}`);
  console.log(`  migrationRootExists: ${migrationExists}`);
  console.log(`  albumEntryDirs: ${entryDirs.length}`);
  console.log(`  targetEntryExists: ${targetEntryExists}`);
  console.log(`  targetFilesExisting: ${targetState.filter((item) => item.exists).length}`);
  console.log(`  operations: ${JSON.stringify(operationCounts)}`);
  console.log(`  backupRequired: ${backupRequired}`);
  console.log(`  blockedReasons: ${blocked.length ? blocked.join(', ') : 'none'}`);
  console.log(`  allowedToRequestWrite: ${allowedToRequestWrite}`);
  console.log('  writeScope: none');
  console.log(`Result: archive studio v0 real write gate ${allowedToRequestWrite ? 'passed' : 'needs review'}`);
  process.exitCode = 0;
}

await main();
