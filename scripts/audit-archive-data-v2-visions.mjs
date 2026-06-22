import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data', 'Visions');
const LIVE_JSON = path.resolve('public', 'data', 'visions.json');
const SHOWCASE_FOLDER = '角色橱窗';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
const PERIOD_YEARS = new Map([
  ['此岸', 2026],
  ['未远', 2025],
  ['旧影', 2023],
  ['前尘', 2020],
  ['开端', 2017],
]);

function unquote(value) {
  const text = String(value ?? '').trim();
  if (
    (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("'") && text.endsWith("'"))
  ) return text.slice(1, -1);
  return text;
}

function parseScalar(value) {
  const text = unquote(value);
  if (/^(true|yes)$/i.test(text)) return true;
  if (/^(false|no)$/i.test(text)) return false;
  return text;
}

function parseTwoLevelYaml(filePath) {
  const data = {};
  const errors = [];
  let currentKey = null;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const indent = rawLine.length - rawLine.trimStart().length;
    const colon = trimmed.indexOf(':');
    if (colon < 0) {
      errors.push({ line: index + 1, reason: 'missing_colon' });
      return;
    }
    const key = unquote(trimmed.slice(0, colon));
    const value = trimmed.slice(colon + 1).trim();
    if (indent === 0) {
      currentKey = key;
      data[key] = value ? parseScalar(value) : {};
      return;
    }
    if (!currentKey || typeof data[currentKey] !== 'object' || Array.isArray(data[currentKey])) {
      errors.push({ line: index + 1, reason: 'nested_field_without_entry' });
      return;
    }
    data[currentKey][key.toLowerCase()] = parseScalar(value);
  });
  return { data, errors };
}

function listDirectories(root) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(root, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function listImages(root) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map(entry => path.join(root, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function increment(record, key, amount = 1) {
  record[key] = (record[key] || 0) + amount;
}

function summarizeOrdinaryGroup(groupDir) {
  const metaPath = path.join(groupDir, 'meta.yaml');
  const images = listImages(groupDir);
  const parsed = parseTwoLevelYaml(metaPath);
  const entries = Object.entries(parsed.data)
    .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value));
  const imageStems = new Set(images.map(file => path.basename(file, path.extname(file)).trim()));
  const metaTitles = new Set(entries.map(([title]) => title.trim()));
  const fields = {};
  const types = {};
  const cinema = {};
  let quotePresent = 0;
  let urlPresent = 0;
  for (const [, value] of entries) {
    Object.keys(value).forEach(field => increment(fields, field));
    increment(types, String(value.type || '(missing)'));
    increment(cinema, String(value.cinema ?? '(missing)'));
    if (value.quote) quotePresent += 1;
    if (value.url) urlPresent += 1;
  }
  return {
    group: path.basename(groupDir),
    images: images.length,
    metadataEntries: entries.length,
    matchedEntries: [...metaTitles].filter(title => imageStems.has(title)).length,
    orphanMetadata: [...metaTitles].filter(title => !imageStems.has(title)).length,
    imagesWithoutMetadata: [...imageStems].filter(title => !metaTitles.has(title)).length,
    parserErrors: parsed.errors.length,
    fields,
    types,
    cinema,
    quotePresent,
    urlPresent,
    entries,
  };
}

function summarizeShowcase(groupDir) {
  const parsed = parseTwoLevelYaml(path.join(groupDir, 'meta.yaml'));
  const images = listImages(groupDir);
  const entries = Object.entries(parsed.data)
    .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value));
  const fields = {};
  const extensions = {};
  let explicitGif = 0;
  let explicitAvatar = 0;
  let missingGif = 0;
  let missingAvatar = 0;
  for (const [, value] of entries) {
    Object.keys(value).forEach(field => increment(fields, field));
    for (const [role, counter] of [['gif', 'gif'], ['avatar', 'avatar']]) {
      if (!value[role]) continue;
      if (counter === 'gif') explicitGif += 1;
      else explicitAvatar += 1;
      if (!fs.existsSync(path.join(groupDir, String(value[role])))) {
        if (counter === 'gif') missingGif += 1;
        else missingAvatar += 1;
      }
    }
  }
  images.forEach(file => increment(extensions, path.extname(file).toLowerCase()));
  return {
    entries: entries.length,
    mediaFiles: images.length,
    parserErrors: parsed.errors.length,
    fields,
    extensions,
    explicitGif,
    explicitAvatar,
    missingGif,
    missingAvatar,
    topLevelScalarFields: Object.entries(parsed.data)
      .filter(([, value]) => typeof value !== 'object' || value === null)
      .map(([key]) => key)
      .sort(),
  };
}

