import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildBoardPublicCatalog } from './archive-studio-public-sync-core.mjs';
import { evaluateMusicV2Shape } from './check-archive-data-v2-music-shape.mjs';
import { evaluateTextsV2Shape } from './check-archive-data-v2-texts-shape.mjs';
import { evaluateVisionsV2Shape } from './check-archive-data-v2-visions-shape.mjs';
import { evaluateGamesV2Shape } from './check-archive-data-v2-games-shape.mjs';
import { parseTextEntryYaml } from './archive-data-v2-texts-core.mjs';
import { parseFlatYaml } from './archive-data-v2-visions-core.mjs';
import { parseV2GameYaml } from './archive-data-v2-games-core.mjs';
import { snapshotFileMetadata } from './archive-studio-v0-music-create-core.mjs';

const BOARD_RULES = {
  music: { kinds: ['album'], assetRoles: ['cover', 'audio'], content: true },
  texts: { kinds: ['article', 'book_note', 'series_note'], assetRoles: ['cover'], content: true },
  visions: { kinds: ['movie', 'series'], assetRoles: ['poster'], content: false },
  games: { kinds: ['normal_game'], assetRoles: ['cover'], content: false },
};
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac']);
const PRIVACY_RULES = [
  /[A-Za-z]:[\\/]+Users[\\/]/i, /OneDrive/i, /Data backup/i,
  /\b(password|secret|api_key|apikey|access_token|refresh_token|SESSDATA)\b/i,
];

function existsFile(target) {
  try { return fs.statSync(target).isFile(); } catch { return false; }
}

function listFiles(root) {
  try { return fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isFile()); } catch { return []; }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseSimpleYaml(filePath) {
  const data = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#') || line.length !== line.trimStart().length) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!value) { data[key] = {}; continue; }
    if (value.startsWith('"')) {
      try { data[key] = JSON.parse(value); } catch { data[key] = value.slice(1, -1); }
    } else if (value === 'true' || value === 'false') data[key] = value === 'true';
    else if (/^-?\d+(?:\.\d+)?$/.test(value)) data[key] = Number(value);
    else data[key] = value.replace(/^'|'$/g, '');
  }
  return data;
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function legacyBlock(original) {
  const lines = original.split(/\r?\n/);
  const index = lines.findIndex(line => /^legacy:\s*/.test(line));
  return index >= 0 ? lines.slice(index).filter((line, offset, all) => offset < all.length - 1 || line).join('\n') : 'legacy: {}';
}

function serializeEntry(board, payload, original) {
  const fields = payload.fields ?? {};
  let lines;
  if (board === 'music') {
    lines = [`id: ${yamlString(payload.id)}`, 'board: music', 'kind: album', `title: ${yamlString(fields.title)}`];
    for (const key of ['date', 'url', 'note', 'description', 'track_title']) {
      if (fields[key] !== undefined && fields[key] !== '') lines.push(`${key}: ${yamlString(fields[key])}`);
    }
  } else if (board === 'texts') {
    lines = [
      `id: ${yamlString(payload.id)}`, 'board: texts', `kind: ${payload.kind}`,
      `title: ${yamlString(fields.title)}`, `section: ${fields.section}`,
    ];
    if (fields.date) lines.push(`date: ${yamlString(fields.date)}`);
    if (fields.author) lines.push(`author: ${yamlString(fields.author)}`);
    if (fields.summary) lines.push(`summary: ${yamlString(fields.summary)}`);
    lines.push(`tags: [${(fields.tags ?? []).map(yamlString).join(', ')}]`);
  } else if (board === 'visions') {
    lines = [
      `id: ${yamlString(payload.id)}`, 'board: visions', `kind: ${payload.kind}`,
      `title: ${yamlString(fields.title)}`, `period: ${yamlString(fields.period)}`,
      `cinema: ${fields.cinema ? 'true' : 'false'}`, `quote: ${yamlString(fields.quote)}`,
      `url: ${yamlString(fields.url)}`,
    ];
  } else {
    lines = [
      `id: ${payload.id}`, 'board: games', 'kind: normal_game',
      `title: ${yamlString(fields.title)}`, `year: ${Number(fields.year)}`,
      `metadata_enabled: ${fields.metadata_enabled ? 'true' : 'false'}`,
    ];
    if (fields.metadata_enabled) {
      lines.push(
        `english_title: ${yamlString(fields.english_title)}`, `url: ${yamlString(fields.url)}`,
        `platform: ${yamlString(fields.platform)}`, `price: ${yamlString(fields.price)}`,
        `rating: ${fields.rating === '' ? '""' : fields.rating}`,
        `playtime: ${yamlString(fields.playtime)}`, `completed: ${fields.completed ? 'true' : 'false'}`,
        `genre: ${yamlString(fields.genre)}`,
      );
    }
  }
  return `${lines.join('\n')}\n${legacyBlock(original).replace(/\n+$/, '')}\n`;
}

