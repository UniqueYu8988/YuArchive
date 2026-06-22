import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');
const TEXTS_ROOT = path.join(SOURCE_ROOT, 'Texts');
const V2_TEXTS_ROOT = path.join(path.dirname(SOURCE_ROOT), 'Archive', 'entries', 'texts');
const PUBLIC_TEXTS_PATH = path.resolve('public', 'data', 'texts.json');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const SECTION_KIND_RULES = new Map([
  ['headline', 'series_note'],
  ['bedtime-news', 'series_note'],
  ['book-reviews', 'book_note'],
  ['reference-info', 'article'],
  ['miscellany', 'article'],
]);
const ENTRY_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function existsDir(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function listDirSafe(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walkFiles(dirPath) {
  const files = [];
  for (const entry of listDirSafe(dirPath)) {
    const current = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(current));
    else if (entry.isFile()) files.push(current);
  }
  return files;
}

function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function unquote(value) {
  const text = normalize(value);
  if (
    (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("'") && text.endsWith("'"))
  ) return text.slice(1, -1);
  return text;
}

function parseInlineList(value) {
  const text = unquote(value);
  const inner = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
  return inner.split(/[,|]/).map(unquote).map(normalize).filter(Boolean);
}

function parseSectionsConfig(filePath) {
  const result = new Map();
  const errors = [];
  if (!existsFile(filePath)) return { sections: result, errors: ['sections_yaml_missing'] };

  let currentKey = null;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.replace(/\s+#.*$/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const indent = rawLine.length - rawLine.trimStart().length;
    if (indent === 0 && trimmed.endsWith(':')) {
      currentKey = normalize(unquote(trimmed.slice(0, -1)));
      if (!currentKey || result.has(currentKey)) {
        errors.push(`invalid_section_key_line_${index + 1}`);
        currentKey = null;
        return;
      }
      result.set(currentKey, { fields: new Set(), aliases: [] });
      return;
    }
    if (!currentKey || !trimmed.includes(':')) {
      errors.push(`invalid_section_field_line_${index + 1}`);
      return;
    }
    const [rawKey, ...rest] = trimmed.split(':');
    const key = normalize(rawKey).toLowerCase();
    const value = rest.join(':');
    result.get(currentKey).fields.add(key);
    if (key === 'aliases') result.get(currentKey).aliases = parseInlineList(value);
  });
  return { sections: result, errors };
}

function parseFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { metadata: {}, keys: [], bodyEmpty: text.trim().length === 0, hasFrontmatter: false, errors: 0 };
  }

  const metadata = {};
  const keys = [];
  let closedAt = -1;
  let errors = 0;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === '---') {
      closedAt = index;
      break;
    }
    if (!line || line.startsWith('#')) continue;
    if (!line.includes(':')) {
      errors += 1;
      continue;
    }
    const [rawKey, ...rest] = line.split(':');
    const key = normalize(rawKey).toLowerCase();
    let value = unquote(rest.join(':'));
    if (key === 'tags') value = parseInlineList(value);
    metadata[key] = value;
    keys.push(key);
  }
  if (closedAt < 0) errors += 1;
  const body = closedAt >= 0 ? lines.slice(closedAt + 1).join('\n').trim() : '';
  return { metadata, keys, bodyEmpty: body.length === 0, hasFrontmatter: true, errors };
}

function classifyDate(value) {
  const date = normalize(value);
  if (!date) return 'missing';
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(date)) return 'full';
  if (/^\d{2}[-/]\d{2}$/.test(date)) return 'partial';
  return 'invalid';
}

