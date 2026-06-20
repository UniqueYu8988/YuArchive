import path from 'node:path';
import { GENRE_CHOICES, PLATFORM_CHOICES } from './archive-data-v2-games-core.mjs';

const ALLOWED_COVER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const ENTRY_ID_PATTERN = /^game-\d{8}-[a-f0-9]{8}$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function normalizeExtension(value) {
  const extension = String(value ?? '').trim().toLowerCase();
  if (!extension) return '';
  return extension.startsWith('.') ? extension : `.${extension}`;
}

function issue(code, message, field) {
  return { code, message, field };
}

function safeTarget(id, coverExtension) {
  const safeId = ENTRY_ID_PATTERN.test(id) ? id : 'game-00000000-00000000';
  const entryRoot = `entries/games/normal_game/${safeId}`;
  return {
    entryId: safeId,
    entryRelativeDir: entryRoot,
    entryYaml: `${entryRoot}/entry.yaml`,
    cover: `${entryRoot}/cover${coverExtension || '.invalid'}`,
  };
}

export function buildGamesPreview(payload) {
  const errors = [];
  const warnings = [];
  const mode = String(payload?.mode ?? '');
  const board = String(payload?.board ?? '');
  const kind = String(payload?.kind ?? '');
  const id = String(payload?.id ?? '').trim();
  const fields = payload?.fields && typeof payload.fields === 'object' ? payload.fields : {};
  const cover = payload?.assets?.cover;
  const coverExtension = normalizeExtension(cover?.extension);
  const title = String(fields.title ?? '').trim();
  const year = Number(fields.year);
  const metadataEnabled = fields.metadata_enabled !== false;
  const englishTitle = String(fields.english_title ?? '').trim();
  const url = String(fields.url ?? '').trim();
  const platform = String(fields.platform ?? '').trim().toLowerCase();
  const price = String(fields.price ?? '').trim();
  const ratingRaw = fields.rating === '' || fields.rating === undefined ? '' : Number(fields.rating);
  const rating = Number.isInteger(ratingRaw) ? ratingRaw : ratingRaw;
  const playtime = String(fields.playtime ?? '').trim();
  const completed = fields.completed === true;
  const genre = String(fields.genre ?? '').trim().toLowerCase();

  if (mode !== 'create') errors.push(issue('invalid_mode', 'mode must be create', 'mode'));
  if (board !== 'games') errors.push(issue('invalid_board', 'board must be games', 'board'));
  if (kind !== 'normal_game') errors.push(issue('invalid_kind', 'v0 only supports normal_game', 'kind'));
  if (!ENTRY_ID_PATTERN.test(id)) errors.push(issue('invalid_entry_id', 'entry id must use game-YYYYMMDD-xxxxxxxx', 'id'));
  if (!title) errors.push(issue('missing_title', 'title is required', 'fields.title'));
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    errors.push(issue('invalid_year', `year must be ${MIN_YEAR}-${MAX_YEAR}`, 'fields.year'));
  }
  if (!cover) errors.push(issue('missing_cover', 'cover is required', 'assets.cover'));
  if (cover && !ALLOWED_COVER_EXTENSIONS.has(coverExtension)) {
    errors.push(issue('invalid_cover_extension', 'cover extension is not allowed', 'assets.cover.extension'));
  }
  if (metadataEnabled) {
    if (!PLATFORM_CHOICES.has(platform)) errors.push(issue('invalid_platform', 'platform is not supported', 'fields.platform'));
    if (url && !/^https?:\/\//i.test(url)) errors.push(issue('invalid_url', 'url must use http or https', 'fields.url'));
    if (rating !== '' && (!Number.isInteger(rating) || rating < 0 || rating > 5)) {
      errors.push(issue('invalid_rating', 'rating must be an integer from 0 to 5', 'fields.rating'));
    }
    if (genre && !GENRE_CHOICES.has(genre)) errors.push(issue('invalid_genre', 'genre is not supported', 'fields.genre'));
    if (!englishTitle) warnings.push(issue('english_title_empty', 'english title is empty', 'fields.english_title'));
    if (!url) warnings.push(issue('url_empty', 'url is empty', 'fields.url'));
  }

  const target = safeTarget(id, coverExtension);
  return {
    ok: errors.length === 0,
    mode,
    board,
    kind,
    id,
    normalized: {
      fields: {
        title,
        year,
        metadata_enabled: metadataEnabled,
        english_title: metadataEnabled ? englishTitle : '',
        url: metadataEnabled ? url : '',
        platform: metadataEnabled ? platform : '',
        price: metadataEnabled ? price : '',
        rating: metadataEnabled ? rating : '',
        playtime: metadataEnabled ? playtime : '',
        completed: metadataEnabled && completed,
        genre: metadataEnabled ? genre : '',
      },
      assets: cover ? {
        cover: {
          source: 'selected-file',
          originalName: path.basename(String(cover.originalName ?? '')),
          extension: coverExtension,
        },
      } : {},
    },
    target,
    operations: [
      { type: 'create', role: 'entry_yaml', relativePath: target.entryYaml, willOverwrite: false },
      { type: 'create', role: 'cover', relativePath: target.cover, willOverwrite: false },
    ],
    warnings,
    errors,
  };
}

export function assertGamesPreviewSafe(preview) {
  const paths = [
    preview.target.entryRelativeDir,
    preview.target.entryYaml,
    preview.target.cover,
    ...preview.operations.map(operation => operation.relativePath),
  ];
  for (const relativePath of paths) {
    if (
      path.isAbsolute(relativePath)
      || relativePath.includes('\\')
      || relativePath.split('/').includes('..')
      || !relativePath.startsWith('entries/games/normal_game/')
    ) throw new Error('unsafe_games_preview_path');
  }
  if (preview.operations.some(operation => operation.type !== 'create' || operation.willOverwrite)) {
    throw new Error('unsafe_games_preview_operation');
  }
  return true;
}

export const GAMES_PREVIEW_RULES = {
  kinds: ['normal_game'],
  platforms: [...PLATFORM_CHOICES],
  genres: [...GENRE_CHOICES],
  coverExtensions: [...ALLOWED_COVER_EXTENSIONS],
  entryIdPattern: ENTRY_ID_PATTERN.source,
  yearRange: [MIN_YEAR, MAX_YEAR],
};
