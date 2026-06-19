import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ARCHIVE_SOURCE_ROOT = path.join(os.homedir(), 'OneDrive', '图片', 'Data');
export const TEXTS_SOURCE_ROOT = path.join(ARCHIVE_SOURCE_ROOT, 'Texts');
export const ARCHIVE_DATA_V2_ROOT = path.join(path.dirname(ARCHIVE_SOURCE_ROOT), 'ArchiveData-v2');
export const TEXTS_V2_ROOT = path.join(ARCHIVE_DATA_V2_ROOT, 'entries', 'texts');
export const TEXTS_V2_CONFIG_PATH = path.join(ARCHIVE_DATA_V2_ROOT, 'config', 'texts-sections.yaml');
export const TEXTS_MIGRATION_ROOT = path.join(ARCHIVE_DATA_V2_ROOT, 'migration', 'texts');

export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
export const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
export const TEXT_KINDS = new Set(['article', 'book_note', 'series_note']);
export const ENTRY_ID_PATTERN = /^text-[a-z0-9](?:[a-z0-9-]{0,74}[a-z0-9])$/;
export const SECTION_KIND_RULES = new Map([
  ['headline', 'series_note'],
  ['bedtime-news', 'series_note'],
  ['book-reviews', 'book_note'],
  ['reference-info', 'article'],
  ['miscellany', 'article'],
]);

export function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function existsDir(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

export function listDirSafe(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function walkFiles(dirPath) {
  const files = [];
  for (const entry of listDirSafe(dirPath)) {
    const current = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(current));
    else if (entry.isFile()) files.push(current);
  }
  return files;
}

export function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function unquote(value) {
  const text = normalizeText(value);
  if (
    (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("'") && text.endsWith("'"))
  ) return text.slice(1, -1);
  return text;
}

export function parseInlineList(value) {
  const text = unquote(value);
  const inner = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
  return inner.split(/[,|]/).map(unquote).map(normalizeText).filter(Boolean);
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function checksumFile(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function normalizeRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

export function buildMigratedTextId(sourceRelativePath) {
  const normalized = normalizeText(sourceRelativePath).replaceAll('\\', '/');
  return `text-${sha256(Buffer.from(normalized, 'utf8')).slice(0, 12)}`;
}

export function parseSectionsConfig(filePath) {
  const sections = new Map();
  const errors = [];
  if (!existsFile(filePath)) return { sections, errors: ['sections_yaml_missing'] };

  let currentKey = null;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.replace(/\s+#.*$/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const indent = rawLine.length - rawLine.trimStart().length;
    if (indent === 0 && trimmed.endsWith(':')) {
      currentKey = normalizeText(unquote(trimmed.slice(0, -1)));
      if (!currentKey || sections.has(currentKey)) {
        errors.push(`invalid_section_key_line_${index + 1}`);
        currentKey = null;
        return;
      }
      sections.set(currentKey, { title: '', description: '', icon: '', aliases: [], fields: new Set() });
      return;
    }
    if (!currentKey || !trimmed.includes(':')) {
      errors.push(`invalid_section_field_line_${index + 1}`);
      return;
    }
    const [rawKey, ...rest] = trimmed.split(':');
    const key = normalizeText(rawKey).toLowerCase();
    const value = rest.join(':');
    const section = sections.get(currentKey);
    section.fields.add(key);
    if (key === 'aliases') section.aliases = parseInlineList(value);
    else section[key] = unquote(value);
  });
  return { sections, errors };
}

export function parseTextMarkdown(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const metadata = {};
  const keys = [];
  let closedAt = -1;
  let errors = 0;

  if (lines[0]?.trim() === '---') {
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
      const key = normalizeText(rawKey).toLowerCase();
      let value = unquote(rest.join(':'));
      if (key === 'tags') value = parseInlineList(value);
      metadata[key] = value;
      keys.push(key);
    }
    if (closedAt < 0) errors += 1;
  }

  const content = (closedAt >= 0 ? lines.slice(closedAt + 1) : lines).join('\n').trim();
  return {
    metadata,
    keys,
    content,
    hasFrontmatter: lines[0]?.trim() === '---',
    errors,
  };
}

export function classifyTextDate(value) {
  const date = normalizeText(value);
  if (!date) return 'missing';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'full';
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(date)) return 'full-slash';
  if (/^\d{2}[-/]\d{2}$/.test(date)) return 'partial';
  return 'invalid';
}

