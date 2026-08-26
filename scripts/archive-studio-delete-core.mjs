import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildBoardPublicCatalog } from './archive-studio-public-sync-core.mjs';
import { parseHomepageConfig } from './archive-studio-homepage-core.mjs';
import { evaluateMusicV2Shape } from './check-archive-data-v2-music-shape.mjs';
import { evaluateTextsV2Shape } from './check-archive-data-v2-texts-shape.mjs';
import { evaluateVisionsV2Shape } from './check-archive-data-v2-visions-shape.mjs';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';
import { snapshotFileMetadata } from './archive-studio-v0-music-create-core.mjs';
import { loadEditableEntry } from './archive-studio-update-core.mjs';

const BOARDS = new Set(['music', 'texts', 'visions', 'games']);
const HOME_KEYS = {
  music: 'latestMusic',
  texts: 'latestTexts',
  visions: 'latestVisions',
  games: 'latestGames',
};
const PRIVACY_RULES = [
  /[A-Za-z]:[\\/]+Users[\\/]/i,
  /OneDrive/i,
  /Data backup/i,
  /\b(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i,
];

function exists(target) {
  try { return fs.existsSync(target); } catch { return false; }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function entryRoot(v2Root, board, kind, id) {
  const root = path.resolve(v2Root);
  const target = path.resolve(root, 'entries', board, kind, id);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error('delete_path_escaped');
  return target;
}

function listTree(root, current = root) {
  const items = [];
  for (const child of fs.readdirSync(current, { withFileTypes: true })) {
    const target = path.join(current, child.name);
    if (child.isDirectory()) items.push(...listTree(root, target));
    else if (child.isFile()) {
      const relativePath = path.relative(root, target).replaceAll('\\', '/');
      const bytes = fs.readFileSync(target);
      items.push({ relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  return items.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function countGameSeasons(v2Root) {
  const liveRoot = path.join(v2Root, 'entries', 'games', 'live_game');
  let count = 0;
  let parents = [];
  try {
    parents = fs.readdirSync(liveRoot, { withFileTypes: true }).filter(item => item.isDirectory());
  } catch {
    return 0;
  }
  for (const parent of parents) {
    const seasonsRoot = path.join(liveRoot, parent.name, 'seasons');
    let seasons = [];
    try {
      seasons = fs.readdirSync(seasonsRoot, { withFileTypes: true }).filter(item => item.isDirectory());
    } catch {
      continue;
    }
    for (const season of seasons) {
      try {
        if (fs.statSync(path.join(seasonsRoot, season.name, 'season.yaml')).isFile()) count += 1;
      } catch {
        // The shape checker reports incomplete season directories separately.
      }
    }
  }
  return count;
}

function evaluateShape(board, v2Root) {
  if (board === 'music') {
    return evaluateMusicV2Shape({ v2Root, expectedMinimumEntries: 0, requireMigrationBaseline: false });
  }
  if (board === 'texts') {
    return evaluateTextsV2Shape({
      v2Root,
      expectedMinimumEntries: 0,
      expectedMinimumKinds: { article: 0, book_note: 0, series_note: 0 },
      requireMigrationBaseline: false,
    });
  }
  if (board === 'visions') {
    return evaluateVisionsV2Shape({
      v2Root,
      expectedMinimumEntries: 0,
      expectedMinimumKinds: { movie: 0, series: 0, showcase: 0 },
      expectedCharacters: 0,
      requireMigrationBaseline: false,
    });
  }
  return evaluateGamesV2Shape({
    v2Root,
    expectedMinimumEntries: 0,
    expectedMinimumKinds: { normal_game: 0, dlc: 0, live_game: 0 },
    expectedSeasons: countGameSeasons(v2Root),
    expectedMinimumMetadataDisabled: 0,
    expectedLiveParentCovers: 0,
    requireMigrationBaseline: false,
  });
}

function homepageReferenced({ board, id, publicId, v2Root, projectRoot }) {
  const config = parseHomepageConfig(path.join(v2Root, 'config', 'homepage.yaml'));
  if (!config.missing && config.selection[board]?.includes(id)) return true;
  const homePath = path.join(projectRoot, 'public', 'data', 'home.json');
  if (!publicId || !exists(homePath)) return false;
  const home = JSON.parse(fs.readFileSync(homePath, 'utf8'));
  return (home[HOME_KEYS[board]] ?? []).some(item => String(item.id) === publicId);
}

function studioMediaPaths(publicItem) {
  if (!publicItem) return [];
  return [publicItem.cover, publicItem.audio, publicItem.image_path]
    .map(value => String(value ?? '').replace(/^\/+/, ''))
    .filter(value => value.startsWith('studio_media/'));
}

function assertSafeManifest(value) {
  if (PRIVACY_RULES.some(rule => rule.test(JSON.stringify(value)))) {
    throw new Error('delete_manifest_privacy_violation');
  }
}

export function buildDeletePreview({ board, id, v2Root, projectRoot = process.cwd() }) {
  if (!BOARDS.has(board) || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(String(id ?? ''))) {
    throw new Error('delete_identity_invalid');
  }
  const current = loadEditableEntry({ board, id, v2Root, projectRoot });
  const root = entryRoot(v2Root, board, current.kind, id);
  const files = listTree(root);
  if (!files.length) throw new Error('delete_entry_empty');
  const catalog = buildBoardPublicCatalog({ board, v2Root, projectRoot });
  const catalogEntry = catalog.entries.find(item => item.id === id);
  const publicId = catalogEntry?.publicId ?? '';
  const isHomepageReferenced = homepageReferenced({ board, id, publicId, v2Root, projectRoot });
  const publiclySynced = Boolean(catalogEntry?.synced);
  const summary = {
    files: files.length,
    bytes: files.reduce((sum, item) => sum + item.bytes, 0),
    publiclySynced,
    homepageReferenced: isHomepageReferenced,
    publicSyncRequired: publiclySynced,
  };
  const operations = [
    { role: 'entry_directory', action: 'delete', relativePath: `entries/${board}/${current.kind}/${id}` },
    ...(publiclySynced ? [{ role: 'public_delete_marker', action: 'create', relativePath: `migration/archive-studio-v0/pending-public-deletes/${board}/${id}.json` }] : []),
  ];
  const errors = isHomepageReferenced
    ? [{ code: 'homepage_reference_exists', message: '该条目仍在首页精选中，请先替换首页槽位。' }]
    : [];
  const digest = sha256(JSON.stringify({
    board,
    kind: current.kind,
    id,
    files,
    publicId,
    summary,
  }));
  return {
    ok: errors.length === 0,
    errors,
    warnings: publiclySynced ? [{ code: 'public_sync_required', message: '删除后需要同步该板块，公开网页才会移除条目。' }] : [],
    board,
    kind: current.kind,
    id,
    title: String(current.fields.title ?? ''),
    summary,
    operations,
    digest,
    internal: {
      root,
      files,
      publicId,
      mediaPaths: studioMediaPaths(catalogEntry?.publicItem),
      pendingUpdatePath: path.join(v2Root, 'migration', 'archive-studio-v0', 'pending-public', board, `${id}.json`),
      pendingDeletePath: path.join(v2Root, 'migration', 'archive-studio-v0', 'pending-public-deletes', board, `${id}.json`),
    },
  };
}

export async function applyEntryDelete({
  board,
  id,
  expectedDigest,
  v2Root,
  sourceRoot,
  projectRoot = process.cwd(),
}) {
  const preview = buildDeletePreview({ board, id, v2Root, projectRoot });
  if (!preview.ok || preview.digest !== expectedDigest) throw new Error('delete_preview_changed');
  const baseline = evaluateShape(board, v2Root);
  if (!baseline.ok) throw new Error('delete_baseline_shape_failed');
  const sourceBefore = await snapshotFileMetadata(sourceRoot);
  const transactionId = `delete-${id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const transactionRoot = path.join(v2Root, 'migration', 'archive-studio-v0', 'transactions', transactionId);
  const backupEntry = path.join(transactionRoot, 'backup', 'entry');
  const backupUpdateMarker = path.join(transactionRoot, 'backup', 'pending-update.json');
  let stage = 'backup';
  try {
    fs.mkdirSync(path.dirname(backupEntry), { recursive: true });
    fs.cpSync(preview.internal.root, backupEntry, { recursive: true, errorOnExist: true });
    if (sha256(JSON.stringify(listTree(backupEntry))) !== sha256(JSON.stringify(preview.internal.files))) {
      throw new Error('delete_backup_verification_failed');
    }
    if (exists(preview.internal.pendingUpdatePath)) {
      fs.copyFileSync(preview.internal.pendingUpdatePath, backupUpdateMarker);
    }

    stage = 'delete';
    fs.rmSync(preview.internal.root, { recursive: true, force: false });
    if (exists(preview.internal.root)) throw new Error('delete_entry_still_exists');
    fs.rmSync(preview.internal.pendingUpdatePath, { force: true });

    stage = 'shape-check';
    const afterShape = evaluateShape(board, v2Root);
    if (!afterShape.ok) throw new Error('delete_post_write_shape_failed');

    stage = 'source-check';
    const sourceAfter = await snapshotFileMetadata(sourceRoot);
    const sourceUnchanged = sourceBefore.files === sourceAfter.files && sourceBefore.digest === sourceAfter.digest;
    if (!sourceUnchanged) throw new Error('source_metadata_changed');

    stage = 'manifest';
    const manifest = {
      transactionId,
      mode: 'delete',
      board,
      kind: preview.kind,
      entryId: id,
      deletedFiles: preview.summary.files,
      deletedBytes: preview.summary.bytes,
      publicSyncRequired: preview.summary.publicSyncRequired,
      backupRelativeDir: 'backup/entry',
    };
    assertSafeManifest(manifest);
    fs.writeFileSync(path.join(transactionRoot, 'preview.json'), `${JSON.stringify({ ...manifest, operations: preview.operations }, null, 2)}\n`);
    fs.writeFileSync(path.join(transactionRoot, 'write.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(transactionRoot, 'rollback.json'), `${JSON.stringify({ transactionId, restoreEntryDirectory: `entries/${board}/${preview.kind}/${id}` }, null, 2)}\n`);

    if (preview.summary.publicSyncRequired) {
      fs.mkdirSync(path.dirname(preview.internal.pendingDeletePath), { recursive: true });
      const marker = {
        board,
        kind: preview.kind,
        entryId: id,
        publicId: preview.internal.publicId,
        mediaPaths: preview.internal.mediaPaths,
        transactionId,
      };
      assertSafeManifest(marker);
      fs.writeFileSync(preview.internal.pendingDeletePath, `${JSON.stringify(marker, null, 2)}\n`, { flag: 'wx' });
    }

    return {
      ok: true,
      board,
      kind: preview.kind,
      entryId: id,
      transactionId,
      deletedFiles: preview.summary.files,
      deletedBytes: preview.summary.bytes,
      sourceUnchanged,
      publicSyncPending: preview.summary.publicSyncRequired,
      publishTriggered: false,
      check: afterShape,
    };
  } catch (error) {
    const rollbackErrors = [];
    try {
      if (!exists(preview.internal.root) && exists(backupEntry)) {
        fs.mkdirSync(path.dirname(preview.internal.root), { recursive: true });
        fs.cpSync(backupEntry, preview.internal.root, { recursive: true, errorOnExist: true });
      }
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : 'entry_restore_failed');
    }
    try {
      if (exists(backupUpdateMarker)) {
        fs.mkdirSync(path.dirname(preview.internal.pendingUpdatePath), { recursive: true });
        fs.copyFileSync(backupUpdateMarker, preview.internal.pendingUpdatePath);
      }
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : 'marker_restore_failed');
    }
    try { fs.rmSync(preview.internal.pendingDeletePath, { force: true }); } catch {}
    try { fs.rmSync(transactionRoot, { recursive: true, force: true }); } catch {}
    const wrapped = new Error(`Delete failed during ${stage}; rollback ${rollbackErrors.length ? 'needs review' : 'completed'}`);
    wrapped.code = 'delete_transaction_failed';
    wrapped.statusCode = 500;
    wrapped.stage = stage;
    wrapped.rollback = { attempted: true, completed: rollbackErrors.length === 0, errorCount: rollbackErrors.length };
    wrapped.cause = error;
    throw wrapped;
  }
}
