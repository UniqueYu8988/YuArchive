import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data', 'Games');
const LIVE_JSON = path.resolve('public', 'data', 'games.json');
const HOME_JSON = path.resolve('public', 'data', 'home.json');
const BUILD_SCRIPT = path.resolve('build_archive.py');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
const YEAR_FOLDER_PATTERN = /^Game-(\d{4})$/;
const SEASON_PREFIXES = new Map([
  ['TFT_', 'live_game_1'],
  ['LOL_', 'live_game_2'],
  ['D4_', 'live_game_3'],
]);

function unquote(value) {
  const text = String(value ?? '').trim();
  if (
    (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("'") && text.endsWith("'"))
  ) return text.slice(1, -1);
  return text;
}

function listFiles(root, predicate = () => true) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.join(root, entry.name))
    .filter(predicate)
    .sort((left, right) => left.localeCompare(right));
}

function listImages(root) {
  return listFiles(root, file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
}

function increment(record, key, amount = 1) {
  record[key] = (record[key] || 0) + amount;
}

function parseFolderMeta(filePath) {
  const entries = new Map();
  const errors = [];
  let currentTitle = null;
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const indent = rawLine.length - rawLine.trimStart().length;
    const colon = trimmed.indexOf(':');
    if (colon < 0) {
      errors.push({ line: index + 1, reason: 'missing_colon' });
      return;
    }
    const key = unquote(trimmed.slice(0, colon));
    const value = unquote(trimmed.slice(colon + 1));
    if (indent === 0 && !value) {
      currentTitle = key;
      entries.set(currentTitle, {});
      return;
    }
    if (indent === 2 && currentTitle) {
      entries.get(currentTitle)[key.toLowerCase()] = value;
      return;
    }
    errors.push({ line: index + 1, reason: 'unsupported_shape' });
  });
  return { entries, errors };
}

function parseLiveMeta(filePath) {
  const scalarFields = {};
  const seasonFields = {};
  const seasonTitles = [];
  const errors = [];
  let inSeasons = false;
  let currentSeason = null;
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const indent = rawLine.length - rawLine.trimStart().length;
    const colon = trimmed.indexOf(':');
    if (colon < 0) {
      errors.push({ line: index + 1, reason: 'missing_colon' });
      return;
    }
    const key = unquote(trimmed.slice(0, colon));
    const value = unquote(trimmed.slice(colon + 1));
    if (indent === 0 && key === 'season_entries' && !value) {
      inSeasons = true;
      currentSeason = null;
      return;
    }
    if (indent === 0) {
      inSeasons = false;
      currentSeason = null;
      scalarFields[key.toLowerCase()] = value;
      return;
    }
    if (inSeasons && indent === 2 && !value) {
      currentSeason = key;
      seasonTitles.push(key);
      return;
    }
    if (inSeasons && indent >= 4 && currentSeason) {
      increment(seasonFields, key.toLowerCase());
      return;
    }
    errors.push({ line: index + 1, reason: 'unsupported_shape' });
  });
  return { scalarFields, seasonFields, seasonTitles, errors };
}

function countNonEmpty(entries, field) {
  let count = 0;
  for (const value of entries.values()) {
    if (String(value[field] ?? '').trim()) count += 1;
  }
  return count;
}

