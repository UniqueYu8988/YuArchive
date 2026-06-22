import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARCHIVE_DATA_V2_ROOT,
  existsDir,
  existsFile,
  IMAGE_EXTENSIONS,
  listDirSafe,
  parseSectionsConfig,
  parseTextEntryYaml,
  sha256,
  TEXT_KINDS,
} from './archive-data-v2-texts-core.mjs';

const PROJECT_ROOT = process.cwd();
const PUBLIC_TEXTS_JSON = path.join(PROJECT_ROOT, 'public', 'data', 'texts.json');
const PREVIEW_ROOT = path.join(os.tmpdir(), 'yuarchive-v2-texts-live-compatible-preview');
const PREVIEW_TEXTS_JSON = path.join(PREVIEW_ROOT, 'texts.json');
const REQUIRED_ITEM_FIELDS = ['id', 'title', 'section', 'tags', 'content'];
const PRIVACY_RULES = [
  ['windows_user_path', /[A-Za-z]:[\\/]+Users[\\/]/i],
  ['onedrive_path', /OneDrive/i],
  ['legacy_source_path', /Data backup/i],
  ['credential_field', /"(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)"\s*:/i],
];

function assertPreviewTargetSafe(targetPath, v2Root) {
  const target = path.resolve(targetPath).toLowerCase();
  const forbidden = [
    path.join(PROJECT_ROOT, 'public', 'data'),
    path.join(PROJECT_ROOT, 'src', 'data'),
    path.join(PROJECT_ROOT, 'reports'),
    v2Root,
  ].map(value => path.resolve(value).toLowerCase());
  if (forbidden.some(root => target === root || target.startsWith(`${root}${path.sep}`))) {
    throw new Error('preview_target_forbidden');
  }
}

function fingerprint(item) {
  return sha256(Buffer.from(JSON.stringify([
    String(item.title ?? '').trim(),
    String(item.section ?? '').trim(),
    String(item.date ?? '').trim().replaceAll('/', '-'),
    String(item.content ?? '').trim(),
  ]), 'utf8'));
}

