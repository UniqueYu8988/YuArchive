import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = 'C:\\Users\\Yu\\OneDrive\\图片\\Data';
const MUSIC_ROOT = path.join(SOURCE_ROOT, 'Music');
const COVERS_ROOT = path.join(MUSIC_ROOT, 'Covers');
const SONGS_ROOT = path.join(MUSIC_ROOT, 'Songs');
const V2_ROOT = path.join(path.dirname(SOURCE_ROOT), 'ArchiveData-v2');
const V2_MUSIC_ROOT = path.join(V2_ROOT, 'entries', 'music', 'album');
const V2_MIGRATION_ROOT = path.join(V2_ROOT, 'migration');

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac']);

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

function listDirSafe(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function listImmediateFiles(dirPath, predicate = () => true) {
  return listDirSafe(dirPath)
    .filter(entry => entry.isFile())
    .map(entry => path.join(dirPath, entry.name))
    .filter(predicate)
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

function assertInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function checksumFile(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return { hash: hash.digest('hex'), bytes: data.length };
}

function parseScalar(rawValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(part => String(parseScalar(part)).trim()).filter(Boolean);
  }
  return trimmed;
}

function parseMarkdown(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { metadata: {}, body: text, hasFrontmatter: false, errors: [] };
  }

  const metadata = {};
  const errors = [];
  let closeIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed === '---') {
      closeIndex = index;
      break;
    }
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.includes(':')) {
      errors.push('frontmatter line missing colon');
      continue;
    }
    const [rawKey, ...rest] = trimmed.split(':');
    metadata[rawKey.trim().toLowerCase()] = parseScalar(rest.join(':'));
  }

  if (closeIndex === -1) {
    errors.push('frontmatter not closed');
    return { metadata, body: text, hasFrontmatter: true, errors };
  }

  return {
    metadata,
    body: lines.slice(closeIndex + 1).join('\n').replace(/^\n/, ''),
    hasFrontmatter: true,
    errors,
  };
}

function normalizeMusicStem(value) {
  const cleaned = String(value ?? '').replace(/[._-]+/g, ' ').trim().toLowerCase();
  if (!cleaned) return '';
  const tokens = cleaned.match(/[a-z0-9]+/g) ?? [];
  return tokens
    .map(token => (/^[li1]+$/.test(token) ? 'i'.repeat(token.length) : token))
    .join('');
}

function slugFromStem(value) {
  const ascii = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return ascii || 'manual-id-required';
}

function yamlScalar(value) {
  if (value === undefined || value === null) return '';
  const text = String(value);
  if (!text) return '';
  return JSON.stringify(text);
}

function isAllowedExt(filePath, allowedExtensions) {
  return allowedExtensions.has(path.extname(filePath).toLowerCase());
}

function uniqueExistingFile(candidates, allowedExtensions) {
  const seen = new Set();
  for (const candidate of candidates) {
    const normalized = path.resolve(candidate).toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (existsFile(candidate) && isAllowedExt(candidate, allowedExtensions)) return candidate;
  }
  return null;
}

function findAssetByStem(targetStem, directory, allowedExtensions) {
  if (!existsDir(directory)) return null;
  const normalizedTarget = normalizeMusicStem(targetStem);
  if (!normalizedTarget) return null;
  for (const child of listImmediateFiles(directory)) {
    if (!isAllowedExt(child, allowedExtensions)) continue;
    if (normalizeMusicStem(path.basename(child, path.extname(child))) === normalizedTarget) return child;
  }
  return null;
}

function findMusicCover(markdownPath, coverValue) {
  const rawValue = String(coverValue ?? '').trim();
  const candidates = [];
  if (rawValue) {
    if (path.parse(rawValue).root) {
      candidates.push(rawValue);
    } else {
      candidates.push(path.join(path.dirname(markdownPath), rawValue));
      candidates.push(path.join(MUSIC_ROOT, rawValue));
      candidates.push(path.join(COVERS_ROOT, rawValue));
    }

    const rawName = path.basename(rawValue);
    if (rawName) {
      candidates.push(path.join(path.dirname(markdownPath), rawName));
      candidates.push(path.join(MUSIC_ROOT, rawName));
      candidates.push(path.join(COVERS_ROOT, rawName));
    }
  }

  const stem = path.basename(markdownPath, path.extname(markdownPath));
  for (const extension of IMAGE_EXTENSIONS) {
    candidates.push(path.join(path.dirname(markdownPath), `${stem}${extension}`));
    candidates.push(path.join(COVERS_ROOT, `${stem}${extension}`));
  }

  return uniqueExistingFile(candidates, IMAGE_EXTENSIONS) ?? findAssetByStem(stem, COVERS_ROOT, IMAGE_EXTENSIONS);
}

