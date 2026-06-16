import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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

const samplePayload = {
  mode: 'create',
  board: 'music',
  kind: 'album',
  id: 'archive-studio-sandbox-album',
  fields: {
    title: 'Archive Studio Sandbox Album',
    date: '2026',
    description: 'Sandbox preview payload for Archive Studio v0.',
    track_title: 'Sandbox Track',
    url: 'https://example.com',
    note: '',
    legacy: {},
  },
  content: {
    markdown: 'Sandbox content preview. This text is only written to the preview summary.',
  },
  assets: {
    cover: {
      source: 'selected-file',
      originalName: 'cover.jpg',
      extension: '.jpg',
    },
    audio: {
      source: 'selected-file',
      originalName: 'audio.mp3',
      extension: '.mp3',
    },
  },
  options: {
    allowOverwriteEntry: false,
    allowOverwriteAssets: false,
    runCheckAfterWrite: true,
    backupBeforeOverwrite: true,
  },
};

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

const preview = buildPreview(samplePayload);
assertPreviewSafe(preview);

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT_FILE, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');

console.log('[PASS] Archive Studio v0 music sandbox preview');
console.log('  output: system-temp/yuarchive-archive-studio-v0-sandbox/music-album-preview.json');
console.log(`  ok: ${preview.ok}`);
console.log(`  mode: ${preview.mode}`);
console.log(`  operations: ${preview.operations.length}`);
console.log(`  warnings: ${preview.warnings.length}`);
console.log(`  errors: ${preview.errors.length}`);
console.log(`  writeScope: system-temp-only`);
console.log('Result: archive studio v0 music sandbox preview generated');
