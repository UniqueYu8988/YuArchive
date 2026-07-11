import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ARCHIVE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Archive');
const LEGACY_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');
const MIGRATION_ROOT = path.join(ARCHIVE_ROOT, 'migration');
const COLD_ROOT = path.join(ARCHIVE_ROOT, '_cold_storage');
const CONFIRMATION = 'TRANSFER_LEGACY_DATA_AND_MIGRATION';

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

function createManifest(sourceRoot) {
  return walkFiles(sourceRoot).map(filePath => {
    const stat = fs.statSync(filePath);
    return {
      relativePath: path.relative(sourceRoot, filePath).replace(/\\/g, '/'),
      bytes: stat.size,
      modifiedTime: stat.mtime.toISOString(),
      sha256: sha256File(filePath),
    };
  }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function digestRecords(records) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(records.map(({ relativePath, bytes, sha256 }) => ({ relativePath, bytes, sha256 }))))
    .digest('hex');
}

function copyRecords({ sourceRoot, payloadRoot, records }) {
  for (const record of records) {
    const source = path.join(sourceRoot, record.relativePath);
    const target = path.join(payloadRoot, record.relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

function verifyRecords({ payloadRoot, records }) {
  let missing = 0;
  let mismatch = 0;
  for (const record of records) {
    const target = path.join(payloadRoot, record.relativePath);
    if (!fs.existsSync(target)) {
      missing += 1;
      continue;
    }
    const stat = fs.statSync(target);
    if (stat.size !== record.bytes || sha256File(target) !== record.sha256) mismatch += 1;
  }
  return { ok: missing === 0 && mismatch === 0, missing, mismatch };
}

function prepareUnit({ sourceRoot, targetDirName, payloadDirName, manifestFileName, sourceLabel }) {
  const records = existsDir(sourceRoot) ? createManifest(sourceRoot) : [];
  const targetRoot = path.join(COLD_ROOT, targetDirName);
  const payloadRoot = path.join(targetRoot, payloadDirName);
  const manifestPath = path.join(targetRoot, manifestFileName);
  return {
    sourceRoot,
    sourceLabel,
    targetRoot,
    payloadRoot,
    manifestPath,
    payloadDirName,
    records,
    totalBytes: records.reduce((sum, record) => sum + record.bytes, 0),
    manifestDigest: digestRecords(records),
    sourceExists: existsDir(sourceRoot),
  };
}

function writeManifest(unit) {
  fs.mkdirSync(unit.targetRoot, { recursive: true });
  fs.writeFileSync(unit.manifestPath, `${JSON.stringify({
    sourceLabel: unit.sourceLabel,
    payloadDirName: unit.payloadDirName,
    copiedAt: new Date().toISOString(),
    files: unit.records.length,
    totalBytes: unit.totalBytes,
    manifestDigest: unit.manifestDigest,
    records: unit.records,
  }, null, 2)}\n`, 'utf8');
}

function buildPlan(now = new Date()) {
  const label = timestampLabel(now);
  const legacyData = prepareUnit({
    sourceRoot: LEGACY_ROOT,
    targetDirName: `legacy-data-${label}`,
    payloadDirName: 'Data',
    manifestFileName: 'legacy-data-cold-storage-manifest.json',
    sourceLabel: '[Legacy Data]',
  });
  const migration = prepareUnit({
    sourceRoot: MIGRATION_ROOT,
    targetDirName: `migration-${label}`,
    payloadDirName: 'migration',
    manifestFileName: 'migration-cold-storage-manifest.json',
    sourceLabel: '[Archive]/migration',
  });
  return { legacyData, migration };
}

function printPlan(plan, mode) {
  console.log(`[${mode}] Retired data transfer`);
  for (const [name, unit] of Object.entries(plan)) {
    console.log(`  ${name}: sourceExists=${unit.sourceExists}; files=${unit.records.length}; totalBytes=${unit.totalBytes}`);
  }
}

function executeTransfer(plan) {
  for (const [name, unit] of Object.entries(plan)) {
    if (!unit.sourceExists || unit.records.length === 0) throw new Error(`${name} source is missing or empty`);
    if (existsDir(unit.targetRoot)) throw new Error(`${name} target already exists`);
  }
  fs.mkdirSync(COLD_ROOT, { recursive: true });
  for (const unit of Object.values(plan)) {
    copyRecords({ sourceRoot: unit.sourceRoot, payloadRoot: unit.payloadRoot, records: unit.records });
    writeManifest(unit);
  }
  const verification = Object.fromEntries(Object.entries(plan).map(([name, unit]) => [
    name,
    verifyRecords({ payloadRoot: unit.payloadRoot, records: unit.records }),
  ]));
  for (const [name, result] of Object.entries(verification)) {
    if (!result.ok) throw new Error(`${name} verification failed: missing=${result.missing}; mismatch=${result.mismatch}`);
  }
  fs.rmSync(MIGRATION_ROOT, { recursive: true, force: false });
  fs.rmSync(LEGACY_ROOT, { recursive: true, force: false });
  return verification;
}

function main() {
  const execute = process.argv.includes('--execute');
  const confirmIndex = process.argv.indexOf('--confirm');
  const confirmation = confirmIndex >= 0 ? process.argv[confirmIndex + 1] : '';
  const plan = buildPlan();
  if (!execute) {
    printPlan(plan, 'PLAN');
    console.log(`Result: pass -- add --execute --confirm ${CONFIRMATION} to transfer`);
    return;
  }
  if (confirmation !== CONFIRMATION) {
    printPlan(plan, 'BLOCKED');
    console.log('Result: blocked -- confirmation did not match');
    process.exitCode = 1;
    return;
  }
  printPlan(plan, 'EXECUTE');
  const verification = executeTransfer(plan);
  for (const [name, result] of Object.entries(verification)) {
    console.log(`  ${name} verification: ok=${result.ok}; missing=${result.missing}; mismatch=${result.mismatch}`);
  }
  console.log('Result: transferred_to_cold_storage_and_removed_active_sources');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
