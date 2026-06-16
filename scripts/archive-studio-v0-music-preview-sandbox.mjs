import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPreviewSafe, buildMusicAlbumPreview } from './archive-studio-v0-music-preview-core.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_PAYLOAD_FILE = path.join(
  PROJECT_ROOT,
  'docs',
  'examples',
  'archive-studio-v0-music-album-payload.sample.json',
);
const OUTPUT_DIR = path.join(os.tmpdir(), 'yuarchive-archive-studio-v0-sandbox');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'music-album-preview.json');

function resolveProjectPayloadPath(inputPath = DEFAULT_PAYLOAD_FILE) {
  const resolved = path.resolve(PROJECT_ROOT, inputPath);
  const relative = path.relative(PROJECT_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Payload file must be inside the project directory');
  }
  if (!relative.endsWith('.json')) {
    throw new Error('Payload file must be a JSON file');
  }
  return resolved;
}

async function readPayload() {
  const payloadFile = resolveProjectPayloadPath(process.argv[2] || DEFAULT_PAYLOAD_FILE);
  const payloadText = await readFile(payloadFile, 'utf8');
  const payload = JSON.parse(payloadText);
  return {
    payload,
    payloadLabel: path.relative(PROJECT_ROOT, payloadFile).split(path.sep).join('/'),
  };
}

const { payload, payloadLabel } = await readPayload();
const preview = buildMusicAlbumPreview(payload);
assertPreviewSafe(preview);

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT_FILE, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');

console.log('[PASS] Archive Studio v0 music sandbox preview');
console.log(`  payload: ${payloadLabel}`);
console.log('  output: system-temp/yuarchive-archive-studio-v0-sandbox/music-album-preview.json');
console.log(`  ok: ${preview.ok}`);
console.log(`  mode: ${preview.mode}`);
console.log(`  operations: ${preview.operations.length}`);
console.log(`  warnings: ${preview.warnings.length}`);
console.log(`  errors: ${preview.errors.length}`);
console.log(`  writeScope: system-temp-only`);
console.log('Result: archive studio v0 music sandbox preview generated');