function entryRoot(v2Root, board, kind, id) {
  const root = path.resolve(v2Root);
  const target = path.resolve(root, 'entries', board, kind, id);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error('update_path_escaped');
  return target;
}

function findAsset(root, role) {
  const extensions = role === 'audio' ? AUDIO_EXTENSIONS : IMAGE_EXTENSIONS;
  const matches = listFiles(root).filter(item => (
    path.basename(item.name, path.extname(item.name)) === role
    && extensions.has(path.extname(item.name).toLowerCase())
  ));
  if (matches.length > 1) throw new Error(`${role}_asset_count_invalid`);
  return matches.length ? path.join(root, matches[0].name) : '';
}

function parseEntry(board, yamlPath) {
  if (board === 'texts') {
    const parsed = parseTextEntryYaml(yamlPath);
    if (parsed.errors) throw new Error('entry_yaml_invalid');
    return parsed.data;
  }
  if (board === 'visions') {
    const parsed = parseFlatYaml(yamlPath);
    if (parsed.errors) throw new Error('entry_yaml_invalid');
    return parsed.data;
  }
  if (board === 'games') {
    const parsed = parseV2GameYaml(yamlPath);
    if (parsed.errors.length) throw new Error('entry_yaml_invalid');
    return parsed.data;
  }
  return parseSimpleYaml(yamlPath);
}

export function listEditableEntries({ board, v2Root, projectRoot = process.cwd() }) {
  const rule = BOARD_RULES[board];
  if (!rule) throw new Error('unsupported_update_board');
  const catalog = buildBoardPublicCatalog({ board, v2Root, projectRoot });
  return catalog.entries
    .filter(item => rule.kinds.some(kind => existsFile(path.join(v2Root, 'entries', board, kind, item.id, 'entry.yaml'))))
    .map(({ id, title, secondary, thumbnail, synced }) => ({ id, title, secondary, thumbnail, synced }));
}

export function loadEditableEntry({ board, id, v2Root, projectRoot = process.cwd() }) {
  const rule = BOARD_RULES[board];
  if (!rule) throw new Error('unsupported_update_board');
  const kind = rule.kinds.find(candidate => existsFile(path.join(v2Root, 'entries', board, candidate, id, 'entry.yaml')));
  if (!kind) throw new Error('update_entry_missing');
  const root = entryRoot(v2Root, board, kind, id);
  const yamlPath = path.join(root, 'entry.yaml');
  const fields = parseEntry(board, yamlPath);
  if (String(fields.id) !== id || String(fields.board) !== board || String(fields.kind) !== kind) {
    throw new Error('update_entry_identity_invalid');
  }
  const assets = Object.fromEntries(rule.assetRoles.map(role => {
    const file = findAsset(root, role);
    return [role, file ? { name: path.basename(file), extension: path.extname(file).toLowerCase() } : null];
  }));
  const catalog = buildBoardPublicCatalog({ board, v2Root, projectRoot });
  const publicRecord = catalog.entries.find(item => item.id === id);
  return {
    ok: true, board, kind, id, fields,
    content: rule.content ? fs.readFileSync(path.join(root, 'content.md'), 'utf8') : '',
    assets,
    publicId: publicRecord?.publicId ?? '',
    publiclySynced: publicRecord?.synced === true,
  };
}

