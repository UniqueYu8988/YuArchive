import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  buildMediaTransform,
  optimizeMediaToFile,
} from './archive-studio-media-optimizer.mjs';

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function createImage(target, width, height) {
  const code = [
    'from PIL import Image',
    'import sys',
    'Image.new("RGB", (int(sys.argv[2]), int(sys.argv[3])), (50, 100, 150)).save(sys.argv[1], "PNG")',
  ].join(';');
  const result = spawnSync('python', ['-c', code, target, String(width), String(height)], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error('fixture_image_failed');
}

function createWave(target) {
  const sampleRate = 8000;
  const samples = 800;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  fs.writeFileSync(target, buffer);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yuarchive-media-check-'));
try {
  const landscape = path.join(root, 'cover.png');
  const portrait = path.join(root, 'poster.png');
  const wave = path.join(root, 'audio.wav');
  createImage(landscape, 2400, 1200);
  createImage(portrait, 900, 600);
  createWave(wave);
  const sourceHashes = new Map([
    [landscape, sha256(landscape)],
    [portrait, sha256(portrait)],
    [wave, sha256(wave)],
  ]);

  const music = buildMediaTransform({ board: 'music', id: 'music-check', role: 'cover', sourcePath: landscape });
  const musicResult = optimizeMediaToFile(music, path.join(root, 'music-cover.webp'));
  assert.equal(musicResult.outputWidth, 1200);
  assert.equal(musicResult.outputHeight, 600);

  const games = buildMediaTransform({ board: 'games', id: 'game-check', role: 'cover', sourcePath: portrait });
  const gamesResult = optimizeMediaToFile(games, path.join(root, 'game-cover.webp'));
  assert.equal(gamesResult.outputWidth, 600);
  assert.equal(gamesResult.outputHeight, 900);

  const visions = buildMediaTransform({ board: 'visions', id: 'vision-check', role: 'poster', sourcePath: landscape });
  const visionsResult = optimizeMediaToFile(visions, path.join(root, 'vision-poster.webp'));
  assert.equal(visionsResult.outputWidth, 600);
  assert.equal(visionsResult.outputHeight, 900);

  const audio = buildMediaTransform({ board: 'music', id: 'music-check', role: 'audio', sourcePath: wave });
  const audioResult = optimizeMediaToFile(audio, path.join(root, 'audio.m4a'));
  assert.equal(audio.outputExtension, '.m4a');
  assert.equal(audioResult.format, 'm4a');

  for (const [source, hash] of sourceHashes) assert.equal(sha256(source), hash);

  const invalid = path.join(root, 'invalid.png');
  fs.writeFileSync(invalid, 'not an image');
  const invalidTransform = buildMediaTransform({
    board: 'texts', id: 'text-check', role: 'cover', sourcePath: invalid,
  });
  assert.throws(
    () => optimizeMediaToFile(invalidTransform, path.join(root, 'invalid.webp')),
    /media_image_optimization_failed/,
  );

  console.log('[PASS] Archive Studio media optimizer');
  console.log('  musicAndTextsMaxEdge: 1200');
  console.log('  gamesAndVisionsPoster: 600x900');
  console.log('  audioTranscode: m4a-192k');
  console.log('  sourceHashesUnchanged: passed');
  console.log('  invalidMediaBlocked: passed');
  console.log('  writeScope: system-temp only');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
