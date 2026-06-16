import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = 'C:\\Users\\Yu\\OneDrive\\图片\\Data';
const MUSIC_ROOT = path.join(SOURCE_ROOT, 'Music');
const COVERS_ROOT = path.join(MUSIC_ROOT, 'Covers');
const SONGS_ROOT = path.join(MUSIC_ROOT, 'Songs');
const V2_ROOT = path.join(path.dirname(SOURCE_ROOT), 'ArchiveData-v2');

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
    .filter(predicate);
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

function parseFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { metadata: {}, hasFrontmatter: false, errors: [] };
  }

  const metadata = {};
  const errors = [];
  let closed = false;

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed === '---') {
      closed = true;
      break;
    }
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.includes(':')) {
      errors.push('frontmatter line missing colon');
      continue;
    }
    const [rawKey, ...rest] = trimmed.split(':');
    const key = rawKey.trim().toLowerCase();
    metadata[key] = parseScalar(rest.join(':'));
  }

  if (!closed) errors.push('frontmatter not closed');
  return { metadata, hasFrontmatter: true, errors };
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

function count(map, key, amount = 1) {
  map[key] = (map[key] ?? 0) + amount;
}

function formatCounts(map) {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(', ') || 'none';
}

function createPlannerStats() {
  return {
    markdownEntries: 0,
    readableMarkdown: 0,
    frontmatterErrors: 0,
    coverFiles: 0,
    songFiles: 0,
    plannedEntries: 0,
    plannedTargetDirectories: 0,
    targetRoles: {},
    idCollisions: 0,
    manualIdRequired: 0,
    missingCovers: 0,
    missingAudio: 0,
    manualConfirmations: {},
    existingV2Dir: existsDir(V2_ROOT),
  };
}

function main() {
  if (!existsDir(MUSIC_ROOT)) {
    console.log('[FAIL] ArchiveData-v2 Music pilot planner');
    console.log('  musicRootExists: false');
    console.log('  writeActions: 0');
    console.log('Result: archive data v2 music pilot planner failed');
    process.exitCode = 1;
    return;
  }

  const markdownFiles = listImmediateFiles(MUSIC_ROOT, file => MARKDOWN_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const coverFiles = existsDir(COVERS_ROOT)
    ? listImmediateFiles(COVERS_ROOT, file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    : [];
  const songFiles = existsDir(SONGS_ROOT)
    ? listImmediateFiles(SONGS_ROOT, file => AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase()))
    : [];

  const stats = createPlannerStats();
  stats.markdownEntries = markdownFiles.length;
  stats.coverFiles = coverFiles.length;
  stats.songFiles = songFiles.length;

  const ids = new Set();

  for (const markdownPath of markdownFiles) {
    const stem = path.basename(markdownPath, path.extname(markdownPath));
    const id = slugFromStem(stem);

    if (id === 'manual-id-required') {
      stats.manualIdRequired += 1;
      count(stats.manualConfirmations, 'music.manual_id_required');
    }
    if (ids.has(id)) {
      stats.idCollisions += 1;
      count(stats.manualConfirmations, 'music.id_collision');
    } else {
      ids.add(id);
    }

    let parsed;
    try {
      parsed = parseFrontmatter(markdownPath);
      stats.readableMarkdown += 1;
      stats.frontmatterErrors += parsed.errors.length;
    } catch {
      stats.frontmatterErrors += 1;
      count(stats.manualConfirmations, 'music.markdown_read_error');
      continue;
    }

    const cover = findMusicCover(markdownPath, parsed.metadata.cover ?? '');
    const audio = findMusicAudio(markdownPath, parsed.metadata.audio ?? '');

    stats.plannedEntries += 1;
    stats.plannedTargetDirectories += 1;
    count(stats.targetRoles, 'entry_yaml');
    count(stats.targetRoles, 'content_md');

    if (cover) {
      count(stats.targetRoles, 'cover');
    } else {
      stats.missingCovers += 1;
      count(stats.manualConfirmations, 'music.missing_cover');
    }

    if (audio) {
      count(stats.targetRoles, 'audio');
    } else {
      stats.missingAudio += 1;
      count(stats.manualConfirmations, 'music.missing_audio');
    }
  }

  const totalManualConfirmations = Object.values(stats.manualConfirmations).reduce((sum, value) => sum + value, 0);
  const targetRoleCount = Object.values(stats.targetRoles).reduce((sum, value) => sum + value, 0);
  const hasBlockingIssue = stats.frontmatterErrors > 0
    || stats.idCollisions > 0
    || stats.manualIdRequired > 0
    || stats.missingCovers > 0
    || stats.missingAudio > 0;
  const status = hasBlockingIssue ? 'WARN' : 'PASS';

  console.log(`[${status}] ArchiveData-v2 Music pilot planner`);
  console.log(`  markdownEntries: ${stats.markdownEntries}`);
  console.log(`  readableMarkdown: ${stats.readableMarkdown}`);
  console.log(`  frontmatterErrors: ${stats.frontmatterErrors}`);
  console.log(`  coverFiles: ${stats.coverFiles}`);
  console.log(`  songFiles: ${stats.songFiles}`);
  console.log(`  plannedEntries: ${stats.plannedEntries}`);
  console.log(`  plannedTargetDirectories: ${stats.plannedTargetDirectories}`);
  console.log(`  plannedTargetRoles: ${targetRoleCount}`);
  console.log(`  targetRoles: ${formatCounts(stats.targetRoles)}`);
  console.log(`  idCollisions: ${stats.idCollisions}`);
  console.log(`  manualIdRequired: ${stats.manualIdRequired}`);
  console.log(`  missingCovers: ${stats.missingCovers}`);
  console.log(`  missingAudio: ${stats.missingAudio}`);
  console.log(`  manualConfirmations: ${totalManualConfirmations}`);
  console.log(`  manualConfirmationReasons: ${formatCounts(stats.manualConfirmations)}`);
  console.log(`  existingArchiveDataV2Dir: ${stats.existingV2Dir}`);
  console.log('  writeActions: 0');
  console.log(`Result: archive data v2 music pilot planner ${status === 'PASS' ? 'passed' : 'completed with warnings'}`);
}

main();