function normalizePayload(payload, current) {
  if (payload.mode !== 'update' || payload.board !== current.board || payload.kind !== current.kind || payload.id !== current.id) {
    throw new Error('update_identity_change_forbidden');
  }
  const fields = payload.fields ?? {};
  if (!String(fields.title ?? '').trim()) throw new Error('update_title_required');
  const assets = {};
  for (const role of BOARD_RULES[current.board].assetRoles) {
    const requested = payload.assets?.[role];
    const source = requested?.source ?? 'keep-existing';
    if (!['keep-existing', 'selected-file'].includes(source)) throw new Error('update_asset_source_invalid');
    if (source === 'selected-file') {
      const extension = String(requested.extension ?? '').toLowerCase();
      const allowed = role === 'audio' ? AUDIO_EXTENSIONS : IMAGE_EXTENSIONS;
      if (!allowed.has(extension)) throw new Error('update_asset_extension_invalid');
      assets[role] = { source, extension, originalName: path.basename(String(requested.originalName ?? '')) };
    } else assets[role] = { source, extension: current.assets[role]?.extension ?? '' };
  }
  return {
    mode: 'update', board: current.board, kind: current.kind, id: current.id,
    fields, content: { markdown: String(payload.content?.markdown ?? current.content) }, assets,
  };
}

function changedFields(current, next) {
  const keys = new Set([...Object.keys(current.fields), ...Object.keys(next.fields)]);
  return [...keys].filter(key => !['id', 'board', 'kind', 'legacy'].includes(key)
    && JSON.stringify(current.fields[key] ?? '') !== JSON.stringify(next.fields[key] ?? ''));
}

export function buildUpdatePreview({ payload, v2Root, projectRoot = process.cwd() }) {
  const current = loadEditableEntry({ board: payload.board, id: payload.id, v2Root, projectRoot });
  const normalized = normalizePayload(payload, current);
  const root = entryRoot(v2Root, current.board, current.kind, current.id);
  const originalYaml = fs.readFileSync(path.join(root, 'entry.yaml'), 'utf8');
  const nextYaml = serializeEntry(current.board, normalized, originalYaml);
  const fieldsChanged = changedFields(current, normalized);
  const contentChanged = BOARD_RULES[current.board].content && current.content !== normalized.content.markdown;
  const replacedAssets = BOARD_RULES[current.board].assetRoles.filter(role => normalized.assets[role].source === 'selected-file');
  const operations = [
    ...(nextYaml !== originalYaml ? [{ role: 'entry_yaml', action: 'replace', relativePath: `entries/${current.board}/${current.kind}/${current.id}/entry.yaml` }] : []),
    ...(contentChanged ? [{ role: 'content_md', action: 'replace', relativePath: `entries/${current.board}/${current.kind}/${current.id}/content.md` }] : []),
    ...replacedAssets.map(role => ({
      role, action: 'replace',
      relativePath: `entries/${current.board}/${current.kind}/${current.id}/${role}${normalized.assets[role].extension}`,
    })),
  ];
  const summary = { fieldsChanged, contentChanged, replacedAssets, unchangedAssets: BOARD_RULES[current.board].assetRoles.filter(role => !replacedAssets.includes(role)) };
  const digest = sha256(JSON.stringify({ normalized, summary, originalYamlHash: sha256(originalYaml), currentAssets: current.assets }));
  return {
    ok: operations.length > 0,
    errors: operations.length ? [] : [{ code: 'no_changes', message: '没有检测到修改' }],
    board: current.board, kind: current.kind, id: current.id, normalized, summary, operations, digest,
    publiclySynced: current.publiclySynced,
    publicId: current.publicId,
    internal: { current, originalYaml, nextYaml, root },
  };
}

