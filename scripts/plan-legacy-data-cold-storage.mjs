import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const LEGACY_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');

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

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function toRelative(filePath) {
  return path.relative(LEGACY_ROOT, filePath).replace(/\\/g, '/');
}

function timestampLabel(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

export function buildLegacyDataColdStoragePlan({ now = new Date() } = {}) {
  const exists = existsDir(LEGACY_ROOT);
  const files = exists ? walkFiles(LEGACY_ROOT) : [];
  const records = files.map(filePath => {
    const stat = fs.statSync(filePath);
    return {
      relativePath: toRelative(filePath),
      bytes: stat.size,
      modifiedTime: stat.mtime.toISOString(),
      sha256: sha256File(filePath),
    };
  }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);
  const latestModifiedTime = records
    .map(record => record.modifiedTime)
    .sort()
    .at(-1) ?? null;
  const topLevelEntries = exists
    ? listDirSafe(LEGACY_ROOT).map(entry => `${entry.isDirectory() ? 'dir' : 'file'}:${entry.name}`).sort()
    : [];
  const manifestDigest = crypto.createHash('sha256')
    .update(JSON.stringify(records.map(({ relativePath, bytes, sha256 }) => ({ relativePath, bytes, sha256 }))))
    .digest('hex');
  const targetLabel = `legacy-data-${timestampLabel(now)}`;
  return {
    ok: exists,
    exists,
    sourceLabel: '[Legacy Data]',
    recommendedMode: 'copy-only-first',
    targetLabel: `[Archive]/_cold_storage/${targetLabel}`,
    files: records.length,
    totalBytes,
    latestModifiedTime,
    topLevelEntries,
    manifestDigest,
    deletionRecommendedNow: false,
    nextStep: exists && records.length
      ? 'copy_to_cold_storage_then_verify_before_any_delete'
      : 'nothing_to_copy',
  };
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Legacy Data cold-storage dry-run`);
  console.log(`  exists: ${result.exists}`);
  console.log(`  source: ${result.sourceLabel}`);
  console.log(`  targetLabel: ${result.targetLabel}`);
  console.log(`  recommendedMode: ${result.recommendedMode}`);
  console.log(`  files: ${result.files}`);
  console.log(`  totalBytes: ${result.totalBytes}`);
  console.log(`  latestModifiedTime: ${result.latestModifiedTime ?? 'none'}`);
  console.log(`  topLevelEntries: ${result.topLevelEntries.length ? result.topLevelEntries.join(', ') : 'none'}`);
  console.log(`  manifestDigest: ${result.manifestDigest}`);
  console.log(`  deletionRecommendedNow: ${result.deletionRecommendedNow}`);
  console.log(`Result: ${result.nextStep}`);
}

function main() {
  const result = buildLegacyDataColdStoragePlan();
  printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