export function buildTextsSourceInventory({ textsRoot = TEXTS_SOURCE_ROOT } = {}) {
  const sectionsPath = path.join(textsRoot, 'sections.yaml');
  const sectionConfig = parseSectionsConfig(sectionsPath);
  const aliasToKey = new Map();
  for (const [key, section] of sectionConfig.sections) {
    aliasToKey.set(key, key);
    for (const alias of section.aliases) aliasToKey.set(alias, key);
  }

  const allFiles = existsDir(textsRoot) ? walkFiles(textsRoot) : [];
  const markdownFiles = allFiles.filter(file => MARKDOWN_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const imageFiles = allFiles.filter(file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const imagesByStem = new Map();
  for (const image of imageFiles) {
    const stem = normalizeText(path.basename(image, path.extname(image))).toLowerCase();
    const matches = imagesByStem.get(stem) ?? [];
    matches.push(image);
    imagesByStem.set(stem, matches);
  }

  const entries = [];
  const errors = [...sectionConfig.errors];
  for (const markdownPath of markdownFiles.sort((left, right) => left.localeCompare(right))) {
    const parsed = parseTextMarkdown(markdownPath);
    const sourceRelativePath = normalizeRelative(textsRoot, markdownPath);
    const folder = normalizeText(sourceRelativePath.split('/')[0]);
    const sectionSource = normalizeText(parsed.metadata.section) || folder;
    const section = aliasToKey.get(sectionSource) ?? sectionSource;
    const kind = SECTION_KIND_RULES.get(section) ?? '';
    const stem = normalizeText(path.basename(markdownPath, path.extname(markdownPath))).toLowerCase();
    const coverMatches = imagesByStem.get(stem) ?? [];
    const title = normalizeText(parsed.metadata.title || path.basename(markdownPath, path.extname(markdownPath)));
    const date = normalizeText(parsed.metadata.date).replaceAll('/', '-');
    const knownFields = new Set(['title', 'date', 'author', 'summary', 'tags']);
    const legacyFields = Object.fromEntries(
      Object.entries(parsed.metadata).filter(([key, value]) => !knownFields.has(key) && value !== ''),
    );

    if (parsed.errors) errors.push(`frontmatter_error:${sourceRelativePath}`);
    if (!sectionConfig.sections.has(section)) errors.push(`unknown_section:${sourceRelativePath}`);
    if (!kind) errors.push(`unknown_kind:${sourceRelativePath}`);
    if (!title) errors.push(`missing_title:${sourceRelativePath}`);
    if (!parsed.content) errors.push(`empty_content:${sourceRelativePath}`);
    if (kind === 'book_note' && coverMatches.length !== 1) errors.push(`book_cover_count:${sourceRelativePath}`);
    if (kind !== 'book_note' && coverMatches.length) errors.push(`unexpected_cover:${sourceRelativePath}`);

    entries.push({
      id: buildMigratedTextId(sourceRelativePath),
      board: 'texts',
      kind,
      title,
      section,
      date,
      dateStatus: classifyTextDate(date),
      author: normalizeText(parsed.metadata.author),
      summary: normalizeText(parsed.metadata.summary),
      tags: Array.isArray(parsed.metadata.tags) ? parsed.metadata.tags : parseInlineList(parsed.metadata.tags),
      content: parsed.content,
      sourcePath: markdownPath,
      sourceRelativePath,
      sourceChecksum: checksumFile(markdownPath),
      contentChecksum: sha256(Buffer.from(parsed.content, 'utf8')),
      coverPath: coverMatches[0] ?? null,
      coverRelativePath: coverMatches[0] ? normalizeRelative(textsRoot, coverMatches[0]) : '',
      coverChecksum: coverMatches[0] ? checksumFile(coverMatches[0]) : '',
      legacyFields,
    });
  }

  const usedImages = new Set(entries.map(entry => entry.coverPath).filter(Boolean));
  const orphanImages = imageFiles.filter(file => !usedImages.has(file));
  return {
    textsRoot,
    sectionsPath,
    sectionConfig,
    entries,
    allFiles,
    markdownFiles,
    imageFiles,
    orphanImages,
    errors,
  };
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function yamlStringArray(values) {
  return `[${values.map(yamlString).join(', ')}]`;
}

export function serializeTextEntryYaml(entry) {
  const lines = [
    `id: ${yamlString(entry.id)}`,
    'board: texts',
    `kind: ${entry.kind}`,
    `title: ${yamlString(entry.title)}`,
    `section: ${entry.section}`,
  ];
  if (entry.date) lines.push(`date: ${yamlString(entry.date)}`);
  if (entry.author) lines.push(`author: ${yamlString(entry.author)}`);
  if (entry.summary) lines.push(`summary: ${yamlString(entry.summary)}`);
  lines.push(`tags: ${yamlStringArray(entry.tags)}`);
  lines.push('legacy:');
  lines.push(`  source_relative_path: ${yamlString(entry.sourceRelativePath)}`);
  if (entry.legacyFields.source_id) lines.push(`  source_id: ${yamlString(entry.legacyFields.source_id)}`);
  if (entry.legacyFields.summary_provider) lines.push(`  summary_provider: ${yamlString(entry.legacyFields.summary_provider)}`);
  const remaining = Object.entries(entry.legacyFields)
    .filter(([key]) => !['source_id', 'summary_provider'].includes(key));
  if (remaining.length) {
    lines.push('  original_frontmatter:');
    for (const [key, value] of remaining) {
      lines.push(`    ${key}: ${yamlString(Array.isArray(value) ? value.join(', ') : value)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function parseTextEntryYaml(filePath) {
  const data = {};
  let errors = 0;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    if (indent > 0) continue;
    if (!trimmed.includes(':')) {
      errors += 1;
      continue;
    }
    const [rawKey, ...rest] = trimmed.split(':');
    const key = normalizeText(rawKey);
    const value = rest.join(':').trim();
    if (!value) {
      data[key] = {};
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = parseInlineList(value);
    } else if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      try {
        data[key] = value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1);
      } catch {
        data[key] = value.slice(1, -1);
      }
    } else {
      data[key] = value;
    }
  }
  return { data, errors };
}

export function serializeTextsSectionsYaml(sectionConfig) {
  const lines = [];
  for (const [key, section] of sectionConfig.sections) {
    lines.push(`${key}:`);
    lines.push(`  title: ${yamlString(section.title)}`);
    lines.push(`  description: ${yamlString(section.description)}`);
    lines.push(`  icon: ${yamlString(section.icon)}`);
    lines.push(`  aliases: ${yamlStringArray(section.aliases)}`);
    lines.push(`  kind: ${SECTION_KIND_RULES.get(key)}`);
    lines.push(`  cover_policy: ${SECTION_KIND_RULES.get(key) === 'book_note' ? 'required' : 'none'}`);
  }
  return `${lines.join('\n')}\n`;
}

export function buildTextsMigrationPlan({ textsRoot = TEXTS_SOURCE_ROOT } = {}) {
  const inventory = buildTextsSourceInventory({ textsRoot });
  const targets = [];
  const idCounts = new Map();
  const pathCounts = new Map();
  const kindCounts = {};
  const dateStatus = {};
  let missingCovers = 0;
  let unexpectedCovers = 0;
  let datePolicyViolations = 0;

  for (const entry of inventory.entries) {
    const entryRoot = `entries/texts/${entry.kind}/${entry.id}`;
    const entryTargets = [
      { role: 'entry_yaml', relativePath: `${entryRoot}/entry.yaml` },
      { role: 'content_md', relativePath: `${entryRoot}/content.md` },
    ];
    if (entry.coverPath) entryTargets.push({ role: 'cover', relativePath: `${entryRoot}/cover${path.extname(entry.coverPath).toLowerCase()}` });
    targets.push(...entryTargets.map(target => ({ ...target, entryId: entry.id })));
    idCounts.set(entry.id, (idCounts.get(entry.id) ?? 0) + 1);
    for (const target of entryTargets) pathCounts.set(target.relativePath, (pathCounts.get(target.relativePath) ?? 0) + 1);
    kindCounts[entry.kind] = (kindCounts[entry.kind] ?? 0) + 1;
    dateStatus[entry.dateStatus] = (dateStatus[entry.dateStatus] ?? 0) + 1;
    if (entry.kind === 'book_note' && !entry.coverPath) missingCovers += 1;
    if (entry.kind !== 'book_note' && entry.coverPath) unexpectedCovers += 1;
    if (entry.kind !== 'book_note' && entry.dateStatus !== 'full') datePolicyViolations += 1;
    if (entry.kind === 'book_note' && !['missing', 'full'].includes(entry.dateStatus)) datePolicyViolations += 1;
  }
  targets.push({ role: 'sections_config', relativePath: 'config/texts-sections.yaml', entryId: null });
  pathCounts.set('config/texts-sections.yaml', 1);

  const duplicateIds = [...idCounts.values()].filter(count => count > 1).length;
  const duplicateTargets = [...pathCounts.values()].filter(count => count > 1).length;
  const sourceManifestRecords = inventory.markdownFiles.length + inventory.imageFiles.length + (existsFile(inventory.sectionsPath) ? 1 : 0);
  const blockedReasons = [
    ...inventory.errors,
    duplicateIds ? 'duplicate_ids' : null,
    duplicateTargets ? 'duplicate_targets' : null,
    inventory.orphanImages.length ? 'orphan_images' : null,
    missingCovers ? 'missing_book_covers' : null,
    unexpectedCovers ? 'unexpected_nonbook_covers' : null,
    datePolicyViolations ? 'date_policy_violations' : null,
  ].filter(Boolean);

  return {
    ok: blockedReasons.length === 0,
    inventory,
    targets,
    entries: inventory.entries.length,
    kindCounts,
    dateStatus,
    targetRoles: targets.reduce((counts, target) => {
      counts[target.role] = (counts[target.role] ?? 0) + 1;
      return counts;
    }, {}),
    sourceManifestRecords,
    duplicateIds,
    duplicateTargets,
    missingCovers,
    unexpectedCovers,
    orphanImages: inventory.orphanImages.length,
    datePolicyViolations,
    blockedReasons,
  };
}
