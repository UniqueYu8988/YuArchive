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

function findObjectBounds(text, id) {
  const marker = `"id": ${JSON.stringify(id)}`;
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0 || text.indexOf(marker, markerIndex + marker.length) >= 0) {
    throw new Error('entry_id_not_unique_in_json_text');
  }
  const start = text.lastIndexOf('{', markerIndex);
  if (start < 0) throw new Error('entry_object_start_missing');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1 };
    }
  }
  throw new Error('entry_object_end_missing');
}

function replaceFieldsById(text, replacements) {
  let output = text;
  for (const { id, fields } of replacements) {
    const bounds = findObjectBounds(output, id);
    let objectText = output.slice(bounds.start, bounds.end);
    for (const [field, value] of Object.entries(fields)) {
      const fieldPattern = new RegExp(
        `("${field}"\\s*:\\s*)("(?:\\\\.|[^"\\\\])*"|true|false|null|-?\\d+(?:\\.\\d+)?)`,
      );
      const matches = objectText.match(new RegExp(fieldPattern.source, 'g')) ?? [];
      if (matches.length !== 1) throw new Error(`expected_one_${field}_field`);
      objectText = objectText.replace(fieldPattern, `$1${JSON.stringify(value)}`);
    }
    output = `${output.slice(0, bounds.start)}${objectText}${output.slice(bounds.end)}`;
  }
  return output;
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
  const commonSafe = (
    preview.ok
    && preview.requiredMissing === 0
    && preview.orderDifferences === 0
    && preview.periodOrderDifferences === 0
    && preview.showcaseFieldDifferences === 0
    && preview.showcaseOrderDifferences === 0
    && preview.privacyRuleHits === 0
  );
  const replacementReady = (
    commonSafe
    && preview.sourceMetadataCorrectionEntries === 2
    && preview.itemFieldDifferences === 6
    && JSON.stringify(preview.sourceMetadataFieldCorrections) === JSON.stringify(expectedFields)
    && homeUpdate.changedIds.length === 2
    && homeUpdate.changedReferences === 1
    && JSON.stringify(homeUpdate.fieldDifferences) === JSON.stringify({ quote: 1, url: 1, type: 1 })
  );
  const alreadyCurrent = (
    commonSafe
    && preview.sourceMetadataCorrectionEntries === 0
    && preview.itemFieldDifferences === 0
    && Object.values(preview.sourceMetadataFieldCorrections).every(count => count === 0)
    && homeUpdate.changedIds.length === 0
    && homeUpdate.changedReferences === 0
    && Object.keys(homeUpdate.fieldDifferences).length === 0
  );
  if (!replacementReady && !alreadyCurrent) {
    throw new Error('visions_replacement_gate_failed');
  }
  return alreadyCurrent ? 'already-current' : 'replacement-ready';
}

export function replaceVisionsLiveCompatible({
  execute = false,
  authorization = '',
} = {}) {
  const preview = generateVisionsLiveCompatiblePreview();
  const currentVisions = JSON.parse(fs.readFileSync(VISIONS_JSON, 'utf8'));
  const currentHome = JSON.parse(fs.readFileSync(HOME_JSON, 'utf8'));
  const currentVisionsText = fs.readFileSync(VISIONS_JSON, 'utf8');
  const currentHomeText = fs.readFileSync(HOME_JSON, 'utf8');
  const homeUpdate = buildHomeUpdate(currentHome, currentVisions, preview.preview);
  const gateState = assertGate(preview, homeUpdate);
  const summary = {
    ok: true,
    mode: execute ? 'execute-requested' : 'plan',
    gateState,
    visionsChangedEntries: homeUpdate.changedIds.length,
    visionsChangedFields: preview.itemFieldDifferences,
    homepageChangedReferences: homeUpdate.changedReferences,
    homepageChangedFields: Object.values(homeUpdate.fieldDifferences).reduce((sum, count) => sum + count, 0),
    writeScope: 'none',
    buildArchiveRun: false,
    publishRun: false,
  };
  if (!execute) return summary;
  if (gateState === 'already-current') {
    return { ...summary, mode: 'already-current', writeScope: 'none' };
  }
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
    const previewById = new Map(
      preview.preview.years.flatMap(group => group.items || []).map(item => [item.id, item]),
    );
    const visionsText = replaceFieldsById(
      currentVisionsText,
      homeUpdate.changedIds.map(id => ({
        id,
        fields: {
          quote: previewById.get(id).quote,
          url: previewById.get(id).url,
          type: previewById.get(id).type,
        },
      })),
    );
    const homeChangedIds = new Set((currentHome.latestVisions || [])
      .filter(item => homeUpdate.changedIds.includes(item.id))
      .map(item => item.id));
    const homeText = replaceFieldsById(
      currentHomeText,
      [...homeChangedIds].map(id => ({
        id,
        fields: {
          quote: previewById.get(id).quote,
          url: previewById.get(id).url,
          type: previewById.get(id).type,
        },
      })),
    );
    fs.writeFileSync(VISIONS_JSON, visionsText, 'utf8');
    fs.writeFileSync(HOME_JSON, homeText, 'utf8');
    const writtenVisions = JSON.parse(fs.readFileSync(VISIONS_JSON, 'utf8'));
    const writtenHome = JSON.parse(fs.readFileSync(HOME_JSON, 'utf8'));
    if (JSON.stringify(writtenVisions) !== JSON.stringify(preview.preview)) {
      throw new Error('visions_semantic_verification_failed');
    }
    if (JSON.stringify(writtenHome) !== JSON.stringify(homeUpdate.home)) {
      throw new Error('home_semantic_verification_failed');
    }
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
