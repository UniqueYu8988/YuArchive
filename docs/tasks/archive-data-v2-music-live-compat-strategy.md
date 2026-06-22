# archive-data-v2-music-live-compat-strategy

## Goal

Design the ID compatibility and media URL strategy required before v2 Music output can replace the live `public/data/music.json`.

This task does not replace live data and does not modify frontend code. It records the compatibility gap found by the isolated preview generator.

## Current Evidence

Current live Music data:

- `public/data/music.json` has 33 items.
- Live item IDs are unique and non-empty.
- Live media paths use generated public cache prefixes:
  - covers: `webp_cache`
  - audio: `audio_cache`

Current v2 preview data:

- Preview `music.json` has 33 items.
- Preview item IDs are unique and non-empty.
- Preview media paths use a non-live placeholder prefix:
  - covers/audio: `v2-preview`
- Preview top-level keys match live Music data.
- Preview item field set matches live Music data.
- Required missing fields: 0.
- Privacy/path rule hits: 0.

Compatibility gap:

- ID overlap with current live `public/data/music.json`: 0.
- Ordering differences: 33.

This means the v2 preview is structurally valid, but not a safe live replacement yet.

## Risks If Replaced Directly

Directly replacing `public/data/music.json` with the current preview would risk:

- breaking any UI state keyed by old Music item IDs;
- breaking future deep links or saved selections if they use current IDs;
- breaking homepage references if they later move from title-based to ID-based matching;
- pointing the frontend at `v2-preview` media paths that are not served by the current public asset pipeline;
- bypassing existing generated `webp_cache` and `audio_cache` paths.

## Strategy Principles

- Treat v2 `entry.yaml.id` as the long-term source entry ID.
- Treat live `music.json.items[].id` as a frontend compatibility ID until replacement is proven safe.
- Do not change live IDs and media paths in the same step.
- Do not replace `public/data/music.json` until preview output can reproduce current live-compatible IDs and public media paths.
- Keep media serving strategy separate from source data organization.

## Recommended Strategy

Use a compatibility layer in the v2 Music generator.

The generator should produce live-compatible output fields:

```json
{
  "id": "<live-compatible-id>",
  "v2_id": "<entry.yaml.id>",
  "cover": "webp_cache/...",
  "audio": "audio_cache/..."
}
```

For the first live-compatible pilot, `v2_id` may stay in preview output only. It should not be added to live `public/data/music.json` until frontend type and UI impact are reviewed.

## ID Compatibility Options

### Option A: Preserve current live IDs in v2 generator output

How:

- Build a mapping between v2 entries and current live items.
- Use the current live ID as `items[].id` in generated live-compatible JSON.
- Preserve v2 source ID as `legacy.v2_id`, `source_id`, or preview-only `v2_id`.

Pros:

- Lowest frontend risk.
- Avoids breaking state keyed by item ID.
- Makes generated JSON easier to compare against current live data.

Cons:

- Requires reliable mapping between v2 entries and live items.
- Keeps two IDs during migration.

Recommendation: preferred next step.

### Option B: Change live data to v2 IDs

How:

- Replace `items[].id` with `entry.yaml.id`.
- Update any references, saved states, or homepage logic that might depend on old IDs.

Pros:

- Cleaner long-term model.
- One ID everywhere.

Cons:

- Higher frontend risk.
- Requires broader audit.
- Not appropriate before the Music generator is proven.

Recommendation: not first.

### Option C: Add both IDs to live JSON

How:

- Keep `id` as the current live ID.
- Add `v2_id` or `source_id`.

Pros:

- Enables gradual migration.
- Frontend can later switch when ready.

Cons:

- Requires TypeScript type change if shipped live.
- Adds extra field to public data.

Recommendation: good later step, not needed for first preview.

## Mapping Options

The mapping should be count-based and report-only at first.

Possible mapping keys:

- migrated manifest source relative identifier;
- old Music Markdown source stem;
- normalized title;
- current live item title;
- current live cover/audio stem;
- checksum-backed migrated content role.

The first mapping task should output only:

- mapped count;
- unmapped v2 count;
- unmapped live count;
- duplicate candidate count;
- ambiguous candidate count.

It should not output title lists or content bodies by default.

## Media URL Strategy

Current live frontend expects public paths:

- cover paths under `webp_cache`;
- audio paths under `audio_cache`.

Current v2 preview paths are placeholders:

- `v2-preview/music/album/<entry-id>/cover.*`;
- `v2-preview/music/album/<entry-id>/audio.*`.

Before live replacement, one of these must be true:

### Option 1: Reuse current cache paths

The v2 generator maps each v2 entry to the current live item's `cover` and `audio` fields.

Pros:

- No media pipeline change.
- Lowest live frontend risk.

Cons:

- Depends on live mapping.
- Does not prove v2 media serving yet.

Recommendation: preferred first live-compatible preview.

### Option 2: Generate new public cache outputs from v2

The v2 generator or a new media step writes public cache files and points JSON to them.

Pros:

- Moves toward a v2-native pipeline.

Cons:

- Larger blast radius.
- Needs cache write policy and collision rules.
- Should not be first.

### Option 3: Serve v2 source media directly

The frontend serves media from `Archive`.

Pros:

- Conceptually simple.

Cons:

- Current frontend/public deployment cannot serve that external directory by default.
- Would require frontend/build/deployment changes.

Recommendation: not for current stage.

## Recommended Next Task

Implement a read-only Music v2-to-live compatibility mapper.

The mapper should read:

- v2 Music `entry.yaml` and manifest;
- current `public/data/music.json`;
- optional v2 preview JSON.

It should output only counts:

- v2 entries: expected 33;
- live items: expected 33;
- mapped entries;
- unmapped v2 entries;
- unmapped live items;
- ambiguous mappings;
- duplicate candidates;
- potential live ID reuse count;
- potential live media path reuse count.

It must not modify v2 data, live public data, old OneDrive Data, frontend code, or cache files.

## Acceptance Criteria For This Strategy

- Do not replace live `public/data/music.json` yet.
- Prefer a mapping step that proves 33/33 v2-to-live alignment.
- Prefer reusing current live IDs and media paths for the first live-compatible preview.
- Defer v2-native media serving until after generator parity is proven.

## Rollback

This is a design record only. To roll back, remove this task file and related notes from status documents.