export function auditVisions() {
  if (!fs.existsSync(SOURCE_ROOT)) throw new Error('visions_source_missing');
  if (!fs.existsSync(LIVE_JSON)) throw new Error('visions_live_json_missing');

  const directories = listDirectories(SOURCE_ROOT);
  const ordinary = directories
    .filter(directory => path.basename(directory) !== SHOWCASE_FOLDER)
    .map(summarizeOrdinaryGroup);
  const showcaseDir = directories.find(directory => path.basename(directory) === SHOWCASE_FOLDER);
  const showcase = showcaseDir ? summarizeShowcase(showcaseDir) : null;
  const live = JSON.parse(fs.readFileSync(LIVE_JSON, 'utf8'));
  const liveItems = (live.years || []).flatMap(year => (
    (year.items || []).map(item => ({ ...item, group: year.folder, year: year.year }))
  ));
  const liveByGroupTitle = new Map(liveItems.map(item => [`${item.group}\0${item.title}`, item]));
  const titleGroups = new Map();
  const sourceTypeCounts = {};
  let groupAwareTypeDifferences = 0;
  for (const group of ordinary) {
    for (const [title, metadata] of group.entries) {
      if (!titleGroups.has(title)) titleGroups.set(title, new Set());
      titleGroups.get(title).add(group.group);
      increment(sourceTypeCounts, String(metadata.type || 'movie'));
      const liveItem = liveByGroupTitle.get(`${group.group}\0${title}`);
      if (!liveItem || String(metadata.type || 'movie') !== String(liveItem.type)) {
        groupAwareTypeDifferences += 1;
      }
    }
  }
  const duplicateTitlesAcrossGroups = [...titleGroups.values()].filter(groups => groups.size > 1).length;
  const liveTypeCounts = {};
  const liveFields = {};
  liveItems.forEach(item => {
    increment(liveTypeCounts, String(item.type || '(missing)'));
    Object.keys(item).forEach(field => increment(liveFields, field));
  });
  const nonPositionalLiveIds = liveItems.filter(item => (
    !/^(movie|tv)_\d{4}(?:\.0)?_\d+$/.test(String(item.id))
  )).length;
  const periodYearMismatches = (live.years || []).filter(group => (
    PERIOD_YEARS.has(group.folder) && PERIOD_YEARS.get(group.folder) !== Number(group.year)
  )).length;
  const result = {
    source: {
      ordinaryGroups: ordinary.length,
      ordinaryImages: ordinary.reduce((sum, group) => sum + group.images, 0),
      metadataEntries: ordinary.reduce((sum, group) => sum + group.metadataEntries, 0),
      matchedEntries: ordinary.reduce((sum, group) => sum + group.matchedEntries, 0),
      orphanMetadata: ordinary.reduce((sum, group) => sum + group.orphanMetadata, 0),
      imagesWithoutMetadata: ordinary.reduce((sum, group) => sum + group.imagesWithoutMetadata, 0),
      parserErrors: ordinary.reduce((sum, group) => sum + group.parserErrors, 0),
      sourceTypeCounts,
      duplicateTitlesAcrossGroups,
      showcase,
    },
    live: {
      totalCount: Number(live.total_count || 0),
      itemCount: liveItems.length,
      groupCount: (live.years || []).length,
      liveTypeCounts,
      itemFieldCounts: liveFields,
      uniqueIds: new Set(liveItems.map(item => item.id)).size,
      positionalIdPatternCount: liveItems.length - nonPositionalLiveIds,
      periodYearMismatches,
      showcaseEntries: live.showcase?.entries?.length || 0,
    },
    risks: {
      groupAwareTypeDifferences,
      duplicateTitlesAcrossGroups,
      legacyGlobalTitleCollisionRisk: duplicateTitlesAcrossGroups,
      expectedMetadataFieldDifferences: {
        cinema: 0,
        quote: duplicateTitlesAcrossGroups,
        url: duplicateTitlesAcrossGroups,
        type: groupAwareTypeDifferences,
      },
      expectedMetadataFieldDifferenceTotal: (
        duplicateTitlesAcrossGroups * 2 + groupAwareTypeDifferences
      ),
      positionalIdsAreStable: false,
      syntheticYearsRepresentPeriods: true,
    },
  };
  return result;
}

function printSummary(result) {
  const pass = (
    result.source.parserErrors === 0
    && result.source.orphanMetadata === 0
    && result.source.imagesWithoutMetadata === 0
    && result.source.showcase
    && result.source.showcase.missingGif === 0
    && result.source.showcase.missingAvatar === 0
  );
  console.log(`[${pass ? 'PASS' : 'WARN'}] Archive Visions read-only audit`);
  console.log(`  ordinaryGroups: ${result.source.ordinaryGroups}`);
  console.log(`  ordinaryImages: ${result.source.ordinaryImages}`);
  console.log(`  metadataEntries: ${result.source.metadataEntries}`);
  console.log(`  matchedEntries: ${result.source.matchedEntries}`);
  console.log(`  orphanMetadata: ${result.source.orphanMetadata}`);
  console.log(`  imagesWithoutMetadata: ${result.source.imagesWithoutMetadata}`);
  console.log(`  parserErrors: ${result.source.parserErrors}`);
  console.log(`  sourceTypeCounts: ${JSON.stringify(result.source.sourceTypeCounts)}`);
  console.log(`  liveTypeCounts: ${JSON.stringify(result.live.liveTypeCounts)}`);
  console.log(`  groupAwareTypeDifferences: ${result.risks.groupAwareTypeDifferences}`);
  console.log(`  metadataFieldDifferences: ${JSON.stringify(result.risks.expectedMetadataFieldDifferences)}`);
  console.log(`  metadataFieldDifferenceTotal: ${result.risks.expectedMetadataFieldDifferenceTotal}`);
  console.log(`  duplicateTitlesAcrossGroups: ${result.risks.duplicateTitlesAcrossGroups}`);
  console.log(`  positionalLiveIds: ${result.live.positionalIdPatternCount}`);
  console.log(`  periodYearMismatches: ${result.live.periodYearMismatches}`);
  console.log(`  showcaseEntries: ${result.source.showcase?.entries || 0}`);
  console.log(`  showcaseMediaFiles: ${result.source.showcase?.mediaFiles || 0}`);
  console.log(`  showcaseMissingAssetRefs: ${(result.source.showcase?.missingGif || 0) + (result.source.showcase?.missingAvatar || 0)}`);
  console.log('  writeActions: 0');
  console.log(`Result: Visions audit ${pass ? 'passed with migration risks recorded' : 'needs review'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = auditVisions();
  printSummary(result);
}
