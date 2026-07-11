import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ARCHIVE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Archive');
const COLD_ROOT = path.join(ARCHIVE_ROOT, '_cold_storage');
const IGNORED_RELATIVE_FILES = new Set(['desktop.ini']);

function existsDir(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function existsFile(target) {
  try {
    return fs.statSync(target).isFile();
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

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function latestColdDir(prefix) {
  if (!existsDir(COLD_ROOT)) return null;
  return listDirSafe(COLD_ROOT)
    .filter(entry => entry.isDirectory() && entry.name.startsWith(prefix))
    .map(entry => entry.name)
    .sort()
    .at(-1) ?? null;
}

function verifyColdStorage({ prefix, payloadDirName, manifestFileName }) {
  const dirName = latestColdDir(prefix);
  if (!dirName) {
    return { ok: false, exists: false, files: 0, totalBytes: 0, manifestOk: false, missing: 0, mismatch: 0 };
  }
  const root = path.join(COLD_ROOT, dirName);
  const payloadRoot = path.join(root, payloadDirName);
  const manifestPath = path.join(root, manifestFileName);
  const manifest = readJsonSafe(manifestPath);
  if (!manifest || !Array.isArray(manifest.records)) {
    return { ok: false, exists: true, files: 0, totalBytes: 0, manifestOk: false, missing: 0, mismatch: 0 };
  }
  let missing = 0;
  let mismatch = 0;
  let totalBytes = 0;
  const records = manifest.records.filter(record => !IGNORED_RELATIVE_FILES.has(record.relativePath.replace(/\\/g, '/')));
  for (const record of records) {
    const target = path.join(payloadRoot, record.relativePath);
    if (!existsFile(target)) {
      missing += 1;
      continue;
    }
    const stat = fs.statSync(target);
    totalBytes += stat.size;
    if (stat.size !== record.bytes || sha256File(target) !== record.sha256) mismatch += 1;
  }
  return {
    ok: existsDir(payloadRoot) && existsFile(manifestPath) && missing === 0 && mismatch === 0,
    exists: true,
    files: records.length,
    totalBytes,
    manifestOk: true,
    missing,
    mismatch,
  };
}

export function evaluateRetiredColdStorageState() {
  const legacyData = verifyColdStorage({
    prefix: 'legacy-data-',
    payloadDirName: 'Data',
    manifestFileName: 'legacy-data-cold-storage-manifest.json',
  });
  const migration = verifyColdStorage({
    prefix: 'migration-',
    payloadDirName: 'migration',
    manifestFileName: 'migration-cold-storage-manifest.json',
  });
  return {
    ok: legacyData.ok && migration.ok,
    legacyData,
    migration,
  };
}

function main() {
  const result = evaluateRetiredColdStorageState();
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Retired cold-storage state`);
  console.log(`  legacyData: ok=${result.legacyData.ok}; exists=${result.legacyData.exists}; files=${result.legacyData.files}; missing=${result.legacyData.missing}; mismatch=${result.legacyData.mismatch}`);
  console.log(`  migration: ok=${result.migration.ok}; exists=${result.migration.exists}; files=${result.migration.files}; missing=${result.migration.missing}; mismatch=${result.migration.mismatch}`);
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