function groupBy(items, keyFn) {
  const grouped = new Map();
  for (const item of items) {
    const key = keyFn(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}

function loadV2Entries(v2Root) {
  const textsRoot = path.join(v2Root, 'entries', 'texts');
  const entries = [];
  for (const kind of TEXT_KINDS) {
    const kindRoot = path.join(textsRoot, kind);
    for (const child of listDirSafe(kindRoot).filter(entry => entry.isDirectory())) {
      const entryRoot = path.join(kindRoot, child.name);
      const entryYaml = path.join(entryRoot, 'entry.yaml');
      const contentMd = path.join(entryRoot, 'content.md');
      if (!existsFile(entryYaml) || !existsFile(contentMd)) continue;
      const parsed = parseTextEntryYaml(entryYaml);
      const covers = listDirSafe(entryRoot).filter(entry => (
        entry.isFile()
        && entry.name.startsWith('cover.')
        && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ));
      entries.push({
        ...parsed.data,
        id: String(parsed.data.id ?? child),
        kind,
        tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
        content: fs.readFileSync(contentMd, 'utf8').trim(),
        hasCover: covers.length === 1,
        parseErrors: parsed.errors,
      });
    }
  }
  return entries;
}

function sectionMapFromConfig(v2Root) {
  const parsed = parseSectionsConfig(path.join(v2Root, 'config', 'texts-sections.yaml'));
  if (parsed.errors.length) throw new Error('texts_section_config_invalid');
  return parsed.sections;
}

function privacyHits(text) {
  return PRIVACY_RULES.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

export function generateTextsLiveCompatiblePreview({
  v2Root = ARCHIVE_DATA_V2_ROOT,
  publicTextsJson = PUBLIC_TEXTS_JSON,
  previewTextsJson = PREVIEW_TEXTS_JSON,
} = {}) {
  assertPreviewTargetSafe(previewTextsJson, v2Root);
  if (!existsDir(path.join(v2Root, 'entries', 'texts'))) throw new Error('v2_texts_missing');
  if (!existsFile(publicTextsJson)) throw new Error('public_texts_json_missing');

  const live = JSON.parse(fs.readFileSync(publicTextsJson, 'utf8'));
  const liveItems = Array.isArray(live.items) ? live.items : [];
  const liveSections = Array.isArray(live.sections) ? live.sections : [];
  const v2Entries = loadV2Entries(v2Root);
  const config = sectionMapFromConfig(v2Root);
  const v2ByFingerprint = groupBy(v2Entries, fingerprint);
  const matchedV2Ids = new Set();
  let mappedEntries = 0;
  let unmappedLive = 0;
  let ambiguousMappings = 0;
  let reusedLiveIds = 0;
  let reusedCoverPaths = 0;
  let requiredMissing = 0;
  let itemFieldDifferences = 0;
  const previewItems = [];

  for (const liveItem of liveItems) {
    const matches = v2ByFingerprint.get(fingerprint(liveItem)) ?? [];
    if (matches.length !== 1) {
      if (matches.length > 1) ambiguousMappings += 1;
      else unmappedLive += 1;
      continue;
    }
    const v2 = matches[0];
    matchedV2Ids.add(v2.id);
    const sectionConfig = config.get(v2.section);
    const item = {
      id: String(liveItem.id ?? ''),
      title: String(v2.title ?? ''),
      date: String(v2.date ?? ''),
      sort_date: String(v2.date ?? ''),
      section: String(v2.section ?? ''),
      section_title: String(sectionConfig?.title ?? liveItem.section_title ?? ''),
      cover: v2.hasCover ? String(liveItem.cover ?? '') : '',
      author: String(v2.author ?? ''),
      summary: String(v2.summary ?? ''),
      excerpt: String(liveItem.excerpt ?? ''),
      tags: Array.isArray(v2.tags) ? v2.tags : [],
      content: String(v2.content ?? ''),
    };
    for (const field of REQUIRED_ITEM_FIELDS) {
      const value = item[field];
      if (Array.isArray(value) ? false : !String(value ?? '').trim()) requiredMissing += 1;
    }
    if (item.id) reusedLiveIds += 1;
    if (item.cover) reusedCoverPaths += 1;
    for (const field of Object.keys(item)) {
      const left = JSON.stringify(item[field]);
      const right = JSON.stringify(liveItem[field] ?? (Array.isArray(item[field]) ? [] : ''));
      if (left !== right) itemFieldDifferences += 1;
    }
    mappedEntries += 1;
    previewItems.push(item);
  }

  const liveSectionsByKey = new Map(liveSections.map(section => [section.key, section]));
  const sectionCounts = previewItems.reduce((counts, item) => {
    counts[item.section] = (counts[item.section] ?? 0) + 1;
    return counts;
  }, {});
  const previewSections = [...config.entries()].map(([key, section]) => ({
    key,
    title: section.title,
    description: section.description,
    icon: section.icon,
    showcase_images: Array.isArray(liveSectionsByKey.get(key)?.showcase_images)
      ? liveSectionsByKey.get(key).showcase_images
      : [],
    count: sectionCounts[key] ?? 0,
  }));
  const preview = {
    key: live.key ?? 'texts',
    display_name: live.display_name ?? '灵犀',
    total_count: previewItems.length,
    sort_mode: 'text',
    sections: previewSections,
    items: previewItems,
  };
  const serialized = `${JSON.stringify(preview, null, 2)}\n`;
  const privacyRules = privacyHits(serialized);
  if (privacyRules.length) throw new Error('preview_privacy_rule_hit');
  fs.mkdirSync(path.dirname(previewTextsJson), { recursive: true });
  fs.writeFileSync(previewTextsJson, serialized, 'utf8');

  const unmappedV2 = v2Entries.length - matchedV2Ids.size;
  const orderDifferences = previewItems.reduce(
    (count, item, index) => count + (item.id === liveItems[index]?.id ? 0 : 1),
    0,
  );
  const sectionOrderDifferences = previewSections.reduce(
    (count, section, index) => count + (section.key === liveSections[index]?.key ? 0 : 1),
    0,
  );
  const pass = v2Entries.length === 132
    && liveItems.length === 132
    && mappedEntries === 132
    && unmappedLive === 0
    && unmappedV2 === 0
    && ambiguousMappings === 0
    && reusedLiveIds === 132
    && reusedCoverPaths === 54
    && requiredMissing === 0
    && orderDifferences === 0
    && sectionOrderDifferences === 0
    && privacyRules.length === 0;
  return {
    ok: pass,
    previewOutput: 'system-temp/yuarchive-v2-texts-live-compatible-preview/texts.json',
    v2Entries: v2Entries.length,
    liveItems: liveItems.length,
    mappedEntries,
    previewItems: previewItems.length,
    unmappedLive,
    unmappedV2,
    ambiguousMappings,
    reusedLiveIds,
    reusedCoverPaths,
    requiredMissing,
    itemFieldDifferences,
    orderDifferences,
    sectionOrderDifferences,
    privacyRuleHits: privacyRules.length,
    privacyRules,
    publicTextsJsonModified: false,
    buildArchiveRun: false,
  };
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Archive Texts live-compatible preview`);
  for (const [key, value] of Object.entries(result)) {
    if (key === 'ok' || key === 'privacyRules') continue;
    console.log(`  ${key}: ${value}`);
  }
  console.log(`  privacyRules: ${result.privacyRules.length ? result.privacyRules.join(', ') : 'none'}`);
  console.log(`Result: archive data v2 texts live-compatible preview ${result.ok ? 'passed' : 'failed'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = generateTextsLiveCompatiblePreview();
    printResult(result);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log('[FAIL] Archive Texts live-compatible preview');
    console.log(`  error: ${error instanceof Error ? error.message : 'unknown_error'}`);
    console.log('Result: archive data v2 texts live-compatible preview failed');
    process.exitCode = 1;
  }
}

