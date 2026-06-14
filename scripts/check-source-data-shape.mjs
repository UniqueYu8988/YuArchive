import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = 'C:\\Users\\Yu\\OneDrive\\图片\\Data';
const SECTION_DIRS = ['Games', 'Visions', 'Music', 'Texts'];
const REQUIRED_CONFIGS = ['homepage.yaml', 'site-layout.yaml', 'site-ui.yaml'];
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

const results = [];

function normalizeTitle(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function displayPath(filePath) {
  const rel = path.relative(SOURCE_ROOT, filePath).replaceAll(path.sep, '/');
  return rel ? `[OneDrive Data]/${rel}` : '[OneDrive Data]';
}

function pushResult(section, status, message, details = {}) {
  results.push({ section, status, message, details });
}

function existsDir(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listDirSafe(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walkFiles(dirPath, predicate = () => true) {
  const output = [];
  for (const entry of listDirSafe(dirPath)) {
    const current = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      output.push(...walkFiles(current, predicate));
    } else if (entry.isFile() && predicate(current)) {
      output.push(current);
    }
  }
  return output;
}

function listImmediateDirs(dirPath) {
  return listDirSafe(dirPath)
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(dirPath, entry.name));
}

function listImmediateFiles(dirPath, predicate = () => true) {
  return listDirSafe(dirPath)
    .filter(entry => entry.isFile())
    .map(entry => path.join(dirPath, entry.name))
    .filter(predicate);
}

function parseScalar(rawValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true' || trimmed === 'yes') return true;
  if (trimmed === 'false' || trimmed === 'no') return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(part => normalizeTitle(parseScalar(part)));
  }
  return trimmed;
}

function parseSimpleYaml(filePath) {
  const text = readUtf8(filePath);
  const result = {};
  let currentTopKey = null;
  let currentNestedKey = null;
  const errors = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const withoutComment = rawLine.replace(/\s+#.*$/, '');
    const trimmed = withoutComment.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const indent = rawLine.length - rawLine.trimStart().length;
    if (trimmed.startsWith('- ')) {
      if (!currentTopKey) {
        errors.push({ line: lineNumber, reason: 'list item without parent key' });
        return;
      }
      if (!Array.isArray(result[currentTopKey])) result[currentTopKey] = [];
      result[currentTopKey].push(parseScalar(trimmed.slice(2)));
      return;
    }

    if (!trimmed.includes(':')) {
      errors.push({ line: lineNumber, reason: 'missing colon' });
      return;
    }

    const [rawKey, ...rest] = trimmed.split(':');
    const key = normalizeTitle(parseScalar(rawKey));
    const valueText = rest.join(':').trim();
    if (!key) {
      errors.push({ line: lineNumber, reason: 'empty key' });
      return;
    }

    if (indent === 0) {
      currentTopKey = key;
      currentNestedKey = null;
      result[key] = valueText ? parseScalar(valueText) : {};
      return;
    }

    if (!currentTopKey) {
      errors.push({ line: lineNumber, reason: 'nested key without parent key' });
      return;
    }

    if (indent === 2 && trimmed.endsWith(':') && !valueText) {
      if (!result[currentTopKey] || Array.isArray(result[currentTopKey]) || typeof result[currentTopKey] !== 'object') {
        result[currentTopKey] = {};
      }
      currentNestedKey = key;
      result[currentTopKey][key] = {};
      return;
    }

    if (!result[currentTopKey] || Array.isArray(result[currentTopKey]) || typeof result[currentTopKey] !== 'object') {
      result[currentTopKey] = {};
    }

    if (indent >= 4 && currentNestedKey) {
      result[currentTopKey][currentNestedKey][key] = parseScalar(valueText);
      return;
    }

    result[currentTopKey][key] = parseScalar(valueText);
  });

  return { data: result, errors };
}

function parseFrontmatter(filePath) {
  const text = readUtf8(filePath);
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { metadata: {}, hasFrontmatter: false, errors: [] };
  }

  const metadataLines = [];
  let closed = false;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      closed = true;
      break;
    }
    metadataLines.push(lines[index]);
  }

  if (!closed) {
    return { metadata: {}, hasFrontmatter: true, errors: [{ reason: 'frontmatter not closed' }] };
  }

  const metadata = {};
  const errors = [];
  metadataLines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    if (!trimmed.includes(':')) {
      errors.push({ line: index + 2, reason: 'frontmatter line missing colon' });
      return;
    }
    const [key, ...rest] = trimmed.split(':');
    metadata[key.trim().toLowerCase()] = parseScalar(rest.join(':'));
  });

  return { metadata, hasFrontmatter: true, errors };
}

