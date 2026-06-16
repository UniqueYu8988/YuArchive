import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const allowedCoverExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedAudioExtensions = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac']);
const allowedOperations = new Set([
  'create_directory',
  'write_yaml',
  'write_markdown',
  'copy_asset',
  'backup_file',
  'run_check',
]);

function normalizeRelativePath(...segments) {
  const joined = path.posix.join(...segments);
  if (joined.startsWith('../') || joined.includes('/../') || path.posix.isAbsolute(joined)) {
    throw new Error(`Unsafe relative path generated for ${segments.join('/')}`);
  }
  return joined;
}

function countLines(value) {
  if (!value) return 0;
  return String(value).split(/\r\n|\r|\n/).length;
}

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

function validatePayload(payload) {
  const errors = [];
  const warnings = [];

  if (!['create', 'update'].includes(payload.mode)) {
    errors.push({ code: 'invalid_mode', message: 'mode must be create or update', path: 'mode' });
  }

  if (payload.board !== 'music') {
    errors.push({ code: 'invalid_board', message: 'board must be music', path: 'board' });
  }

  if (payload.kind !== 'album') {
    errors.push({ code: 'invalid_kind', message: 'kind must be album', path: 'kind' });
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(payload.id || '')) {
    errors.push({ code: 'invalid_entry_id', message: 'entry id must be a lowercase slug', path: 'id' });
  }

  if (!payload.fields?.title?.trim()) {
    errors.push({ code: 'missing_title', message: 'title is required', path: 'fields.title' });
  }

  if (!payload.content?.markdown?.trim()) {
    warnings.push({ code: 'content_empty', message: 'content.md is empty', path: 'content.markdown' });
  }

  const coverExtension = payload.assets?.cover?.extension?.toLowerCase();
  if (coverExtension && !allowedCoverExtensions.has(coverExtension)) {
    errors.push({ code: 'invalid_cover_extension', message: 'cover extension is not allowed', path: 'assets.cover.extension' });
  }

  const audioExtension = payload.assets?.audio?.extension?.toLowerCase();
  if (audioExtension && !allowedAudioExtensions.has(audioExtension)) {
    errors.push({ code: 'invalid_audio_extension', message: 'audio extension is not allowed', path: 'assets.audio.extension' });
  }

  return { errors, warnings };
}

function buildPreview(payload) {
  const { errors, warnings } = validatePayload(payload);
  const entryRelativeDir = normalizeRelativePath('entries', 'music', 'album', payload.id || 'invalid-id');
  const coverExtension = payload.assets?.cover?.extension?.toLowerCase() || '.jpg';
  const audioExtension = payload.assets?.audio?.extension?.toLowerCase() || '.mp3';

  const target = {
    entryId: payload.id,
    entryRelativeDir,
    entryYaml: normalizeRelativePath(entryRelativeDir, 'entry.yaml'),
    contentMd: normalizeRelativePath(entryRelativeDir, 'content.md'),
    cover: normalizeRelativePath(entryRelativeDir, `cover${coverExtension}`),
    audio: normalizeRelativePath(entryRelativeDir, `audio${audioExtension}`),
  };

  const operations = [
    {
      type: 'create_directory',
      relativePath: target.entryRelativeDir,
      willOverwrite: false,
      requiresBackup: false,
    },
    {
      type: 'write_yaml',
      relativePath: target.entryYaml,
      willOverwrite: payload.mode === 'update',
      requiresBackup: payload.mode === 'update',
    },
    {
      type: 'write_markdown',
      relativePath: target.contentMd,
      willOverwrite: payload.mode === 'update',
      requiresBackup: payload.mode === 'update',
    },
    {
      type: 'copy_asset',
      role: 'cover',
      relativePath: target.cover,
      willOverwrite: payload.mode === 'update' && payload.assets?.cover?.source !== 'keep-existing',
      requiresBackup: payload.mode === 'update' && payload.assets?.cover?.source !== 'keep-existing',
    },
    {
      type: 'copy_asset',
      role: 'audio',
      relativePath: target.audio,
      willOverwrite: payload.mode === 'update' && payload.assets?.audio?.source !== 'keep-existing',
      requiresBackup: payload.mode === 'update' && payload.assets?.audio?.source !== 'keep-existing',
    },
    {
      type: 'run_check',
      relativePath: 'scripts/check-archive-data-v2-music-shape.mjs',
      willOverwrite: false,
      requiresBackup: false,
    },
  ];

  for (const operation of operations) {
    if (!allowedOperations.has(operation.type)) {
      errors.push({ code: 'operation_not_allowed', message: 'operation type is not allowed', path: `operations.${operation.type}` });
    }
  }

  return {
    ok: errors.length === 0,
    mode: payload.mode,
    target,
    summary: {
      titlePresent: Boolean(payload.fields?.title?.trim()),
      descriptionChars: payload.fields?.description?.length || 0,
      contentChars: payload.content?.markdown?.length || 0,
      contentLines: countLines(payload.content?.markdown),
      hasCover: Boolean(payload.assets?.cover),
      hasAudio: Boolean(payload.assets?.audio),
      legacyKeys: Object.keys(payload.fields?.legacy || {}).length,
    },
    operations,
    warnings,
    errors,
    checks: [
      {
        command: 'node scripts/check-archive-data-v2-music-shape.mjs',
        required: true,
      },
      {
        command: 'node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs',
        required: false,
      },
    ],
  };
}

function assertPreviewSafe(preview) {
  const serialized = JSON.stringify(preview);
  if (/[A-Za-z]:[\\/]+Users[\\/]/.test(serialized)) {
    throw new Error('Preview contains a full Windows user path');
  }
  if (/password|secret|token|api_key|apikey|access_token|refresh_token|SESSDATA/i.test(serialized)) {
    throw new Error('Preview contains a sensitive field marker');
  }
  for (const operation of preview.operations) {
    if (path.win32.isAbsolute(operation.relativePath) || path.posix.isAbsolute(operation.relativePath)) {
      throw new Error(`Operation path must be relative: ${operation.type}`);
    }
  }
}

const { payload, payloadLabel } = await readPayload();
const preview = buildPreview(payload);
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
