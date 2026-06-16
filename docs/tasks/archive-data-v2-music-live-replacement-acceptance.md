# archive-data-v2-music-live-replacement-acceptance

## Goal

Record the controlled replacement of live `public/data/music.json` with the live-compatible v2 Music preview.

This task records acceptance evidence and Git boundary. It does not publish, push, run a build, or run `build_archive.py`.

## Authorized Scope

User authorization:

```text
授权执行 Music v2 live-compatible JSON 替换，只修改 public/data/music.json，不运行 build_archive.py，不 push。
```

Allowed in this replacement:

- regenerate live-compatible preview JSON;
- copy the preview JSON to `public/data/music.json`;
- run data shape and privacy checks;
- inspect Git diff and status.

Forbidden in this replacement:

- do not run `build_archive.py`;
- do not run npm dev/build/preview;
- do not run the release script;
- do not modify old OneDrive Data;
- do not modify any file in `public/data` except `music.json`;
- do not modify `src/data`;
- do not modify cache or reports data;
- do not perform Git add, commit, or push.

## Replacement Result

Result: pass.

- Replaced file: `public/data/music.json`.
- Source preview: system-temp live-compatible Music preview.
- `music.json` item count after replacement: 33.
- Item field set remains:

```text
id, title, cover, description, content, audio, url, track_title
```

- Cover paths still use `webp_cache`.
- Audio paths still use `audio_cache`.
- Preview and `public/data/music.json` content hashes match after replacement.
- `build_archive.py` was not run.
- Git write operations were not performed.
- Release script was not run.

## Diff Summary

Current diff for `public/data/music.json`:

```text
1 file changed, 33 insertions(+), 33 deletions(-)
```

The replacement updates Music item content from v2-derived data while preserving live-compatible IDs and media paths.

## Validation

Commands run after replacement:

```powershell
node scripts/check-public-data-shape.mjs
node scripts/check-generated-data-privacy.mjs
node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs
git diff --stat -- public/data/music.json
git diff --numstat -- public/data/music.json
git status --short --branch
```

Results:

- Public data shape check: pass.
- Generated data privacy check: pass.
- Live-compatible preview generator: pass.
- `public/data/music.json` diff: 33 insertions, 33 deletions.
- `public/data/music.json` is the only modified live public data file from this replacement.

## Git Boundary

The replacement is not committed.

Current Git scope now includes:

- previous ArchiveData-v2 design/task/script changes;
- modified `public/data/music.json`.

The generated external `ArchiveData-v2` pilot output remains outside the project Git worktree.

Recommended commit grouping later:

1. ArchiveData-v2 design, audit, dry-run, and Music pilot tooling.
2. Music live-compatible replacement tooling and acceptance records.
3. `public/data/music.json` live-compatible replacement.

Do not push until the user explicitly requests it.

## Rollback

To roll back this replacement:

```powershell
git restore -- public/data/music.json
node scripts/check-public-data-shape.mjs
```

Do not run `build_archive.py` as rollback.

## Recommended Next Task

Do a repository-wide change review and commit plan.

The review should decide how to group the many ArchiveData-v2 docs/scripts and the `public/data/music.json` replacement into commits. It should not push.