function evaluateShape(board, v2Root) {
  if (board === 'music') return evaluateMusicV2Shape({ v2Root, expectedMinimumEntries: 1, requireMigrationBaseline: false });
  if (board === 'texts') return evaluateTextsV2Shape({
    v2Root,
    expectedMinimumEntries: 1,
    expectedMinimumKinds: { article: 0, book_note: 0, series_note: 0 },
    requireMigrationBaseline: false,
  });
  if (board === 'visions') return evaluateVisionsV2Shape({
    v2Root,
    expectedMinimumEntries: 1,
    expectedMinimumKinds: { movie: 0, series: 0, showcase: 0 },
    expectedCharacters: 0,
    requireMigrationBaseline: false,
  });
  return evaluateGamesV2Shape({
    v2Root,
    expectedMinimumEntries: 1,
    expectedMinimumKinds: { normal_game: 0, dlc: 0, live_game: 0 },
    expectedSeasons: 0,
    expectedMinimumMetadataDisabled: 0, expectedLiveParentCovers: 0, requireMigrationBaseline: false,
  });
}

function assertSafeManifest(value) {
  if (PRIVACY_RULES.some(rule => rule.test(JSON.stringify(value)))) throw new Error('update_manifest_privacy_violation');
}

export async function applyEntryUpdate({
  payload, expectedDigest, assetBuffers = {}, v2Root, sourceRoot, projectRoot = process.cwd(),
}) {
  const preview = buildUpdatePreview({ payload, v2Root, projectRoot });
  if (!preview.ok || preview.digest !== expectedDigest) throw new Error('update_preview_changed');
  for (const role of preview.summary.replacedAssets) {
    if (!Buffer.isBuffer(assetBuffers[role]) || !assetBuffers[role].length) throw new Error(`update_${role}_bytes_required`);
  }
  const baseline = evaluateShape(preview.board, v2Root);
  if (!baseline.ok) throw new Error('update_baseline_shape_failed');
  const sourceBefore = await snapshotFileMetadata(sourceRoot);
  const transactionId = `update-${preview.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const transactionRoot = path.join(v2Root, 'migration', 'archive-studio-v0', 'transactions', transactionId);
  const backupRoot = path.join(transactionRoot, 'backup');
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-studio-update-'));
  const pendingRoot = path.join(v2Root, 'migration', 'archive-studio-v0', 'pending-public', preview.board);
  const pendingPath = path.join(pendingRoot, `${preview.id}.json`);
  const originals = [];
  const newTargets = [];
  let stage = 'backup';
  try {
    fs.mkdirSync(backupRoot, { recursive: true });
    const targetItems = [];
    if (preview.internal.nextYaml !== preview.internal.originalYaml) {
      targetItems.push({ role: 'entry_yaml', target: path.join(preview.internal.root, 'entry.yaml'), content: Buffer.from(preview.internal.nextYaml) });
    }
    if (preview.summary.contentChanged) {
      targetItems.push({ role: 'content_md', target: path.join(preview.internal.root, 'content.md'), content: Buffer.from(preview.normalized.content.markdown) });
    }
    for (const role of preview.summary.replacedAssets) {
      const oldPath = findAsset(preview.internal.root, role);
      if (!oldPath) throw new Error(`update_existing_${role}_missing`);
      targetItems.push({
        role, target: path.join(preview.internal.root, `${role}${preview.normalized.assets[role].extension}`),
        oldPath, content: assetBuffers[role],
      });
    }
    for (const item of targetItems) {
      const oldPath = item.oldPath ?? item.target;
      if (existsFile(oldPath)) {
        const backup = path.join(backupRoot, `${item.role}${path.extname(oldPath) || '.bak'}`);
        fs.copyFileSync(oldPath, backup);
        originals.push({ role: item.role, target: oldPath, backup });
      }
      const staged = path.join(stageRoot, `${item.role}.stage`);
      fs.writeFileSync(staged, item.content, { flag: 'wx' });
      if (sha256(fs.readFileSync(staged)) !== sha256(item.content)) throw new Error('update_stage_checksum_failed');
      item.staged = staged;
    }
    stage = 'write';
    for (const item of targetItems) {
      if (item.oldPath && item.oldPath !== item.target) fs.rmSync(item.oldPath, { force: true });
      fs.copyFileSync(item.staged, item.target);
      newTargets.push(item.target);
      if (sha256(fs.readFileSync(item.target)) !== sha256(item.content)) throw new Error('update_write_checksum_failed');
    }
    stage = 'shape-check';
    const afterShape = evaluateShape(preview.board, v2Root);
    if (!afterShape.ok) throw new Error('update_post_write_shape_failed');
    stage = 'source-check';
    const sourceAfter = await snapshotFileMetadata(sourceRoot);
    const sourceUnchanged = sourceBefore.files === sourceAfter.files && sourceBefore.digest === sourceAfter.digest;
    if (!sourceUnchanged) throw new Error('source_metadata_changed');
    stage = 'manifest';
    const manifest = {
      transactionId, mode: 'update', board: preview.board, kind: preview.kind, entryId: preview.id,
      changedFields: preview.summary.fieldsChanged, contentChanged: preview.summary.contentChanged,
      replacedAssets: preview.summary.replacedAssets,
      backups: originals.map(item => ({ role: item.role, relativeTarget: path.relative(v2Root, item.target).replaceAll('\\', '/'), backupName: path.basename(item.backup) })),
    };
    assertSafeManifest(manifest);
    fs.writeFileSync(path.join(transactionRoot, 'preview.json'), `${JSON.stringify({ ...manifest, operations: preview.operations }, null, 2)}\n`);
    fs.writeFileSync(path.join(transactionRoot, 'write.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(transactionRoot, 'rollback.json'), `${JSON.stringify({ transactionId, restoreBackups: manifest.backups }, null, 2)}\n`);
    if (preview.publiclySynced) {
      fs.mkdirSync(pendingRoot, { recursive: true });
      const pending = {
        board: preview.board, kind: preview.kind, entryId: preview.id, publicId: preview.publicId,
        replacedAssets: preview.summary.replacedAssets,
        transactionId,
      };
      assertSafeManifest(pending);
      fs.writeFileSync(pendingPath, `${JSON.stringify(pending, null, 2)}\n`);
    }
    return {
      ok: true, board: preview.board, kind: preview.kind, entryId: preview.id,
      transactionId, changedFields: preview.summary.fieldsChanged,
      contentChanged: preview.summary.contentChanged, replacedAssets: preview.summary.replacedAssets,
      sourceUnchanged, publicSyncPending: true, check: afterShape,
    };
  } catch (error) {
    const rollbackErrors = [];
    for (const target of [...newTargets].reverse()) {
      try { fs.rmSync(target, { force: true }); } catch (rollbackError) { rollbackErrors.push(rollbackError.message); }
    }
    for (const item of originals) {
      try { fs.copyFileSync(item.backup, item.target); } catch (rollbackError) { rollbackErrors.push(rollbackError.message); }
    }
    try { fs.rmSync(pendingPath, { force: true }); } catch {}
    try { fs.rmSync(transactionRoot, { recursive: true, force: true }); } catch {}
    const wrapped = new Error(`Update failed during ${stage}; rollback ${rollbackErrors.length ? 'needs review' : 'completed'}`);
    wrapped.code = 'update_transaction_failed';
    wrapped.statusCode = 500;
    wrapped.stage = stage;
    wrapped.rollback = { attempted: true, completed: rollbackErrors.length === 0, errorCount: rollbackErrors.length };
    wrapped.cause = error;
    throw wrapped;
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}