export function auditGames() {
  if (!fs.existsSync(SOURCE_ROOT)) throw new Error('games_source_missing');
  if (!fs.existsSync(LIVE_JSON)) throw new Error('games_live_json_missing');
  if (!fs.existsSync(HOME_JSON)) throw new Error('home_live_json_missing');

  const directories = fs.readdirSync(SOURCE_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(SOURCE_ROOT, entry.name));
  const yearDirectories = directories.filter(directory => YEAR_FOLDER_PATTERN.test(path.basename(directory)));
  const yearGroups = [];
  const metadataFields = {};
  let metadataEntries = 0;
  let metadataParserErrors = 0;
  let managedImagesWithoutMetadata = 0;
  let orphanMetadata = 0;
  let dlcFilenameCandidates = 0;
  let explicitDlcParents = 0;
  let displayTitleOverrides = 0;

  for (const directory of yearDirectories) {
    const images = listImages(directory);
    const imageStems = new Set(images.map(file => path.basename(file, path.extname(file)).trim()));
    const metaPath = path.join(directory, 'meta.yaml');
    const hasMeta = fs.existsSync(metaPath);
    let entries = new Map();
    let parserErrors = 0;
    if (hasMeta) {
      const parsed = parseFolderMeta(metaPath);
      entries = parsed.entries;
      parserErrors = parsed.errors.length;
      metadataParserErrors += parserErrors;
      metadataEntries += entries.size;
      for (const value of entries.values()) {
        Object.keys(value).forEach(field => increment(metadataFields, field));
      }
      managedImagesWithoutMetadata += [...imageStems].filter(stem => !entries.has(stem)).length;
      orphanMetadata += [...entries.keys()].filter(title => !imageStems.has(title)).length;
      explicitDlcParents += countNonEmpty(entries, 'dlc_parent_title');
      displayTitleOverrides += countNonEmpty(entries, 'display_title');
    }
    const dlcCandidates = images.filter(file => path.basename(file, path.extname(file)).includes('_')).length;
    dlcFilenameCandidates += dlcCandidates;
    yearGroups.push({
      year: Number(path.basename(directory).match(YEAR_FOLDER_PATTERN)[1]),
      images: images.length,
      hasMeta,
      metadataEntries: entries.size,
      parserErrors,
      dlcCandidates,
    });
  }

  const liveRoot = path.join(SOURCE_ROOT, 'Game-Live');
  const liveImages = listImages(liveRoot);
  const liveYamlFiles = listFiles(liveRoot, file => path.extname(file).toLowerCase() === '.yaml');
  const liveScalarFields = {};
  const seasonChildFields = {};
  const seasonTitles = [];
  let liveParserErrors = 0;
  for (const file of liveYamlFiles) {
    const parsed = parseLiveMeta(file);
    liveParserErrors += parsed.errors.length;
    Object.keys(parsed.scalarFields).forEach(field => increment(liveScalarFields, field));
    Object.entries(parsed.seasonFields).forEach(([field, count]) => increment(seasonChildFields, field, count));
    seasonTitles.push(...parsed.seasonTitles);
  }
  const seasonImageCounts = {};
  const seasonImageStems = [];
  for (const file of liveImages) {
    const stem = path.basename(file, path.extname(file));
    const prefix = [...SEASON_PREFIXES.keys()].find(candidate => stem.startsWith(candidate));
    if (!prefix) continue;
    increment(seasonImageCounts, SEASON_PREFIXES.get(prefix));
    seasonImageStems.push(stem.slice(prefix.length).trim());
  }
  const seasonMetadataWithoutImage = seasonTitles.filter(title => !seasonImageStems.includes(title)).length;
  const seasonImagesWithoutMetadata = seasonImageStems.filter(title => !seasonTitles.includes(title)).length;

  const live = JSON.parse(fs.readFileSync(LIVE_JSON, 'utf8'));
  const liveItems = (live.years || []).flatMap(group => group.items || []);
  const liveFields = {};
  liveItems.forEach(item => Object.keys(item).forEach(field => increment(liveFields, field)));
  const liveSeasonEntries = liveItems.reduce((sum, item) => sum + (item.season_entries?.length || 0), 0);
  const positionalIds = liveItems.filter(item => /^games_\d{4}(?:\.0)?_\d+$/.test(String(item.id))).length;
  const home = JSON.parse(fs.readFileSync(HOME_JSON, 'utf8'));
  const liveIds = new Set(liveItems.map(item => item.id));
  const homeGames = home.latestGames || [];
  const buildScript = fs.readFileSync(BUILD_SCRIPT, 'utf8');

  return {
    source: {
      yearGroups: yearGroups.length,
      yearGroupDetails: yearGroups,
      ordinaryImages: yearGroups.reduce((sum, group) => sum + group.images, 0),
      managedYearGroups: yearGroups.filter(group => group.hasMeta).length,
      unmanagedYearGroups: yearGroups.filter(group => !group.hasMeta).length,
      metadataEntries,
      metadataParserErrors,
      managedImagesWithoutMetadata,
      orphanMetadata,
      metadataFields,
      dlcFilenameCandidates,
      explicitDlcParents,
      displayTitleOverrides,
      liveYamlFiles: liveYamlFiles.length,
      liveImages: liveImages.length,
      liveCoverImages: liveImages.length - seasonImageStems.length,
      seasonImages: seasonImageStems.length,
      seasonMetadataEntries: seasonTitles.length,
      seasonMetadataWithoutImage,
      seasonImagesWithoutMetadata,
      liveParserErrors,
      liveScalarFields,
      seasonChildFields,
      seasonImageCounts,
    },
    live: {
      totalCount: Number(live.total_count || 0),
      itemCount: liveItems.length,
      yearGroups: (live.years || []).length,
      itemFieldCounts: liveFields,
      metadataEnabled: liveItems.filter(item => item.game_meta_enabled).length,
      metadataDisabled: liveItems.filter(item => !item.game_meta_enabled).length,
      seasonalItems: liveItems.filter(item => item.seasonal).length,
      dlcItems: liveItems.filter(item => item.dlc).length,
      seasonEntries: liveSeasonEntries,
      uniqueIds: new Set(liveItems.map(item => item.id)).size,
      positionalIds,
      homeItems: homeGames.length,
      homeMissingFromGames: homeGames.filter(item => !liveIds.has(item.id)).length,
      homeSeasonalItems: homeGames.filter(item => item.seasonal).length,
      homeDlcItems: homeGames.filter(item => item.dlc).length,
    },
    risks: {
      buildArchiveCanRewriteGameMeta: /meta_file\.write_text\(/.test(buildScript),
      legacyMetadataOptOutItems: yearGroups.filter(group => !group.hasMeta).reduce((sum, group) => sum + group.images, 0),
      dlcDetectedByFilenameDelimiter: true,
      dlcCandidatesWithoutExplicitParent: dlcFilenameCandidates - explicitDlcParents,
      liveGamesDetectedByHardcodedPrefix: true,
      liveParentCount: liveYamlFiles.length,
      liveSeasonSchemaVariesByParent: Object.keys(seasonChildFields).length > 2,
      positionalIdsAreStable: positionalIds !== liveItems.length,
      generatedFallbackUrlsAreSourceTruth: false,
    },
  };
}

function printSummary(result) {
  const pass = (
    result.source.metadataParserErrors === 0
    && result.source.liveParserErrors === 0
    && result.source.managedImagesWithoutMetadata === 0
    && result.source.orphanMetadata === 0
    && result.source.seasonMetadataWithoutImage === 0
    && result.source.seasonImagesWithoutMetadata === 0
    && result.live.itemCount === result.source.ordinaryImages + result.source.liveYamlFiles
    && result.live.seasonEntries === result.source.seasonImages
    && result.live.uniqueIds === result.live.itemCount
    && result.live.homeMissingFromGames === 0
  );
  console.log(`[${pass ? 'PASS' : 'WARN'}] Archive Games read-only audit`);
  console.log(`  yearGroups: ${result.source.yearGroups}`);
  console.log(`  ordinaryImages: ${result.source.ordinaryImages}`);
  console.log(`  managedYearGroups: ${result.source.managedYearGroups}`);
  console.log(`  unmanagedYearGroups: ${result.source.unmanagedYearGroups}`);
  console.log(`  metadataEntries: ${result.source.metadataEntries}`);
  console.log(`  metadataParserErrors: ${result.source.metadataParserErrors}`);
  console.log(`  managedImagesWithoutMetadata: ${result.source.managedImagesWithoutMetadata}`);
  console.log(`  orphanMetadata: ${result.source.orphanMetadata}`);
  console.log(`  dlcFilenameCandidates: ${result.source.dlcFilenameCandidates}`);
  console.log(`  explicitDlcParents: ${result.source.explicitDlcParents}`);
  console.log(`  liveYamlFiles: ${result.source.liveYamlFiles}`);
  console.log(`  liveImages: ${result.source.liveImages}`);
  console.log(`  liveCoverImages: ${result.source.liveCoverImages}`);
  console.log(`  seasonImages: ${result.source.seasonImages}`);
  console.log(`  seasonMetadataEntries: ${result.source.seasonMetadataEntries}`);
  console.log(`  seasonAssetMismatches: ${result.source.seasonMetadataWithoutImage + result.source.seasonImagesWithoutMetadata}`);
  console.log(`  liveTotalItems: ${result.live.itemCount}`);
  console.log(`  metadataEnabledItems: ${result.live.metadataEnabled}`);
  console.log(`  metadataDisabledItems: ${result.live.metadataDisabled}`);
  console.log(`  seasonalItems: ${result.live.seasonalItems}`);
  console.log(`  seasonEntries: ${result.live.seasonEntries}`);
  console.log(`  dlcItems: ${result.live.dlcItems}`);
  console.log(`  positionalLiveIds: ${result.live.positionalIds}`);
  console.log(`  homeItems: ${result.live.homeItems}`);
  console.log(`  homeMissingFromGames: ${result.live.homeMissingFromGames}`);
  console.log(`  buildArchiveCanRewriteGameMeta: ${result.risks.buildArchiveCanRewriteGameMeta}`);
  console.log(`  dlcCandidatesWithoutExplicitParent: ${result.risks.dlcCandidatesWithoutExplicitParent}`);
  console.log('  writeActions: 0');
  console.log(`Result: Games audit ${pass ? 'passed with migration decisions recorded' : 'needs review'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  printSummary(auditGames());
}
