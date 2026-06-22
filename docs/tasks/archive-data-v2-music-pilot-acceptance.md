# archive-data-v2-music-pilot-acceptance

## Goal

Record the acceptance result and Git boundary for the Archive Music-only pilot output.

This task does not change the pilot output. It verifies that the generated v2 Music data is structurally valid and clarifies whether it is part of the current project Git worktree.

## Checked Scope

- Generated `Archive` Music pilot output.
- Source-side OneDrive Data checks.
- Music source media matching.
- Generated v2 Music shape check.
- Current project Git status and untracked file boundary.

## Acceptance Result

The Music-only pilot output is structurally accepted as a local v2 pilot artifact.

Evidence:

- Source-side structure check passes.
- Music source media check passes.
- v2 Music output check passes.
- v2 output contains 33 album entry directories.
- v2 output contains 33 `entry.yaml` files.
- v2 output contains 33 `content.md` files.
- v2 output contains 33 cover files.
- v2 output contains 33 audio files.
- `migration-manifest.json` contains 99 records.
- `unmapped-files.json` is empty.
- `legacy-field-report.md` exists.
- v2 migration reports have zero local-path or secret-like rule hits.
- The write-enabled migration reported 99 source baseline files and zero source changes.

## Git Boundary

The generated `Archive` pilot output is outside the project Git worktree.

Current project boundary:

```text
project Git worktree
```

Generated v2 pilot output boundary:

```text
external Archive output directory
```

Because the generated v2 output is not under the project root, it is not shown by `git status` and will not be included by normal project commits.

Current recommendation:

- Do not copy the generated v2 media output into the project repository.
- Do not add a project `.gitignore` rule for this output unless a future task intentionally places v2 data under the repo.
- Treat the v2 pilot output as local/OneDrive migration output for now.
- Commit only the design docs, task records, and scripts after a separate commit plan review.

## Why Not Commit The Pilot Output Now

The pilot output contains copied media and transformed source content. Even though it is accepted structurally, it is a generated/migrated data artifact rather than code or workflow logic.

Keeping it outside the code repo for now avoids:

- accidentally expanding repository size with media files;
- mixing migration outputs with migration tooling;
- making future reruns harder to compare;
- committing v2 data before the v2 generation and editing workflow is proven.

## Future Options

Option A: Keep `Archive` outside the project repo.

- Best for the current stage.
- Matches the old model where source data lives outside the frontend repo.
- Keeps media out of Git unless there is a deliberate data-versioning decision.

Option B: Put `Archive` in a separate data repository later.

- Useful if v2 source data should be versioned.
- Requires separate privacy, media-size, and backup policy.
- Should be planned after the Music generator and Archive Studio shape are clearer.

Option C: Move `Archive` into this project repo later.

- Not recommended as the default.
- Would require `.gitignore`, large-file policy, and publication-boundary review.
- Should not happen before deciding how public/data generation will consume v2.

## Recommended Next Task

Design the v2 Music generator pilot.

The generator pilot should read `Archive/entries/music/album` and produce an isolated temporary Music JSON output for comparison, without modifying current `public/data/music.json`, without running `build_archive.py`, and without changing the live frontend.

## Rollback

If the pilot output needs to be removed, delete the generated `Archive` directory and rerun:

```powershell
node scripts/check-source-data-shape.mjs
node scripts/check-music-media-shape.mjs
git status --short --branch
```

Do not run `build_archive.py` or the release script as part of rollback.
