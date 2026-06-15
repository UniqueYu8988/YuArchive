import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = 'C:\\Users\\Yu\\OneDrive\\图片\\Data';
const MUSIC_ROOT = path.join(SOURCE_ROOT, 'Music');
const COVERS_ROOT = path.join(MUSIC_ROOT, 'Covers');
const SONGS_ROOT = path.join(MUSIC_ROOT, 'Songs');

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

  const errors = [];
  const metadata = {};
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
    const rawPath = path.parse(rawValue).root ? rawValue : null;
    if (rawPath) {
      candidates.push(rawPath);
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
  for (const ext of IMAGE_EXTENSIONS) {
    candidates.push(path.join(path.dirname(markdownPath), `${stem}${ext}`));
    candidates.push(path.join(COVERS_ROOT, `${stem}${ext}`));
  }

  return uniqueExistingFile(candidates, IMAGE_EXTENSIONS) ?? findAssetByStem(stem, COVERS_ROOT, IMAGE_EXTENSIONS);
}

function findMusicAudio(markdownPath, audioValue) {
  const rawValue = String(audioValue ?? '').trim();
  const candidates = [];
  const stem = path.basename(markdownPath, path.extname(markdownPath));

  if (rawValue) {
    const rawPath = path.parse(rawValue).root ? rawValue : null;
    if (rawPath) {
      candidates.push(rawPath);
    } else {
      candidates.push(path.join(path.dirname(markdownPath), rawValue));
      candidates.push(path.join(MUSIC_ROOT, rawValue));
      candidates.push(path.join(SONGS_ROOT, rawValue));
      for (const ext of AUDIO_EXTENSIONS) {
        candidates.push(path.join(path.dirname(markdownPath), `${rawValue}${ext}`));
        candidates.push(path.join(MUSIC_ROOT, `${rawValue}${ext}`));
        candidates.push(path.join(SONGS_ROOT, `${rawValue}${ext}`));
      }
    }
  } else {
    for (const ext of AUDIO_EXTENSIONS) {
      candidates.push(path.join(path.dirname(markdownPath), `${stem}${ext}`));
      candidates.push(path.join(SONGS_ROOT, `${stem}${ext}`));
    }
  }

  return uniqueExistingFile(candidates, AUDIO_EXTENSIONS) ?? findAssetByStem(stem, SONGS_ROOT, AUDIO_EXTENSIONS);
}

function statusFromCounts(requiredMissing, warningCount = 0) {
  if (requiredMissing > 0) return 'FAIL';
  if (warningCount > 0) return 'WARN';
  return 'PASS';
}

function main() {
  const fatal = [];
  if (!existsDir(MUSIC_ROOT)) fatal.push('Music directory missing');
  if (fatal.length) {
    console.log('[FAIL] Music media shape check');
    console.log(`  fatalIssues: ${fatal.length}`);
    console.log('Result: music media shape check failed');
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

  const stats = {
    markdownEntries: markdownFiles.length,
    readableMarkdown: 0,
    withFrontmatter: 0,
    frontmatterErrors: 0,
    missingTitleOrStem: 0,
    coversDirExists: existsDir(COVERS_ROOT),
    songsDirExists: existsDir(SONGS_ROOT),
    coverFiles: coverFiles.length,
    songFiles: songFiles.length,
    explicitCoverRefs: 0,
    explicitAudioRefs: 0,
    matchedCovers: 0,
    missingCovers: 0,
    matchedAudio: 0,
    missingAudio: 0,
    suspiciousUnusedCovers: 0,
    suspiciousUnusedSongs: 0,
  };

  const matchedCoverFiles = new Set();
  const matchedSongFiles = new Set();

  for (const file of markdownFiles) {
    let parsed;
    try {
      parsed = parseFrontmatter(file);
      stats.readableMarkdown += 1;
    } catch {
      stats.frontmatterErrors += 1;
      continue;
    }

    if (parsed.hasFrontmatter) stats.withFrontmatter += 1;
    stats.frontmatterErrors += parsed.errors.length;

    const stem = path.basename(file, path.extname(file)).trim();
    const title = String(parsed.metadata.title ?? stem).trim();
    if (!title && !stem) stats.missingTitleOrStem += 1;

    const coverValue = parsed.metadata.cover ?? '';
    const audioValue = parsed.metadata.audio ?? '';
    if (String(coverValue).trim()) stats.explicitCoverRefs += 1;
    if (String(audioValue).trim()) stats.explicitAudioRefs += 1;

    const cover = findMusicCover(file, coverValue);
    if (cover) {
      stats.matchedCovers += 1;
      matchedCoverFiles.add(path.resolve(cover).toLowerCase());
    } else {
      stats.missingCovers += 1;
    }

    const audio = findMusicAudio(file, audioValue);
    if (audio) {
      stats.matchedAudio += 1;
      matchedSongFiles.add(path.resolve(audio).toLowerCase());
    } else {
      stats.missingAudio += 1;
    }
  }

  stats.suspiciousUnusedCovers = coverFiles.filter(file => !matchedCoverFiles.has(path.resolve(file).toLowerCase())).length;
  stats.suspiciousUnusedSongs = songFiles.filter(file => !matchedSongFiles.has(path.resolve(file).toLowerCase())).length;

  const markdownStatus = statusFromCounts(markdownFiles.length ? 0 : 1, stats.frontmatterErrors + stats.missingTitleOrStem);
  const coverStatus = statusFromCounts(0, stats.missingCovers + stats.suspiciousUnusedCovers);
  const audioStatus = statusFromCounts(0, stats.missingAudio + stats.suspiciousUnusedSongs);
  const worst = [markdownStatus, coverStatus, audioStatus].includes('FAIL')
    ? 'FAIL'
    : [markdownStatus, coverStatus, audioStatus].includes('WARN')
      ? 'WARN'
      : 'PASS';

  console.log(`[${markdownStatus}] Music Markdown`);
  console.log(`  markdownEntries: ${stats.markdownEntries}`);
  console.log(`  readableMarkdown: ${stats.readableMarkdown}`);
  console.log(`  withFrontmatter: ${stats.withFrontmatter}`);
  console.log(`  frontmatterErrors: ${stats.frontmatterErrors}`);
  console.log(`  missingTitleOrStem: ${stats.missingTitleOrStem}`);

  console.log(`[${coverStatus}] Music Covers`);
  console.log(`  coversDirExists: ${stats.coversDirExists}`);
  console.log(`  coverFiles: ${stats.coverFiles}`);
  console.log(`  explicitCoverRefs: ${stats.explicitCoverRefs}`);
  console.log(`  matchedCovers: ${stats.matchedCovers}`);
  console.log(`  missingCovers: ${stats.missingCovers}`);
  console.log(`  suspiciousUnusedCovers: ${stats.suspiciousUnusedCovers}`);

  console.log(`[${audioStatus}] Music Songs`);
  console.log(`  songsDirExists: ${stats.songsDirExists}`);
  console.log(`  songFiles: ${stats.songFiles}`);
  console.log(`  explicitAudioRefs: ${stats.explicitAudioRefs}`);
  console.log(`  matchedAudio: ${stats.matchedAudio}`);
  console.log(`  missingAudio: ${stats.missingAudio}`);
  console.log(`  suspiciousUnusedSongs: ${stats.suspiciousUnusedSongs}`);

  const summary = worst === 'FAIL' ? 'failed' : worst === 'WARN' ? 'completed with warnings' : 'passed';
  console.log(`Result: music media shape check ${summary}`);
  process.exitCode = worst === 'FAIL' ? 1 : 0;
}

main();

