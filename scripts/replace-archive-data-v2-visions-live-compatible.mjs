import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildVisionsSourceInventory,
  checksumFile,
  VISIONS_SOURCE_ROOT,
} from './archive-data-v2-visions-core.mjs';
import { generateVisionsLiveCompatiblePreview } from './generate-archive-data-v2-visions-live-compatible-preview.mjs';

const AUTHORIZATION_PHRASE = 'I authorize Visions live-compatible JSON replacement';
const VISIONS_JSON = path.resolve('public', 'data', 'visions.json');
const HOME_JSON = path.resolve('public', 'data', 'home.json');

function parseArgs(args) {
  const result = { execute: false, authorization: '' };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--execute') result.execute = true;
    if (args[index] === '--authorization') result.authorization = args[index + 1] ?? '';
  }
  return result;
}

function sourceBaseline() {
  const inventory = buildVisionsSourceInventory();
  return new Map(inventory.allFiles.map(file => [
    path.relative(VISIONS_SOURCE_ROOT, file).split(path.sep).join('/'),
    checksumFile(file),
  ]));
}

function compareSource(before) {
  const inventory = buildVisionsSourceInventory();
  let changed = 0;
  let missing = 0;
  for (const file of inventory.allFiles) {
    const relative = path.relative(VISIONS_SOURCE_ROOT, file).split(path.sep).join('/');
    if (!fs.existsSync(file)) {
      missing += 1;
    } else if (before.get(relative) !== checksumFile(file)) {
      changed += 1;
    }
  }
  return { changed, missing, files: inventory.allFiles.length };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function countDifferences(left, right) {
  const differences = {};
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) {
      differences[key] = (differences[key] ?? 0) + 1;
    }
  }
  return differences;
}

function buildHomeUpdate(home, currentVisions, previewVisions) {
  const currentById = new Map(currentVisions.years.flatMap(group => group.items || []).map(item => [item.id, item]));
  const previewById = new Map(previewVisions.years.flatMap(group => group.items || []).map(item => [item.id, item]));
  const changedIds = [...previewById.keys()].filter(id => (
    JSON.stringify(currentById.get(id)) !== JSON.stringify(previewById.get(id))
  ));
  const changedIdSet = new Set(changedIds);
  let changedReferences = 0;
  const fieldDifferences = {};
  const latestVisions = (home.latestVisions || []).map(item => {
    if (!changedIdSet.has(item.id)) return item;
    const replacement = previewById.get(item.id);
    changedReferences += 1;
    const differences = countDifferences(item, replacement);
    for (const [field, count] of Object.entries(differences)) {
      fieldDifferences[field] = (fieldDifferences[field] ?? 0) + count;
    }
    return { ...item, ...replacement };
  });
  return {
    home: { ...home, latestVisions },
    changedIds,
    changedReferences,
    fieldDifferences,
  };
}

function assertGate(preview, homeUpdate) {
  const expectedFields = { cinema: 0, quote: 2, url: 2, type: 2 };
  if (
    !preview.ok
    || preview.sourceMetadataCorrectionEntries !== 2
    || preview.itemFieldDifferences !== 6
    || JSON.stringify(preview.sourceMetadataFieldCorrections) !== JSON.stringify(expectedFields)
    || preview.requiredMissing !== 0
    || preview.orderDifferences !== 0
    || preview.periodOrderDifferences !== 0
    || preview.showcaseFieldDifferences !== 0
    || preview.showcaseOrderDifferences !== 0
    || preview.privacyRuleHits !== 0
  ) throw new Error('visions_preview_gate_failed');
  if (
    homeUpdate.changedIds.length !== 2
    || homeUpdate.changedReferences !== 1
    || JSON.stringify(homeUpdate.fieldDifferences) !== JSON.stringify({ quote: 1, url: 1, type: 1 })
  ) throw new Error('home_update_gate_failed');
}

export function replaceVisionsLiveCompatible({
  execute = false,
  authorization = '',
} = {}) {
  const preview = generateVisionsLiveCompatiblePreview();
  const currentVisions = JSON.parse(fs.readFileSync(VISIONS_JSON, 'utf8'));
  const currentHome = JSON.parse(fs.readFileSync(HOME_JSON, 'utf8'));
  const homeUpdate = buildHomeUpdate(currentHome, currentVisions, preview.preview);
  assertGate(preview, homeUpdate);
  const summary = {
    ok: true,
    mode: execute ? 'execute-requested' : 'plan',
    visionsChangedEntries: homeUpdate.changedIds.length,
    visionsChangedFields: preview.itemFieldDifferences,
    homepageChangedReferences: homeUpdate.changedReferences,
    homepageChangedFields: Object.values(homeUpdate.fieldDifferences).reduce((sum, count) => sum + count, 0),
    writeScope: 'none',
    buildArchiveRun: false,
    publishRun: false,
  };
  if (!execute) return summary;
  if (authorization !== AUTHORIZATION_PHRASE) {
    return { ...summary, ok: false, blockedReason: 'authorization_phrase_mismatch' };
  }

  const sourceBefore = sourceBaseline();
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yuarchive-visions-live-backup-'));
  const visionsBefore = fs.readFileSync(VISIONS_JSON);
  const homeBefore = fs.readFileSync(HOME_JSON);
  fs.writeFileSync(path.join(backupRoot, 'visions.json'), visionsBefore);
  fs.writeFileSync(path.join(backupRoot, 'home.json'), homeBefore);
  let success = false;
  try {
    const visionsText = `${JSON.stringify(preview.preview, null, 2)}\n`;
    const homeText = `${JSON.stringify(homeUpdate.home, null, 2)}\n`;
    fs.writeFileSync(VISIONS_JSON, visionsText, 'utf8');
    fs.writeFileSync(HOME_JSON, homeText, 'utf8');
    JSON.parse(fs.readFileSync(VISIONS_JSON, 'utf8'));
    JSON.parse(fs.readFileSync(HOME_JSON, 'utf8'));
    if (sha256(fs.readFileSync(VISIONS_JSON)) !== sha256(Buffer.from(visionsText, 'utf8'))) {
      throw new Error('visions_write_verification_failed');
    }
    if (sha256(fs.readFileSync(HOME_JSON)) !== sha256(Buffer.from(homeText, 'utf8'))) {
      throw new Error('home_write_verification_failed');
    }
    const sourceAfter = compareSource(sourceBefore);
    if (sourceAfter.changed || sourceAfter.missing) throw new Error('old_visions_source_changed');
    success = true;
    return {
      ...summary,
      mode: 'execute',
      sourceFilesChecked: sourceAfter.files,
      sourceChangedFiles: sourceAfter.changed,
      sourceMissingFiles: sourceAfter.missing,
      backupCreated: true,
      backupLocation: 'system-temp/yuarchive-visions-live-backup-*',
      writeScope: 'public-data-visions-and-home-only',
    };
  } finally {
    if (!success) {
      fs.writeFileSync(VISIONS_JSON, visionsBefore);
      fs.writeFileSync(HOME_JSON, homeBefore);
    }
  }
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Visions live-compatible JSON replacement`);
  for (const [key, value] of Object.entries(result)) {
    if (key === 'ok') continue;
    console.log(`  ${key}: ${value}`);
  }
  console.log(`Result: visions live-compatible JSON replacement ${result.ok ? 'passed' : 'failed'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = replaceVisionsLiveCompatible(parseArgs(process.argv.slice(2)));
    printResult(result);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Visions live-compatible JSON replacement');
    console.log(`  error: ${error instanceof Error ? error.message : 'unknown_error'}`);
    process.exitCode = 1;
  }
}
