import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARCHIVE_DATA_V2_ROOT,
  existsDir,
  existsFile,
  listDirSafe,
  parseFlatYaml,
  parseTwoLevelYaml,
  PERIOD_RULES,
} from './archive-data-v2-visions-core.mjs';
import { evaluateVisionsV2Shape } from './check-archive-data-v2-visions-shape.mjs';

const LIVE_JSON = path.resolve('public', 'data', 'visions.json');
const PRIVACY_RULES = [
  ['windows_user_path', /[A-Za-z]:[\\/]+Users[\\/]/i],
  ['onedrive_path', /OneDrive/i],
  ['legacy_source_path', /Data backup/i],
  ['credential_field', /\b(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i],
];

function readV2Ordinary(v2Root) {
  const records = [];
  for (const kind of ['movie', 'series']) {
    const root = path.join(v2Root, 'entries', 'visions', kind);
    for (const entry of listDirSafe(root).filter(item => item.isDirectory())) {
      const parsed = parseFlatYaml(path.join(root, entry.name, 'entry.yaml'));
      if (parsed.errors) throw new Error('v2_entry_yaml_parse_error');
      records.push({ ...parsed.data, id: entry.name, kind });
    }
  }
  return records;
}

function readV2Showcase(v2Root) {
  const root = path.join(v2Root, 'entries', 'visions', 'showcase');
  const entries = listDirSafe(root).filter(item => item.isDirectory());
  if (entries.length !== 1) throw new Error('expected_one_showcase');
  const showcaseRoot = path.join(root, entries[0].name);
  const showcase = parseFlatYaml(path.join(showcaseRoot, 'entry.yaml'));
  if (showcase.errors || !Array.isArray(showcase.data.character_order)) {
    throw new Error('showcase_entry_yaml_invalid');
  }
  const characters = showcase.data.character_order.map(characterId => {
    const characterRoot = path.join(showcaseRoot, 'characters', characterId);
    const parsed = parseFlatYaml(path.join(characterRoot, 'character.yaml'));
    if (parsed.errors) throw new Error('character_yaml_invalid');
    return { ...parsed.data, id: characterId };
  });
  return { ...showcase.data, id: entries[0].name, characters };
}

function scanPrivacy(value) {
  const serialized = JSON.stringify(value);
  const hits = {};
  for (const [name, rule] of PRIVACY_RULES) {
    rule.lastIndex = 0;
    if (rule.test(serialized)) hits[name] = 1;
  }
  return hits;
}

function countObjectDifferences(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let count = 0;
  for (const key of keys) {
    if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) count += 1;
  }
  return count;
}

