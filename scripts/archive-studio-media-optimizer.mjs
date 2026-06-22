import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_HELPER = path.join(HERE, 'archive-studio-image-optimize.py');
const TRANSCODE_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.aac', '.ogg']);

const IMAGE_PROFILES = {
  music: { cover: 'music-cover' },
  texts: { cover: 'texts-cover' },
  visions: { poster: 'visions-poster' },
  games: { cover: 'games-cover' },
};

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function buildMediaTransform({ board, id, role, sourcePath }) {
  const sourceExtension = path.extname(sourcePath).toLowerCase();
  const imageProfile = IMAGE_PROFILES[board]?.[role];
  const kind = role === 'audio' ? 'audio' : 'image';
  if (kind === 'image' && !imageProfile) throw new Error('media_image_profile_missing');
  const transcodeAudio = role === 'audio' && TRANSCODE_AUDIO_EXTENSIONS.has(sourceExtension);
  const outputExtension = kind === 'image' ? '.webp' : transcodeAudio ? '.m4a' : sourceExtension;
  const profile = kind === 'image' ? imageProfile : transcodeAudio ? 'audio-aac-192k' : 'audio-copy';
  const relativePath = path.posix.join('studio_media', board, id, `${role}${outputExtension}`);
  return {
    board,
    id,
    role,
    kind,
    sourcePath,
    sourceExtension,
    sourceBytes: fs.statSync(sourcePath).size,
    sourceSha256: sha256(sourcePath),
    outputExtension,
    relativePath,
    publicPath: relativePath,
    profile,
  };
}

function runImageOptimizer(transform, targetPath) {
  const result = spawnSync('python', [
    '-X', 'utf8',
    IMAGE_HELPER,
    '--source', transform.sourcePath,
    '--target', targetPath,
    '--profile', transform.profile,
  ], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('media_image_optimization_failed');
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    throw new Error('media_image_metadata_invalid');
  }
}

function runAudioOptimizer(transform, targetPath) {
  if (transform.profile === 'audio-copy') {
    fs.copyFileSync(transform.sourcePath, targetPath);
    return { format: transform.outputExtension.slice(1), profile: transform.profile };
  }
  const result = spawnSync('ffmpeg', [
    '-y',
    '-i', transform.sourcePath,
    '-map_metadata', '-1',
    '-vn',
    '-c:a', 'aac',
    '-b:a', '192k',
    targetPath,
  ], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('media_audio_optimization_failed');
  return { format: 'm4a', profile: transform.profile };
}

export function optimizeMediaToFile(transform, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const metadata = transform.kind === 'image'
    ? runImageOptimizer(transform, targetPath)
    : runAudioOptimizer(transform, targetPath);
  if (!fs.statSync(targetPath).isFile() || fs.statSync(targetPath).size === 0) {
    throw new Error('media_optimized_output_missing');
  }
  return {
    ...metadata,
    outputBytes: fs.statSync(targetPath).size,
    outputSha256: sha256(targetPath),
  };
}