function increment(target, key, amount = 1) {
  target[key] = (target[key] ?? 0) + amount;
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function readPublicSummary() {
  if (!existsFile(PUBLIC_TEXTS_PATH)) return { exists: false, parseError: false, totalCount: 0, items: 0, sections: 0 };
  try {
    const data = JSON.parse(fs.readFileSync(PUBLIC_TEXTS_PATH, 'utf8'));
    return {
      exists: true,
      parseError: false,
      totalCount: Number(data.total_count ?? 0),
      items: Array.isArray(data.items) ? data.items.length : 0,
      sections: Array.isArray(data.sections) ? data.sections.length : 0,
    };
  } catch {
    return { exists: true, parseError: true, totalCount: 0, items: 0, sections: 0 };
  }
}

export function evaluateTextsAudit({ textsRoot = TEXTS_ROOT, v2TextsRoot = V2_TEXTS_ROOT } = {}) {
  const sectionsPath = path.join(textsRoot, 'sections.yaml');
  const sectionConfig = parseSectionsConfig(sectionsPath);
  const aliasToKey = new Map();
  for (const [key, config] of sectionConfig.sections) {
    aliasToKey.set(key, key);
    for (const alias of config.aliases) aliasToKey.set(alias, key);
  }

  const files = existsDir(textsRoot) ? walkFiles(textsRoot) : [];
  const markdownFiles = files.filter(file => MARKDOWN_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const imageFiles = files.filter(file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const fieldUsage = {};
  const dateStatus = {};
  const sectionCounts = {};
  const kindCounts = {};
  const titleKeys = new Set();
  const sourceIds = new Set();
  const markdownStems = new Set();
  let duplicateTitles = 0;
  let duplicateSourceIds = 0;
  let frontmatterFiles = 0;
  let frontmatterErrors = 0;
  let emptyBodies = 0;
  let sectionReferenceWarnings = 0;
  let sectionsWithoutKindRule = 0;
  let sourceIdPresent = 0;
  let sourceIdValid = 0;

  for (const file of markdownFiles) {
    const parsed = parseFrontmatter(file);
    if (parsed.hasFrontmatter) frontmatterFiles += 1;
    frontmatterErrors += parsed.errors;
    if (parsed.bodyEmpty) emptyBodies += 1;
    for (const key of parsed.keys) increment(fieldUsage, key);
    increment(dateStatus, classifyDate(parsed.metadata.date));

    const relative = path.relative(textsRoot, file).split(path.sep);
    const folder = normalize(relative[0]);
    const explicitSection = normalize(parsed.metadata.section);
    const sectionSource = explicitSection || folder;
    const sectionKey = aliasToKey.get(sectionSource) ?? sectionSource;
    increment(sectionCounts, sectionKey || '[missing]');
    const kind = SECTION_KIND_RULES.get(sectionKey);
    if (kind) increment(kindCounts, kind);
    else sectionsWithoutKindRule += 1;
    if (!sectionConfig.sections.has(sectionKey)) sectionReferenceWarnings += 1;

    const titleKey = normalize(parsed.metadata.title || path.basename(file, path.extname(file))).toLowerCase();
    if (titleKeys.has(titleKey)) duplicateTitles += 1;
    titleKeys.add(titleKey);
    markdownStems.add(normalize(path.basename(file, path.extname(file))).toLowerCase());

    const sourceId = normalize(parsed.metadata.source_id);
    if (sourceId) {
      sourceIdPresent += 1;
      if (ENTRY_ID_PATTERN.test(sourceId)) sourceIdValid += 1;
      if (sourceIds.has(sourceId)) duplicateSourceIds += 1;
      sourceIds.add(sourceId);
    }
  }

  const matchedImages = imageFiles.filter(file => markdownStems.has(normalize(path.basename(file, path.extname(file))).toLowerCase())).length;
  const publicSummary = readPublicSummary();
  const missingSectionFields = {};
  for (const [key, config] of sectionConfig.sections) {
    const missing = ['title', 'description', 'icon', 'aliases'].filter(field => !config.fields.has(field));
    if (missing.length) missingSectionFields[key] = missing.length;
  }

  const fatalFailures = [
    !existsDir(textsRoot),
    !existsFile(sectionsPath),
    sectionConfig.errors.length > 0,
    markdownFiles.length === 0,
    frontmatterErrors > 0,
    sectionReferenceWarnings > 0,
    sectionsWithoutKindRule > 0,
    publicSummary.parseError,
    publicSummary.items !== markdownFiles.length,
  ].filter(Boolean).length;

  return {
    ok: fatalFailures === 0,
    failures: fatalFailures,
    sourceRootExists: existsDir(textsRoot),
    sourceFiles: files.length,
    markdownFiles: markdownFiles.length,
    imageFiles: imageFiles.length,
    otherFiles: files.length - markdownFiles.length - imageFiles.length - (existsFile(sectionsPath) ? 1 : 0),
    frontmatterFiles,
    frontmatterErrors,
    emptyBodies,
    sectionConfigExists: existsFile(sectionsPath),
    sectionConfigErrors: sectionConfig.errors.length,
    sectionKeys: [...sectionConfig.sections.keys()],
    sectionCounts: sortedObject(sectionCounts),
    missingSectionFields: sortedObject(missingSectionFields),
    sectionReferenceWarnings,
    kindCounts: sortedObject(kindCounts),
    sectionsWithoutKindRule,
    fieldUsage: sortedObject(fieldUsage),
    dateStatus: sortedObject(dateStatus),
    duplicateTitles,
    sourceIdPresent,
    sourceIdValid,
    duplicateSourceIds,
    matchedImages,
    orphanImages: imageFiles.length - matchedImages,
    publicSummary,
    v2TextsRootExists: existsDir(v2TextsRoot),
    manualConfirmationCandidates: {
      stableIdMissing: markdownFiles.length - sourceIdValid,
      nonFullDates: markdownFiles.length - (dateStatus.full ?? 0),
      orphanImages: imageFiles.length - matchedImages,
      sectionKindRules: sectionsWithoutKindRule,
    },
  };
}

function printResult(result) {
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] Archive Texts read-only audit`);
  for (const key of [
    'sourceRootExists', 'sourceFiles', 'markdownFiles', 'imageFiles', 'otherFiles',
    'frontmatterFiles', 'frontmatterErrors', 'emptyBodies', 'sectionConfigExists',
    'sectionConfigErrors', 'sectionReferenceWarnings', 'sectionsWithoutKindRule',
    'duplicateTitles', 'sourceIdPresent', 'sourceIdValid', 'duplicateSourceIds',
    'matchedImages', 'orphanImages', 'v2TextsRootExists',
  ]) console.log(`  ${key}: ${result[key]}`);
  console.log(`  sectionKeys: ${result.sectionKeys.join(', ') || 'none'}`);
  console.log(`  sectionCounts: ${JSON.stringify(result.sectionCounts)}`);
  console.log(`  kindCounts: ${JSON.stringify(result.kindCounts)}`);
  console.log(`  fieldUsage: ${JSON.stringify(result.fieldUsage)}`);
  console.log(`  dateStatus: ${JSON.stringify(result.dateStatus)}`);
  console.log(`  missingSectionFields: ${JSON.stringify(result.missingSectionFields)}`);
  console.log(`  publicSummary: ${JSON.stringify(result.publicSummary)}`);
  console.log(`  manualConfirmationCandidates: ${JSON.stringify(result.manualConfirmationCandidates)}`);
  console.log('  writeActions: 0');
  console.log(`Result: archive data v2 texts audit ${result.ok ? 'passed' : 'failed'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluateTextsAudit();
  printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}