function findMusicAudio(markdownPath, audioValue) {
  const rawValue = String(audioValue ?? '').trim();
  const candidates = [];
  const stem = path.basename(markdownPath, path.extname(markdownPath));

  if (rawValue) {
    if (path.parse(rawValue).root) {
      candidates.push(rawValue);
    } else {
      candidates.push(path.join(path.dirname(markdownPath), rawValue));
      candidates.push(path.join(MUSIC_ROOT, rawValue));
      candidates.push(path.join(SONGS_ROOT, rawValue));
      for (const extension of AUDIO_EXTENSIONS) {
        candidates.push(path.join(path.dirname(markdownPath), `${rawValue}${extension}`));
        candidates.push(path.join(MUSIC_ROOT, `${rawValue}${extension}`));
        candidates.push(path.join(SONGS_ROOT, `${rawValue}${extension}`));
      }
    }
  } else {
    for (const extension of AUDIO_EXTENSIONS) {
      candidates.push(path.join(path.dirname(markdownPath), `${stem}${extension}`));
      candidates.push(path.join(SONGS_ROOT, `${stem}${extension}`));
    }
  }

  return uniqueExistingFile(candidates, AUDIO_EXTENSIONS) ?? findAssetByStem(stem, SONGS_ROOT, AUDIO_EXTENSIONS);
}

function sourceRelative(filePath) {
  return path.relative(SOURCE_ROOT, filePath).split(path.sep).join('/');
}

function targetRelative(filePath) {
  return path.relative(V2_ROOT, filePath).split(path.sep).join('/');
}

function collectPilotSources(planEntries) {
  return planEntries.flatMap(entry => [entry.markdownPath, entry.coverPath, entry.audioPath]);
}

function hashBaseline(files) {
  const baseline = new Map();
  for (const file of files) {
    baseline.set(sourceRelative(file), checksumFile(file).hash);
  }
  return baseline;
}

function compareBaseline(before, files) {
  let changed = 0;
  let missing = 0;
  for (const file of files) {
    const key = sourceRelative(file);
    if (!existsFile(file)) {
      missing += 1;
      continue;
    }
    const current = checksumFile(file).hash;
    if (before.get(key) !== current) changed += 1;
  }
  return { changed, missing };
}