function collectYamlErrors(files) {
  const errors = [];
  for (const file of files) {
    try {
      const parsed = parseSimpleYaml(file);
      if (parsed.errors.length) {
        errors.push({ file, count: parsed.errors.length });
      }
    } catch {
      errors.push({ file, count: 1 });
    }
  }
  return errors;
}

function collectMarkdownStats(files) {
  const stats = {
    total: files.length,
    readable: 0,
    withFrontmatter: 0,
    frontmatterErrors: 0,
  };
  for (const file of files) {
    try {
      const parsed = parseFrontmatter(file);
      stats.readable += 1;
      if (parsed.hasFrontmatter) stats.withFrontmatter += 1;
      stats.frontmatterErrors += parsed.errors.length;
    } catch {
      stats.frontmatterErrors += 1;
    }
  }
  return stats;
}

function collectGameTitles(gamesRoot) {
  const titles = new Set();
  const imageFiles = walkFiles(gamesRoot, file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  for (const image of imageFiles) {
    titles.add(normalizeTitle(path.basename(image, path.extname(image))));
  }

  const yamlFiles = walkFiles(gamesRoot, file => path.extname(file).toLowerCase() === '.yaml');
  for (const yamlFile of yamlFiles) {
    if (path.basename(yamlFile).toLowerCase() !== 'meta.yaml') {
      titles.add(normalizeTitle(path.basename(yamlFile, path.extname(yamlFile))));
    }
  }

  for (const metaFile of yamlFiles.filter(file => path.basename(file).toLowerCase() === 'meta.yaml')) {
    try {
      const parsed = parseSimpleYaml(metaFile).data;
      for (const [title, value] of Object.entries(parsed)) {
        titles.add(normalizeTitle(title));
        if (value && typeof value === 'object' && !Array.isArray(value) && value.display_title) {
          titles.add(normalizeTitle(value.display_title));
        }
      }
    } catch {
      // Counted elsewhere; title matching is best-effort.
    }
  }
  return titles;
}

function collectVisionTitles(visionsRoot) {
  const titles = new Set();
  const imageFiles = walkFiles(visionsRoot, file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  for (const image of imageFiles) {
    titles.add(normalizeTitle(path.basename(image, path.extname(image))));
  }
  return titles;
}

function collectMusicTitles(musicRoot) {
  const titles = new Set();
  const markdownFiles = walkFiles(musicRoot, file => MARKDOWN_EXTENSIONS.has(path.extname(file).toLowerCase()));
  for (const file of markdownFiles) {
    titles.add(normalizeTitle(path.basename(file, path.extname(file))));
    try {
      const parsed = parseFrontmatter(file);
      if (parsed.metadata.title) titles.add(normalizeTitle(parsed.metadata.title));
    } catch {
      // Counted elsewhere; title matching is best-effort.
    }
  }
  return titles;
}

function collectTextTitles(textsRoot) {
  const titles = new Set();
  const markdownFiles = walkFiles(textsRoot, file => MARKDOWN_EXTENSIONS.has(path.extname(file).toLowerCase()));
  for (const file of markdownFiles) {
    titles.add(normalizeTitle(path.basename(file, path.extname(file))));
    try {
      const parsed = parseFrontmatter(file);
      if (parsed.metadata.title) titles.add(normalizeTitle(parsed.metadata.title));
    } catch {
      // Counted elsewhere; title matching is best-effort.
    }
  }
  return titles;
}

function checkGlobal() {
  const missingDirs = SECTION_DIRS.filter(name => !existsDir(path.join(SOURCE_ROOT, name)));
  const missingConfigs = REQUIRED_CONFIGS.filter(name => !existsFile(path.join(SOURCE_ROOT, name)));
  const configErrors = collectYamlErrors(
    REQUIRED_CONFIGS
      .map(name => path.join(SOURCE_ROOT, name))
      .filter(existsFile),
  );

  const status = missingDirs.length || missingConfigs.length || configErrors.length ? 'FAIL' : 'PASS';
  pushResult('Global', status, 'source root and top-level config check', {
    sectionsExpected: SECTION_DIRS.length,
    missingDirs: missingDirs.length,
    configsExpected: REQUIRED_CONFIGS.length,
    missingConfigs: missingConfigs.length,
    yamlErrorFiles: configErrors.length,
  });
}

function checkGames() {
  const root = path.join(SOURCE_ROOT, 'Games');
  if (!existsDir(root)) {
    pushResult('Games', 'FAIL', 'Games directory missing');
    return;
  }

  const dirs = listImmediateDirs(root);
  const ordinaryYearDirs = dirs.filter(dir => /^Game-\d{4}/.test(path.basename(dir)));
  const liveExists = existsDir(path.join(root, 'Game-Live'));
  const imageFiles = walkFiles(root, file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const metaFiles = walkFiles(root, file => path.basename(file).toLowerCase() === 'meta.yaml');
  const yamlErrors = collectYamlErrors(metaFiles);

  const status = ordinaryYearDirs.length && yamlErrors.length === 0 ? 'PASS' : (ordinaryYearDirs.length ? 'WARN' : 'FAIL');
  pushResult('Games', status, 'image folders and meta.yaml shape check', {
    topLevelDirs: dirs.length,
    ordinaryYearDirs: ordinaryYearDirs.length,
    imageFiles: imageFiles.length,
    metaFiles: metaFiles.length,
    yamlErrorFiles: yamlErrors.length,
    gameLiveDetected: liveExists,
  });
}

function checkVisions() {
  const root = path.join(SOURCE_ROOT, 'Visions');
  if (!existsDir(root)) {
    pushResult('Visions', 'FAIL', 'Visions directory missing');
    return;
  }

  const dirs = listImmediateDirs(root);
  const metaFiles = walkFiles(root, file => path.basename(file).toLowerCase() === 'meta.yaml');
  const yamlErrors = collectYamlErrors(metaFiles);
  const imageFiles = walkFiles(root, file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const showcaseRoot = path.join(root, '角色橱窗');
  const showcaseMeta = path.join(showcaseRoot, 'meta.yaml');
  const showcaseDetected = existsDir(showcaseRoot);
  const showcaseMediaCount = showcaseDetected
    ? listImmediateFiles(showcaseRoot, file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase())).length
    : 0;

  const status = dirs.length && yamlErrors.length === 0 ? 'PASS' : (dirs.length ? 'WARN' : 'FAIL');
  pushResult('Visions', status, 'group folders, meta.yaml, and showcase shape check', {
    topLevelDirs: dirs.length,
    imageFiles: imageFiles.length,
    metaFiles: metaFiles.length,
    yamlErrorFiles: yamlErrors.length,
    showcaseDetected,
    showcaseMetaExists: existsFile(showcaseMeta),
    showcaseMediaFiles: showcaseMediaCount,
  });
}

function checkMusic() {
  const root = path.join(SOURCE_ROOT, 'Music');
  if (!existsDir(root)) {
    pushResult('Music', 'FAIL', 'Music directory missing');
    return;
  }

  const markdownFiles = walkFiles(root, file => MARKDOWN_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const frontmatterStats = collectMarkdownStats(markdownFiles);
  const coversRoot = path.join(root, 'Covers');
  const songsRoot = path.join(root, 'Songs');
  const status = markdownFiles.length && frontmatterStats.frontmatterErrors === 0 ? 'PASS' : (markdownFiles.length ? 'WARN' : 'FAIL');

  pushResult('Music', status, 'markdown frontmatter and asset directory check', {
    markdownFiles: markdownFiles.length,
    readableMarkdown: frontmatterStats.readable,
    withFrontmatter: frontmatterStats.withFrontmatter,
    frontmatterErrors: frontmatterStats.frontmatterErrors,
    coversDirExists: existsDir(coversRoot),
    songsDirExists: existsDir(songsRoot),
    coverFiles: existsDir(coversRoot) ? listImmediateFiles(coversRoot).length : 0,
    songFiles: existsDir(songsRoot) ? listImmediateFiles(songsRoot).length : 0,
  });
}

function parseTextSections(textsRoot) {
  const sectionsPath = path.join(textsRoot, 'sections.yaml');
  if (!existsFile(sectionsPath)) return { keys: new Set(), aliasToKey: new Map(), errors: 1 };
  const parsed = parseSimpleYaml(sectionsPath);
  const keys = new Set();
  const aliasToKey = new Map();
  for (const [key, value] of Object.entries(parsed.data)) {
    keys.add(key);
    aliasToKey.set(key, key);
    if (value && typeof value === 'object' && !Array.isArray(value) && value.aliases) {
      const aliases = Array.isArray(value.aliases)
        ? value.aliases
        : String(value.aliases).split(/[|,]/).map(normalizeTitle).filter(Boolean);
      for (const alias of aliases) aliasToKey.set(alias, key);
    }
  }
  return { keys, aliasToKey, errors: parsed.errors.length };
}

function checkTexts() {
  const root = path.join(SOURCE_ROOT, 'Texts');
  if (!existsDir(root)) {
    pushResult('Texts', 'FAIL', 'Texts directory missing');
    return;
  }

  const markdownFiles = walkFiles(root, file => MARKDOWN_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const frontmatterStats = collectMarkdownStats(markdownFiles);
  const sectionInfo = parseTextSections(root);
  let sectionReferenceWarnings = 0;

  for (const file of markdownFiles) {
    try {
      const parsed = parseFrontmatter(file);
      const rawSection = normalizeTitle(parsed.metadata.section ?? path.basename(path.dirname(file)));
      if (rawSection && !sectionInfo.keys.has(rawSection) && !sectionInfo.aliasToKey.has(rawSection)) {
        sectionReferenceWarnings += 1;
      }
    } catch {
      sectionReferenceWarnings += 1;
    }
  }

  const status = markdownFiles.length && frontmatterStats.frontmatterErrors === 0 && sectionInfo.errors === 0
    ? (sectionReferenceWarnings ? 'WARN' : 'PASS')
    : (markdownFiles.length ? 'WARN' : 'FAIL');

  pushResult('Texts', status, 'sections.yaml, markdown frontmatter, and section reference check', {
    markdownFiles: markdownFiles.length,
    readableMarkdown: frontmatterStats.readable,
    withFrontmatter: frontmatterStats.withFrontmatter,
    frontmatterErrors: frontmatterStats.frontmatterErrors,
    sectionKeys: sectionInfo.keys.size,
    sectionsYamlErrors: sectionInfo.errors,
    sectionReferenceWarnings,
  });
}

function countHomepageMatches(values, candidates) {
  let missing = 0;
  for (const raw of values) {
    const value = normalizeTitle(raw);
    if (!value || candidates.has(value)) continue;
    missing += 1;
  }
  return { configured: values.length, missing };
}

function checkHomepageReferences() {
  const homepagePath = path.join(SOURCE_ROOT, 'homepage.yaml');
  if (!existsFile(homepagePath)) {
    pushResult('Homepage', 'FAIL', 'homepage.yaml missing');
    return;
  }

  let parsed;
  try {
    parsed = parseSimpleYaml(homepagePath);
  } catch {
    pushResult('Homepage', 'FAIL', 'homepage.yaml unreadable');
    return;
  }

  const data = parsed.data;
  const requiredKeys = ['games', 'visions', 'music', 'texts'];
  const missingKeys = requiredKeys.filter(key => !Array.isArray(data[key]));
  const checks = {
    games: countHomepageMatches(Array.isArray(data.games) ? data.games : [], collectGameTitles(path.join(SOURCE_ROOT, 'Games'))),
    visions: countHomepageMatches(Array.isArray(data.visions) ? data.visions : [], collectVisionTitles(path.join(SOURCE_ROOT, 'Visions'))),
    music: countHomepageMatches(Array.isArray(data.music) ? data.music : [], collectMusicTitles(path.join(SOURCE_ROOT, 'Music'))),
    texts: countHomepageMatches(Array.isArray(data.texts) ? data.texts : [], collectTextTitles(path.join(SOURCE_ROOT, 'Texts'))),
  };

  const missingReferences = Object.values(checks).reduce((sum, item) => sum + item.missing, 0);
  const status = parsed.errors.length || missingKeys.length || missingReferences ? 'WARN' : 'PASS';
  pushResult('Homepage', status, 'homepage.yaml section keys and best-effort title references', {
    missingSectionKeys: missingKeys.length,
    yamlErrors: parsed.errors.length,
    gamesConfigured: checks.games.configured,
    gamesMissing: checks.games.missing,
    visionsConfigured: checks.visions.configured,
    visionsMissing: checks.visions.missing,
    musicConfigured: checks.music.configured,
    musicMissing: checks.music.missing,
    textsConfigured: checks.texts.configured,
    textsMissing: checks.texts.missing,
  });
}

function printResults() {
  const order = ['Global', 'Games', 'Visions', 'Music', 'Texts', 'Homepage'];
  const weight = { PASS: 0, WARN: 1, FAIL: 2 };
  let worst = 0;

  for (const section of order) {
    for (const result of results.filter(item => item.section === section)) {
      worst = Math.max(worst, weight[result.status] ?? 0);
      console.log(`[${result.status}] ${result.section}: ${result.message}`);
      for (const [key, value] of Object.entries(result.details ?? {})) {
        console.log(`  ${key}: ${value}`);
      }
    }
  }

  const summary = worst === 2 ? 'failed' : worst === 1 ? 'completed with warnings' : 'passed';
  console.log(`Result: source data shape check ${summary}`);
  process.exitCode = worst === 2 ? 1 : 0;
}

checkGlobal();
checkGames();
checkVisions();
checkMusic();
checkTexts();
checkHomepageReferences();
printResults();
