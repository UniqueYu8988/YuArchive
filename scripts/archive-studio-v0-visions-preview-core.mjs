import path from 'node:path';
import { PERIOD_RULES } from './archive-data-v2-visions-core.mjs';

const ALLOWED_KINDS = new Set(['movie', 'series']);
const ALLOWED_POSTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const ENTRY_ID_PATTERN = /^vision-\d{8}-[a-f0-9]{8}$/;

function normalizeExtension(value) {
  const extension = String(value ?? '').trim().toLowerCase();
  if (!extension) return '';
  return extension.startsWith('.') ? extension : `.${extension}`;
}

function issue(code, message, field) {
  return { code, message, field };
}

function safeTarget(id, kind, posterExtension) {
  const safeId = ENTRY_ID_PATTERN.test(id) ? id : 'vision-00000000-00000000';
  const safeKind = ALLOWED_KINDS.has(kind) ? kind : 'movie';
  const entryRoot = `entries/visions/${safeKind}/${safeId}`;
  return {
    entryId: safeId,
    entryRelativeDir: entryRoot,
    entryYaml: `${entryRoot}/entry.yaml`,
    poster: `${entryRoot}/poster${posterExtension || '.invalid'}`,
  };
}

export function buildVisionsPreview(payload) {
  const errors = [];
  const warnings = [];
  const mode = String(payload?.mode ?? '');
  const board = String(payload?.board ?? '');
  const kind = String(payload?.kind ?? '');
  const id = String(payload?.id ?? '').trim();
  const fields = payload?.fields && typeof payload.fields === 'object' ? payload.fields : {};
  const poster = payload?.assets?.poster;
  const posterExtension = normalizeExtension(poster?.extension);
  const title = String(fields.title ?? '').trim();
  const period = String(fields.period ?? '').trim();
  const quote = String(fields.quote ?? '').trim();
  const url = String(fields.url ?? '').trim();
  const cinema = fields.cinema === true;

  if (mode !== 'create') errors.push(issue('invalid_mode', 'mode must be create', 'mode'));
  if (board !== 'visions') errors.push(issue('invalid_board', 'board must be visions', 'board'));
  if (!ALLOWED_KINDS.has(kind)) errors.push(issue('invalid_kind', 'kind is not supported', 'kind'));
  if (!ENTRY_ID_PATTERN.test(id)) errors.push(issue('invalid_entry_id', 'entry id must use vision-YYYYMMDD-xxxxxxxx', 'id'));
  if (!title) errors.push(issue('missing_title', 'title is required', 'fields.title'));
  if (!PERIOD_RULES.has(period)) errors.push(issue('invalid_period', 'period is not supported', 'fields.period'));
  if (!poster) errors.push(issue('missing_poster', 'poster is required', 'assets.poster'));
  if (poster && !ALLOWED_POSTER_EXTENSIONS.has(posterExtension)) {
    errors.push(issue('invalid_poster_extension', 'poster extension is not allowed', 'assets.poster.extension'));
  }
  if (url && !/^https?:\/\//i.test(url)) errors.push(issue('invalid_url', 'url must use http or https', 'fields.url'));
  if (!quote) warnings.push(issue('quote_empty', 'quote is empty', 'fields.quote'));
  if (!url) warnings.push(issue('url_empty', 'url is empty', 'fields.url'));

  const target = safeTarget(id, kind, posterExtension);
  const operations = [
    { type: 'create', role: 'entry_yaml', relativePath: target.entryYaml, willOverwrite: false },
    { type: 'create', role: 'poster', relativePath: target.poster, willOverwrite: false },
  ];
  return {
    ok: errors.length === 0,
    mode,
    board,
    kind,
    id,
    normalized: {
      fields: { title, period, cinema, quote, url },
      assets: poster ? {
        poster: {
          source: 'selected-file',
          originalName: path.basename(String(poster.originalName ?? '')),
          extension: posterExtension,
        },
      } : {},
    },
    target,
    operations,
    warnings,
    errors,
  };
}

export function assertVisionsPreviewSafe(preview) {
  const paths = [
    preview.target.entryRelativeDir,
    preview.target.entryYaml,
    preview.target.poster,
    ...preview.operations.map(operation => operation.relativePath),
  ];
  for (const relativePath of paths) {
    if (
      path.isAbsolute(relativePath)
      || relativePath.includes('\\')
      || relativePath.split('/').includes('..')
      || !relativePath.startsWith('entries/visions/')
    ) throw new Error('unsafe_visions_preview_path');
  }
  if (preview.operations.some(operation => operation.type !== 'create' || operation.willOverwrite)) {
    throw new Error('unsafe_visions_preview_operation');
  }
  return true;
}

export const VISIONS_PREVIEW_RULES = {
  kinds: [...ALLOWED_KINDS],
  periods: [...PERIOD_RULES.keys()],
  posterExtensions: [...ALLOWED_POSTER_EXTENSIONS],
  entryIdPattern: ENTRY_ID_PATTERN.source,
};
