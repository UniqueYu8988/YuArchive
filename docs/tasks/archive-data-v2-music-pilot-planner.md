# archive-data-v2-music-pilot-planner

## Goal

Add a read-only planner for the future Music-only Archive pilot migration.

The planner proves that the Music pilot has a complete and non-conflicting target plan before any write-enabled migration is considered.

## Allowed Scope

- Add `scripts/plan-archive-data-v2-music-pilot.mjs`.
- Read old OneDrive Data `Music` structure.
- Read Music Markdown frontmatter and file names.
- Match Music Markdown entries with cover and audio files.
- Build an in-memory target plan for `entries/music/album/<entry-id>/`.
- Report aggregate target directory counts, target file role counts, collision counts, missing media counts, and manual-confirmation counts.
- Update status and stabilization Markdown.

## Forbidden Scope

- Do not modify OneDrive Data.
- Do not create an `Archive` directory.
- Do not copy, move, rename, delete, or rewrite Music Markdown, cover, or audio files.
- Do not write `entry.yaml`, `content.md`, migration manifests, checksums, generated data, or reports.
- Do not modify `build_archive.py`.
- Do not run `build_archive.py`.
- Do not modify `public/data`, `src/data`, caches, reports data, or frontend code.
- Do not run npm dev/build/preview or the release script.
- Do not perform Git write operations.
- Do not output full local paths, account data, secrets, tokens, long Markdown bodies, or long title lists.

## Planner Rules

The planner treats each Music root Markdown file as one `music/album` entry.

For each planned entry, the virtual target shape is:

```text
entries/music/album/<entry-id>/
├─ entry.yaml
├─ content.md
├─ cover.<ext>
└─ audio.<ext>
```

The planner checks:

- Markdown files are readable.
- Frontmatter is parseable enough to inspect basic fields.
- A stable target id can be generated from the source stem.
- Generated target ids do not collide.
- Cover and audio files can be matched using the same broad conventions as the existing Music media shape check.
- No existing `Archive` directory is required or created.

## Output

The script reports counts only:

- source Markdown count;
- cover and audio source file counts;
- planned album entries;
- planned target directories;
- planned target file roles;
- id collision count;
- missing cover/audio counts;
- manual-confirmation count;
- write actions, always `0`.

It does not print full local paths, checksums, Markdown bodies, or a title list.

## Verification

Run:

```powershell
node scripts/plan-archive-data-v2-music-pilot.mjs
```

Expected result:

- The command exits successfully.
- The command reports 33 planned Music album entries.
- The command reports 33 planned target directories.
- The command reports 33 `entry_yaml`, 33 `content_md`, 33 `cover`, and 33 `audio` target roles.
- The command reports zero id collisions and zero missing cover/audio files.
- The command reports zero write actions.
- No `Archive` directory is created.

Latest result on 2026-06-16:

- Result: pass.
- Markdown entries: 33.
- Readable Markdown files: 33.
- Frontmatter errors: 0.
- Cover source files: 33.
- Audio source files: 33.
- Planned entries: 33.
- Planned target directories: 33.
- Planned target roles: 132.
- Target roles: `entry_yaml:33`, `content_md:33`, `cover:33`, `audio:33`.
- ID collisions: 0.
- Manual ID required: 0.
- Missing covers: 0.
- Missing audio: 0.
- Manual confirmations: 0.
- Existing `Archive` directory: false.
- Write actions: 0.

The script was also checked for common write, network, build, release, and Git command calls; no matches were found.

## Rollback

Delete `scripts/plan-archive-data-v2-music-pilot.mjs` and this task file, then remove related notes from `CURRENT_STATE.md` and `docs/plans/STABILIZATION_PLAN.md`.
