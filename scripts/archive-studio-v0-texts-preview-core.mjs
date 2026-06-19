import path from 'node:path';
import { SECTION_KIND_RULES } from './archive-data-v2-texts-core.mjs';

const ALLOWED_KINDS = new Set(['article', 'book_note', 'series_note']);
const ALLOWED_COVER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ENTRY_ID_PATTERN = /^text-\d{8}-[a-f0-9]{8}$/;

function normalizeExtension(value) {
  const extension = String(value ?? '').trim().toLowerCase();
  if (!extension) return '';
  return extension.startsWith('.') ? extension : `.${extension}`;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => String(item ?? '').trim()).filter(Boolean))];
}

function issue(code, message, field) {
  return { code, message, field };
}

function safeTarget(id, kind, coverExtension) {
  const safeId = ENTRY_ID_PATTERN.test(id) ? id : 'text-00000000-00000000';
  const safeKind = ALLOWED_KINDS.has(kind) ? kind : 'article';
  const entryRoot = `entries/texts/${safeKind}/${safeId}`;
  return {
    entryId: safeId,
    entryRelativeDir: entryRoot,
    entryYaml: `${entryRoot}/entry.yaml`,
    contentMd: `${entryRoot}/content.md`,
    cover: coverExtension ? `${entryRoot}/cover${coverExtension}` : '',
  };
}

export function buildTextsPreview(payload) {
  const errors = [];
  const warnings = [];
  const mode = String(payload?.mode ?? '');
  const board = String(payload?.board ?? '');
  const kind = String(payload?.kind ?? '');
  const id = String(payload?.id ?? '').trim();
  const fields = payload?.fields && typeof payload.fields === 'object' ? payload.fields : {};
  const content = String(payload?.content?.markdown ?? '');
  const cover = payload?.assets?.cover;
  const coverExtension = normalizeExtension(cover?.extension);
  const title = String(fields.title ?? '').trim();
  const section = String(fields.section ?? '').trim();
  const date = String(fields.date ?? '').trim();
  const tags = normalizeTags(fields.tags);

  if (mode !== 'create') errors.push(issue('invalid_mode', 'mode must be create', 'mode'));
  if (board !== 'texts') errors.push(issue('invalid_board', 'board must be texts', 'board'));
  if (!ALLOWED_KINDS.has(kind)) errors.push(issue('invalid_kind', 'kind is not supported', 'kind'));
  if (!ENTRY_ID_PATTERN.test(id)) errors.push(issue('invalid_entry_id', 'entry id must use text-YYYYMMDD-xxxxxxxx', 'id'));
  if (!title) errors.push(issue('missing_title', 'title is required', 'fields.title'));
  if (!content.trim()) errors.push(issue('missing_content', 'content.md must not be empty', 'content.markdown'));
  if (SECTION_KIND_RULES.get(section) !== kind) {
    errors.push(issue('section_kind_mismatch', 'section does not belong to selected kind', 'fields.section'));
  }
  if (kind === 'book_note') {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(issue('invalid_optional_date', 'book note date must be YYYY-MM-DD or empty', 'fields.date'));
    }
    if (!cover) errors.push(issue('missing_cover', 'book note cover is required', 'assets.cover'));
    if (cover && !ALLOWED_COVER_EXTENSIONS.has(coverExtension)) {
      errors.push(issue('invalid_cover_extension', 'cover extension is not allowed', 'assets.cover.extension'));
    }
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(issue('invalid_required_date', 'date must be YYYY-MM-DD', 'fields.date'));
    }
    if (cover) errors.push(issue('unexpected_cover', 'cover is not supported for this kind', 'assets.cover'));
  }
  if (!String(fields.summary ?? '').trim()) warnings.push(issue('summary_empty', 'summary is empty', 'fields.summary'));
  if (tags.length !== (Array.isArray(fields.tags) ? fields.tags.length : 0)) {
    warnings.push(issue('tags_normalized', 'empty or duplicate tags will be removed', 'fields.tags'));
  }

  const target = safeTarget(id, kind, kind === 'book_note' ? coverExtension : '');
  const operations = [
    { type: 'create', role: 'entry_yaml', relativePath: target.entryYaml, willOverwrite: false },
    { type: 'create', role: 'content_md', relativePath: target.contentMd, willOverwrite: false },
    ...(target.cover ? [{ type: 'create', role: 'cover', relativePath: target.cover, willOverwrite: false }] : []),
  ];
  return {
    ok: errors.length === 0,
    mode,
    board,
    kind,
    id,
    normalized: {
      fields: {
        title,
        section,
        date,
        author: String(fields.author ?? '').trim(),
        summary: String(fields.summary ?? '').trim(),
        tags,
      },
      content: { markdown: content },
      assets: cover ? {
        cover: {
          source: 'selected-file',
          originalName: path.basename(String(cover.originalName ?? '')),
          extension: coverExtension,
        },
      } : {},
    },
    target,
    operations,
    warnings,
    errors,
  };
}

export function assertTextsPreviewSafe(preview) {
  const relativePaths = [
    preview.target.entryRelativeDir,
    preview.target.entryYaml,
    preview.target.contentMd,
    preview.target.cover,
    ...preview.operations.map(operation => operation.relativePath),
  ].filter(Boolean);
  for (const relativePath of relativePaths) {
    if (
      path.isAbsolute(relativePath)
      || relativePath.includes('\\')
      || relativePath.split('/').includes('..')
      || !relativePath.startsWith('entries/texts/')
    ) throw new Error('unsafe_texts_preview_path');
  }
  if (preview.operations.some(operation => operation.type !== 'create' || operation.willOverwrite)) {
    throw new Error('unsafe_texts_preview_operation');
  }
  return true;
}

export const TEXTS_PREVIEW_RULES = {
  kinds: [...ALLOWED_KINDS],
  coverExtensions: [...ALLOWED_COVER_EXTENSIONS],
  entryIdPattern: ENTRY_ID_PATTERN.source,
};