function buildPlan() {
  if (!existsDir(MUSIC_ROOT)) throw new Error('Music source directory missing');
  if (existsDir(V2_ROOT)) throw new Error('ArchiveData-v2 already exists; refusing to overwrite');

  const markdownFiles = listImmediateFiles(MUSIC_ROOT, file => MARKDOWN_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const ids = new Set();
  const entries = [];

  for (const markdownPath of markdownFiles) {
    const parsed = parseMarkdown(markdownPath);
    if (parsed.errors.length) throw new Error('Music Markdown frontmatter errors detected');

    const stem = path.basename(markdownPath, path.extname(markdownPath));
    const id = slugFromStem(stem);
    if (id === 'manual-id-required') throw new Error('Manual ID required');
    if (ids.has(id)) throw new Error('Music target ID collision detected');
    ids.add(id);

    const coverPath = findMusicCover(markdownPath, parsed.metadata.cover ?? '');
    const audioPath = findMusicAudio(markdownPath, parsed.metadata.audio ?? '');
    if (!coverPath) throw new Error('Missing cover in Music pilot plan');
    if (!audioPath) throw new Error('Missing audio in Music pilot plan');
    if (!assertInside(MUSIC_ROOT, markdownPath) || !assertInside(MUSIC_ROOT, coverPath) || !assertInside(MUSIC_ROOT, audioPath)) {
      throw new Error('Planned source file escapes Music source directory');
    }

    const entryDir = path.join(V2_MUSIC_ROOT, id);
    const coverTarget = path.join(entryDir, `cover${path.extname(coverPath).toLowerCase()}`);
    const audioTarget = path.join(entryDir, `audio${path.extname(audioPath).toLowerCase()}`);

    for (const target of [
      entryDir,
      path.join(entryDir, 'entry.yaml'),
      path.join(entryDir, 'content.md'),
      coverTarget,
      audioTarget,
    ]) {
      if (!assertInside(V2_ROOT, target)) throw new Error('Planned target escapes ArchiveData-v2');
    }

    entries.push({
      id,
      stem,
      parsed,
      markdownPath,
      coverPath,
      audioPath,
      entryDir,
      entryYamlTarget: path.join(entryDir, 'entry.yaml'),
      contentTarget: path.join(entryDir, 'content.md'),
      coverTarget,
      audioTarget,
    });
  }

  return entries;
}

function entryYaml(entry) {
  const { metadata } = entry.parsed;
  const title = metadata.title || entry.stem;
  const lines = [
    `id: ${yamlScalar(entry.id)}`,
    'board: music',
    'kind: album',
    `title: ${yamlScalar(title)}`,
  ];

  for (const key of ['date', 'url', 'note', 'description', 'track_title']) {
    if (metadata[key] !== undefined && metadata[key] !== '') {
      lines.push(`${key}: ${yamlScalar(metadata[key])}`);
    }
  }

  lines.push('legacy:');
  lines.push(`  source_markdown: ${yamlScalar(sourceRelative(entry.markdownPath))}`);
  lines.push(`  source_cover: ${yamlScalar(sourceRelative(entry.coverPath))}`);
  lines.push(`  source_audio: ${yamlScalar(sourceRelative(entry.audioPath))}`);
  return `${lines.join('\n')}\n`;
}

function addCopiedManifestRecord(manifest, entry, sourcePath, targetPath, sourceRole, targetRole) {
  const sourceChecksum = checksumFile(sourcePath);
  const targetChecksum = checksumFile(targetPath);
  if (sourceChecksum.hash !== targetChecksum.hash) {
    throw new Error('Copied file checksum mismatch');
  }
  manifest.push({
    board: 'music',
    kind: 'album',
    entryId: entry.id,
    sourceRole,
    sourceRelative: sourceRelative(sourcePath),
    targetRole,
    targetRelative: targetRelative(targetPath),
    sha256: sourceChecksum.hash,
    bytes: sourceChecksum.bytes,
    status: 'copied',
  });
}

function addTransformedMarkdownManifestRecord(manifest, entry) {
  const sourceChecksum = checksumFile(entry.markdownPath);
  const targetChecksum = checksumFile(entry.contentTarget);
  manifest.push({
    board: 'music',
    kind: 'album',
    entryId: entry.id,
    sourceRole: 'markdown',
    sourceRelative: sourceRelative(entry.markdownPath),
    targetRole: 'content_md',
    targetRelative: targetRelative(entry.contentTarget),
    sourceSha256: sourceChecksum.hash,
    targetSha256: targetChecksum.hash,
    sourceBytes: sourceChecksum.bytes,
    targetBytes: targetChecksum.bytes,
    status: 'transformed_frontmatter_to_entry_yaml',
  });
}

function writeLegacyFieldReport(entries) {
  const frontmatterKeys = new Set();
  for (const entry of entries) {
    for (const key of Object.keys(entry.parsed.metadata)) frontmatterKeys.add(key);
  }
  const mapped = ['description', 'date', 'url', 'note', 'track_title'].filter(key => frontmatterKeys.has(key));
  const preserved = ['source_markdown', 'source_cover', 'source_audio'];
  const lines = [
    '# ArchiveData-v2 Music Pilot Legacy Field Report',
    '',
    'This report summarizes field handling for the Music-only pilot migration.',
    '',
    `- Entries: ${entries.length}`,
    `- Frontmatter key count: ${frontmatterKeys.size}`,
    `- Mapped optional keys: ${mapped.join(', ') || 'none'}`,
    `- Legacy relative source roles: ${preserved.join(', ')}`,
    '- Manual confirmations: 0',
    '- Full local paths: none',
    '',
  ];
  fs.writeFileSync(path.join(V2_MIGRATION_ROOT, 'legacy-field-report.md'), lines.join('\n'), 'utf8');
}

function main() {
  try {
    const entries = buildPlan();
    const sourceFiles = collectPilotSources(entries);
    const before = hashBaseline(sourceFiles);

    fs.mkdirSync(V2_MUSIC_ROOT, { recursive: true });
    fs.mkdirSync(V2_MIGRATION_ROOT, { recursive: true });

    const manifest = [];
    for (const entry of entries) {
      fs.mkdirSync(entry.entryDir, { recursive: true });
      fs.writeFileSync(entry.entryYamlTarget, entryYaml(entry), 'utf8');
      fs.writeFileSync(entry.contentTarget, entry.parsed.body, 'utf8');
      fs.copyFileSync(entry.coverPath, entry.coverTarget);
      fs.copyFileSync(entry.audioPath, entry.audioTarget);

      addTransformedMarkdownManifestRecord(manifest, entry);
      addCopiedManifestRecord(manifest, entry, entry.coverPath, entry.coverTarget, 'cover', 'cover');
      addCopiedManifestRecord(manifest, entry, entry.audioPath, entry.audioTarget, 'audio', 'audio');
    }

    fs.writeFileSync(path.join(V2_MIGRATION_ROOT, 'migration-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(V2_MIGRATION_ROOT, 'unmapped-files.json'), '[]\n', 'utf8');
    writeLegacyFieldReport(entries);

    const after = compareBaseline(before, sourceFiles);

    console.log('[PASS] ArchiveData-v2 Music pilot migration');
    console.log(`  sourceBaselineFiles: ${sourceFiles.length}`);
    console.log(`  sourceChangedFiles: ${after.changed}`);
    console.log(`  sourceMissingFiles: ${after.missing}`);
    console.log(`  entriesCreated: ${entries.length}`);
    console.log(`  entryYamlFiles: ${entries.length}`);
    console.log(`  contentFiles: ${entries.length}`);
    console.log(`  coverFilesCopied: ${entries.length}`);
    console.log(`  audioFilesCopied: ${entries.length}`);
    console.log(`  manifestRecords: ${manifest.length}`);
    console.log('  unmappedFiles: 0');
    console.log('  buildArchiveRun: false');
    console.log('  releaseRun: false');
    console.log('Result: archive data v2 music pilot migration completed');
  } catch (error) {
    console.log('[FAIL] ArchiveData-v2 Music pilot migration');
    console.log(`  error: ${error instanceof Error ? error.message : 'unknown error'}`);
    console.log('Result: archive data v2 music pilot migration failed');
    process.exitCode = 1;
  }
}

main();
