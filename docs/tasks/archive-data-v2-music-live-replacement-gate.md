# archive-data-v2-music-live-replacement-gate

## Goal

Define the final acceptance and commit boundary before any v2 Music output replaces live `public/data/music.json`.

This is a gate document only. It does not replace live data and does not perform Git operations.

## Current Evidence

The v2 Music pipeline has reached a live-compatible preview:

- Music-only v2 source migration completed with 33 album entries.
- v2 Music output check passes.
- Isolated v2 preview JSON matches live Music top-level and item field shape.
- Raw v2 preview IDs do not overlap with live IDs.
- v2-to-live mapper proves 33/33 entries can map to current live items.
- live-compatible preview generation succeeds.
- live-compatible preview reuses:
  - 33 current live IDs;
  - 33 current `webp_cache` cover paths;
  - 33 current `audio_cache` audio paths.
- live-compatible preview has:
  - 33 preview items;
  - 0 unmapped live items;
  - 0 ambiguous mappings;
  - 0 required missing fields;
  - 0 ordering differences;
  - 0 privacy/path rule hits.
- Current `public/data/music.json` has not been modified.
- `build_archive.py` has not been run for this generator pilot.

## Replacement Is Not Yet Authorized

Do not replace `public/data/music.json` yet.

The next replacement task, if authorized, must be explicit and narrow:

- generate live-compatible Music JSON from v2;
- compare it against current `public/data/music.json`;
- replace only `public/data/music.json`;
- run shape/privacy checks;
- optionally run frontend/build/browser checks if separately allowed;
- do not modify other public data files;
- do not run `build_archive.py`;
- do not publish or push.

## Commit Boundary

Current project Git changes are mostly workflow/design/check/generator tooling. The generated `Archive` pilot output is outside the project Git worktree.

Recommended commit grouping later:

1. Archive design and migration audit tooling.
2. Music pilot migration, v2 output checks, and acceptance records.
3. Music preview and live-compatibility tooling.
4. Status document updates.

Do not include generated system-temp preview JSON in Git.

Do not include external `Archive` pilot output in this project Git repository unless a separate data-versioning policy is approved.

## Pre-Replacement Checks

Before any future replacement of `public/data/music.json`, run:

```powershell
node scripts/check-archive-data-v2-music-shape.mjs
node scripts/map-archive-data-v2-music-live-compat.mjs
node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs
node scripts/check-public-data-shape.mjs
git status --short --branch
```

The future replacement task should also capture:

- `git diff -- public/data/music.json` after replacement;
- item count changes;
- field set changes;
- ID change count;
- cover/audio path change count;
- privacy/path rule hits.

The diff review must not output long content bodies or full title lists by default.

## Replacement Acceptance Criteria

A future live replacement is acceptable only if:

- `public/data/music.json` remains valid `MusicCategory` shape.
- item count remains 33 unless a source change is explicitly explained.
- live-compatible IDs are preserved.
- live-compatible `webp_cache` and `audio_cache` paths are preserved.
- required field missing count is 0.
- privacy/path rule hits are 0.
- `home.json`, `games.json`, `visions.json`, and `texts.json` are unchanged.
- `build_archive.py` is not run.
- old OneDrive Data is not modified.
- no publish or push is executed.

## Browser/Build Gate

Because replacing `public/data/music.json` affects the live Music page, a stronger validation may be needed before treating replacement as final.

Recommended later checks, only if authorized:

- `npm run build`;
- browser check for `/music`;
- audio and cover URL smoke check.

These are not run in this gate task.

## Rollback

If a future replacement is performed and needs rollback:

1. Restore `public/data/music.json` from Git.
2. Re-run `node scripts/check-public-data-shape.mjs`.
3. Re-run the live-compatible preview generator.
4. Do not run `build_archive.py` as rollback.

## Recommended Next Task

Pause for user approval before replacing `public/data/music.json`.

If approved, implement a small replacement script or one-off controlled copy from the live-compatible preview to `public/data/music.json`, followed by the checks listed above.