export function generateVisionsLiveCompatiblePreview({
  v2Root = ARCHIVE_DATA_V2_ROOT,
  liveJsonPath = LIVE_JSON,
  outputRoot = path.join(os.tmpdir(), 'yuarchive-v2-visions-live-compatible-preview'),
} = {}) {
  const shape = evaluateVisionsV2Shape({ v2Root });
  if (!shape.ok) throw new Error('visions_v2_shape_failed');
  if (!existsFile(liveJsonPath)) throw new Error('live_visions_json_missing');
  const live = JSON.parse(fs.readFileSync(liveJsonPath, 'utf8'));
  const v2Entries = readV2Ordinary(v2Root);
  const v2Showcase = readV2Showcase(v2Root);
  const liveItems = (live.years || []).flatMap(group => (
    (group.items || []).map(item => ({ ...item, period: group.folder }))
  ));
  const liveByPeriodTitle = new Map(liveItems.map(item => [`${item.period}\0${item.title}`, item]));
  const v2ByPeriodTitle = new Map(v2Entries.map(item => [`${item.period}\0${item.title}`, item]));
  const missingLiveMappings = [];
  const mappedIds = new Set();
  let sourceMetadataCorrectionEntries = 0;
  const sourceMetadataFieldCorrections = { cinema: 0, quote: 0, url: 0, type: 0 };
  const generatedByPeriod = new Map();

  for (const entry of v2Entries) {
    const key = `${entry.period}\0${entry.title}`;
    const liveItem = liveByPeriodTitle.get(key);
    if (!liveItem) {
      missingLiveMappings.push(key);
      continue;
    }
    const type = entry.kind === 'series' ? 'tv' : 'movie';
    let metadataDiffers = false;
    for (const [field, expected] of [
      ['cinema', entry.cinema === true],
      ['quote', String(entry.quote ?? '')],
      ['url', String(entry.url ?? '')],
      ['type', type],
    ]) {
      if (liveItem[field] !== expected) {
        sourceMetadataFieldCorrections[field] += 1;
        metadataDiffers = true;
      }
    }
    if (metadataDiffers) sourceMetadataCorrectionEntries += 1;
    const generated = {
      id: liveItem.id,
      image_path: liveItem.image_path,
      title: entry.title,
      cinema: entry.cinema === true,
      quote: String(entry.quote ?? ''),
      url: String(entry.url ?? ''),
      type,
    };
    const records = generatedByPeriod.get(entry.period) ?? [];
    records.push(generated);
    generatedByPeriod.set(entry.period, records);
    mappedIds.add(entry.id);
  }

  const liveOrderByPeriod = new Map((live.years || []).map(group => [
    group.folder,
    new Map((group.items || []).map((item, index) => [item.title, index])),
  ]));
  for (const [period, entries] of generatedByPeriod) {
    const order = liveOrderByPeriod.get(period) ?? new Map();
    entries.sort((left, right) => (
      (order.get(left.title) ?? Number.MAX_SAFE_INTEGER)
      - (order.get(right.title) ?? Number.MAX_SAFE_INTEGER)
    ));
  }

  const liveShowcaseEntries = live.showcase?.entries ?? [];
  const liveShowcaseByTitle = new Map(liveShowcaseEntries.map(entry => [entry.title, entry]));
  const generatedShowcaseEntries = [];
  const missingShowcaseMappings = [];
  for (const character of v2Showcase.characters) {
    const liveCharacter = liveShowcaseByTitle.get(character.title);
    if (!liveCharacter) {
      missingShowcaseMappings.push(character.id);
      continue;
    }
    generatedShowcaseEntries.push({
      id: liveCharacter.id,
      title: character.title,
      caption: String(character.caption ?? ''),
      gif_path: liveCharacter.gif_path,
      avatar_path: liveCharacter.avatar_path,
    });
  }

  const periods = [...PERIOD_RULES.entries()]
    .sort((left, right) => right[1].order - left[1].order)
    .map(([period, rule]) => ({
      year: rule.syntheticYear,
      folder: period,
      items: generatedByPeriod.get(period) ?? [],
    }));
  const preview = {
    key: 'visions',
    display_name: 'Visions',
    total_count: periods.reduce((sum, group) => sum + group.items.length, 0),
    sort_mode: 'timeline',
    years: periods,
    showcase: {
      title: String(v2Showcase.title ?? ''),
      description: String(v2Showcase.description ?? ''),
      entries: generatedShowcaseEntries,
    },
  };

  const previewItems = preview.years.flatMap(group => group.items);
  const liveById = new Map((live.years || []).flatMap(group => group.items || []).map(item => [item.id, item]));
  let itemFieldDifferences = 0;
  for (const item of previewItems) {
    itemFieldDifferences += countObjectDifferences(liveById.get(item.id) ?? {}, item);
  }
  const orderDifferences = preview.years.reduce((count, group) => {
    const liveGroup = (live.years || []).find(item => item.folder === group.folder);
    return count + (JSON.stringify(liveGroup?.items?.map(item => item.id) ?? [])
      === JSON.stringify(group.items.map(item => item.id)) ? 0 : 1);
  }, 0);
  const periodOrderDifferences = JSON.stringify((live.years || []).map(group => group.folder))
    === JSON.stringify(preview.years.map(group => group.folder)) ? 0 : 1;
  const showcaseFieldDifferences = generatedShowcaseEntries.reduce((count, item) => (
    count + countObjectDifferences(liveShowcaseByTitle.get(item.title) ?? {}, item)
  ), 0);
  const showcaseOrderDifferences = JSON.stringify(liveShowcaseEntries.map(item => item.id))
    === JSON.stringify(generatedShowcaseEntries.map(item => item.id)) ? 0 : 1;
  const privacyHits = scanPrivacy(preview);
  const requiredMissing = (
    missingLiveMappings.length
    + missingShowcaseMappings.length
    + v2Entries.length - mappedIds.size
  );

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  const outputPath = path.join(outputRoot, 'visions.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');
  return {
    ok: requiredMissing === 0 && Object.keys(privacyHits).length === 0,
    outputPath,
    preview,
    v2Entries: v2Entries.length,
    liveItems: liveItems.length,
    mappedEntries: mappedIds.size,
    previewItems: previewItems.length,
    missingLiveMappings: missingLiveMappings.length,
    missingShowcaseMappings: missingShowcaseMappings.length,
    reusedLiveIds: previewItems.filter(item => liveById.has(item.id)).length,
    reusedPosterPaths: previewItems.filter(item => liveById.get(item.id)?.image_path === item.image_path).length,
    showcaseEntries: generatedShowcaseEntries.length,
    reusedShowcaseIds: generatedShowcaseEntries.filter(item => (
      liveShowcaseByTitle.get(item.title)?.id === item.id
    )).length,
    reusedShowcaseGifPaths: generatedShowcaseEntries.filter(item => (
      liveShowcaseByTitle.get(item.title)?.gif_path === item.gif_path
    )).length,
    reusedShowcaseAvatarPaths: generatedShowcaseEntries.filter(item => (
      liveShowcaseByTitle.get(item.title)?.avatar_path === item.avatar_path
    )).length,
    sourceMetadataCorrectionEntries,
    sourceMetadataFieldCorrections,
    requiredMissing,
    itemFieldDifferences,
    orderDifferences,
    periodOrderDifferences,
    showcaseFieldDifferences,
    showcaseOrderDifferences,
    privacyRuleHits: Object.keys(privacyHits).length,
    privacyRules: Object.keys(privacyHits),
    publicVisionsJsonModified: false,
    buildArchiveRun: false,
  };
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Archive Visions live-compatible preview`);
  console.log('  previewOutput: system-temp/yuarchive-v2-visions-live-compatible-preview/visions.json');
  for (const key of [
    'v2Entries', 'liveItems', 'mappedEntries', 'previewItems', 'missingLiveMappings',
    'missingShowcaseMappings', 'reusedLiveIds', 'reusedPosterPaths', 'showcaseEntries',
    'reusedShowcaseIds', 'reusedShowcaseGifPaths', 'reusedShowcaseAvatarPaths',
    'sourceMetadataCorrectionEntries', 'requiredMissing', 'itemFieldDifferences', 'orderDifferences',
    'periodOrderDifferences', 'showcaseFieldDifferences', 'showcaseOrderDifferences',
    'privacyRuleHits', 'publicVisionsJsonModified', 'buildArchiveRun',
  ]) console.log(`  ${key}: ${result[key]}`);
  console.log(`  privacyRules: ${result.privacyRules.length ? result.privacyRules.join(', ') : 'none'}`);
  console.log(`  sourceMetadataFieldCorrections: ${JSON.stringify(result.sourceMetadataFieldCorrections)}`);
  console.log(`Result: archive data v2 visions live-compatible preview ${result.ok ? 'passed' : 'failed'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = generateVisionsLiveCompatiblePreview();
    printResult(result);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Archive Visions live-compatible preview');
    console.log(`  error: ${error instanceof Error ? error.message : 'unknown_error'}`);
    process.exitCode = 1;
  }
}
