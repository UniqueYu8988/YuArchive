import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARCHIVE_DATA_V2_ROOT,
  GAMES_LIVE_JSON,
  existsFile,
  listDirSafe,
  parseV2GameYaml,
} from './archive-data-v2-games-core.mjs';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';

const HOME_JSON = path.resolve('public', 'data', 'home.json');
const PRIVACY_RULES = [
  ['windows_user_path', /[A-Za-z]:[\\/]+Users[\\/]/i],
  ['onedrive_path', /OneDrive/i],
  ['legacy_source_path', /Data backup/i],
  ['credential_field', /\b(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i],
];

function assertPreviewTargetSafe(targetPath, v2Root) {
  const target = path.resolve(targetPath).toLowerCase();
  const forbidden = [
    path.resolve('public', 'data'),
    path.resolve('src', 'data'),
    path.resolve('reports'),
    path.resolve(v2Root),
  ].map(value => value.toLowerCase());
  if (forbidden.some(root => target === root || target.startsWith(`${root}${path.sep}`))) {
    throw new Error('preview_target_forbidden');
  }
}

function readV2Entries(v2Root) {
  const records = [];
  for (const kind of ['normal_game', 'dlc', 'live_game']) {
    const kindRoot = path.join(v2Root, 'entries', 'games', kind);
    for (const child of listDirSafe(kindRoot).filter(entry => entry.isDirectory())) {
      const entryRoot = path.join(kindRoot, child.name);
      const parsed = parseV2GameYaml(path.join(entryRoot, 'entry.yaml'));
      if (parsed.errors.length) throw new Error('v2_game_yaml_parse_error');
      const seasons = [];
      if (kind === 'live_game') {
        const seasonsRoot = path.join(entryRoot, 'seasons');
        for (const seasonDir of listDirSafe(seasonsRoot).filter(entry => entry.isDirectory())) {
          const seasonParsed = parseV2GameYaml(path.join(seasonsRoot, seasonDir.name, 'season.yaml'));
          if (seasonParsed.errors.length) throw new Error('v2_season_yaml_parse_error');
          seasons.push({ ...seasonParsed.data, legacy: seasonParsed.legacy });
        }
        seasons.sort((left, right) => Number(left.order) - Number(right.order) || String(left.title).localeCompare(String(right.title)));
      }
      records.push({ ...parsed.data, legacy: parsed.legacy, id: child.name, kind, seasons });
    }
  }
  return records;
}

function entryKey(entry) {
  if (entry.kind === 'live_game') return `live\0${entry.title}`;
  return `${entry.kind}\0${Number(entry.year)}\0${entry.title}`;
}

function liveItemKey(item, year) {
  if (item.seasonal) return `live\0${item.title}`;
  return `${item.dlc ? 'dlc' : 'normal_game'}\0${Number(year)}\0${item.title}`;
}

function uniqueMap(records, keyBuilder, errorCode) {
  const result = new Map();
  for (const record of records) {
    const key = keyBuilder(record);
    if (result.has(key)) throw new Error(errorCode);
    result.set(key, record);
  }
  return result;
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

function generateSeasonEntries(v2Entry, liveItem) {
  const liveSeasons = liveItem.season_entries || [];
  const liveByTitle = uniqueMap(liveSeasons, entry => entry.title, 'duplicate_live_season_title');
  const v2ByTitle = uniqueMap(v2Entry.seasons, entry => entry.title, 'duplicate_v2_season_title');
  if (liveByTitle.size !== v2ByTitle.size) throw new Error('season_count_mismatch');
  return liveSeasons.map(liveSeason => {
    const season = v2ByTitle.get(liveSeason.title);
    if (!season) throw new Error('season_mapping_missing');
    return {
      id: liveSeason.id,
      title: String(season.title),
      image_path: liveSeason.image_path,
      label: String(season.label ?? ''),
      champion: String(season.champion ?? ''),
      note: String(season.note ?? ''),
      period: String(season.period ?? ''),
      theme: String(season.theme ?? ''),
      feature: String(season.feature ?? ''),
      build: String(season.build ?? ''),
      icon_path: String(liveSeason.icon_path ?? ''),
      order: Number(season.order),
      source_year: Number(liveSeason.source_year ?? 0),
    };
  });
}

function generateItem(entry, liveItem) {
  const metadataEnabled = entry.metadata_enabled === true;
  const isLive = entry.kind === 'live_game';
  const isDlc = entry.kind === 'dlc';
  return {
    id: liveItem.id,
    image_path: liveItem.image_path,
    title: String(entry.title),
    cinema: false,
    quote: '',
    url: isLive ? '' : (metadataEnabled ? String(entry.url ?? '') : String(liveItem.url ?? '')),
    type: 'game',
    game_meta_enabled: metadataEnabled,
    english_title: metadataEnabled ? String(entry.english_title ?? '') : '',
    platform: metadataEnabled ? String(entry.platform ?? '') : String(liveItem.platform ?? 'steam'),
    price: metadataEnabled ? String(entry.price ?? '') : '',
    rating: metadataEnabled ? (entry.rating ?? '') : '',
    playtime: metadataEnabled ? String(entry.playtime ?? '') : '',
    completed: metadataEnabled ? entry.completed === true : false,
    genre: metadataEnabled ? String(entry.genre ?? '') : '',
    seasonal: isLive,
    dlc: isDlc,
    dlc_parent: isDlc ? String(entry.parent_title ?? '') : '',
    summary: metadataEnabled ? String(entry.summary ?? '') : '',
    hover_note: metadataEnabled ? String(entry.hover_note ?? '') : '',
    season_heading: isLive ? String(entry.season_heading ?? '') : '',
    season_subheading: isLive ? String(entry.season_subheading ?? '') : '',
    season_description: isLive ? String(entry.season_description ?? '') : '',
    season_entries: isLive ? generateSeasonEntries(entry, liveItem) : [],
  };
}

export function generateGamesLiveCompatiblePreview({
  v2Root = ARCHIVE_DATA_V2_ROOT,
  liveJsonPath = GAMES_LIVE_JSON,
  homeJsonPath = HOME_JSON,
  outputRoot = path.join(os.tmpdir(), 'yuarchive-v2-games-live-compatible-preview'),
} = {}) {
  assertPreviewTargetSafe(outputRoot, v2Root);
  const shape = evaluateGamesV2Shape({ v2Root });
  if (!shape.ok) throw new Error('games_v2_shape_failed');
  if (!existsFile(liveJsonPath) || !existsFile(homeJsonPath)) throw new Error('live_json_missing');
  const live = JSON.parse(fs.readFileSync(liveJsonPath, 'utf8'));
  const home = JSON.parse(fs.readFileSync(homeJsonPath, 'utf8'));
  const v2Entries = readV2Entries(v2Root);
  const v2ByKey = uniqueMap(v2Entries, entryKey, 'duplicate_v2_mapping_key');
  const usedV2Ids = new Set();
  const generatedYears = [];
  let seasonMappings = 0;

  for (const group of live.years || []) {
    const items = [];
    for (const liveItem of group.items || []) {
      const key = liveItemKey(liveItem, group.year);
      const entry = v2ByKey.get(key);
      if (!entry) throw new Error('live_item_mapping_missing');
      usedV2Ids.add(entry.id);
      const generated = generateItem(entry, liveItem);
      seasonMappings += generated.season_entries.length;
      items.push(generated);
    }
    generatedYears.push({ year: group.year, folder: group.folder, items });
  }
  const preview = {
    key: 'games',
    display_name: 'Games',
    total_count: generatedYears.reduce((sum, group) => sum + group.items.length, 0),
    sort_mode: 'timeline',
    years: generatedYears,
  };
  const previewItems = preview.years.flatMap(group => group.items);
  const liveItems = (live.years || []).flatMap(group => group.items || []);
  const previewById = new Map(previewItems.map(item => [item.id, item]));
  const liveById = new Map(liveItems.map(item => [item.id, item]));
  let itemFieldDifferences = 0;
  for (const item of previewItems) itemFieldDifferences += countObjectDifferences(liveById.get(item.id) ?? {}, item);
  const yearOrderDifferences = JSON.stringify((live.years || []).map(group => group.year))
    === JSON.stringify(preview.years.map(group => group.year)) ? 0 : 1;
  const itemOrderDifferences = preview.years.reduce((count, group) => {
    const liveGroup = (live.years || []).find(candidate => Number(candidate.year) === Number(group.year));
    return count + (JSON.stringify(liveGroup?.items?.map(item => item.id) ?? [])
      === JSON.stringify(group.items.map(item => item.id)) ? 0 : 1);
  }, 0);
  const mediaPathDifferences = previewItems.filter(item => liveById.get(item.id)?.image_path !== item.image_path).length
    + previewItems.reduce((sum, item) => {
      const liveSeasons = new Map((liveById.get(item.id)?.season_entries || []).map(season => [season.id, season]));
      return sum + item.season_entries.filter(season => liveSeasons.get(season.id)?.image_path !== season.image_path).length;
    }, 0);
  let homeFieldDifferences = 0;
  let homeMissingMappings = 0;
  for (const item of home.latestGames || []) {
    const generated = previewById.get(item.id);
    if (!generated) homeMissingMappings += 1;
    else homeFieldDifferences += countObjectDifferences(item, generated);
  }
  const privacyHits = scanPrivacy(preview);
  const requiredMissing = v2Entries.length - usedV2Ids.size + homeMissingMappings;

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  const outputPath = path.join(outputRoot, 'games.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');
  return {
    ok: requiredMissing === 0 && Object.keys(privacyHits).length === 0,
    outputPath,
    preview,
    v2Entries: v2Entries.length,
    liveItems: liveItems.length,
    mappedEntries: usedV2Ids.size,
    previewItems: previewItems.length,
    seasonMappings,
    requiredMissing,
    reusedLiveIds: previewItems.filter(item => liveById.has(item.id)).length,
    reusedTopLevelMediaPaths: previewItems.filter(item => liveById.get(item.id)?.image_path === item.image_path).length,
    reusedSeasonMediaPaths: seasonMappings - mediaPathDifferences,
    itemFieldDifferences,
    yearOrderDifferences,
    itemOrderDifferences,
    mediaPathDifferences,
    homeItems: (home.latestGames || []).length,
    homeMissingMappings,
    homeFieldDifferences,
    privacyRuleHits: Object.keys(privacyHits).length,
    privacyRules: Object.keys(privacyHits),
    publicGamesJsonModified: false,
    publicHomeJsonModified: false,
    buildArchiveRun: false,
  };
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] ArchiveData-v2 Games live-compatible preview`);
  console.log('  previewOutput: system-temp/yuarchive-v2-games-live-compatible-preview/games.json');
  for (const key of [
    'v2Entries', 'liveItems', 'mappedEntries', 'previewItems', 'seasonMappings',
    'requiredMissing', 'reusedLiveIds', 'reusedTopLevelMediaPaths',
    'reusedSeasonMediaPaths', 'itemFieldDifferences', 'yearOrderDifferences',
    'itemOrderDifferences', 'mediaPathDifferences', 'homeItems', 'homeMissingMappings',
    'homeFieldDifferences', 'privacyRuleHits', 'publicGamesJsonModified',
    'publicHomeJsonModified', 'buildArchiveRun',
  ]) console.log(`  ${key}: ${result[key]}`);
  console.log(`  privacyRules: ${result.privacyRules.length ? result.privacyRules.join(', ') : 'none'}`);
  console.log(`Result: archive data v2 games live-compatible preview ${result.ok ? 'passed' : 'failed'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = generateGamesLiveCompatiblePreview();
    printResult(result);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] ArchiveData-v2 Games live-compatible preview');
    console.log(`  error: ${error.message || error}`);
    process.exitCode = 1;
  }
}
