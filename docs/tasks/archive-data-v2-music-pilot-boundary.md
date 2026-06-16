# archive-data-v2-music-pilot-boundary

## Goal

Design the boundary for a future Music-only ArchiveData-v2 pilot migration.

This task does not migrate data. It defines the smallest safe write-enabled pilot that could be run later after explicit approval.

## Why Music First

Music is the lowest-risk board for a v2 pilot:

- Current source shape is regular: root Markdown entries, `Covers`, and `Songs`.
- Existing source-side check reports 33 Markdown entries, 33 covers, and 33 audio files matched.
- ArchiveData-v2 design already marks `music/album` as the v0 priority kind.
- The dry-run reports `music/album:33`, `audio:33`, and cover roles that can be verified by checksum.

## Current Evidence

- `scripts/check-music-media-shape.mjs` passes with zero warnings.
- `scripts/audit-archive-data-v2-migration.mjs` reports Music as 33 likely `album` entries.
- `scripts/dry-run-archive-data-v2-migration.mjs` reports zero unmapped files overall.
- No real `ArchiveData-v2` data directory has been created.
- Old OneDrive Data remains the source of truth and must stay unchanged during the pilot.

## Proposed Pilot Scope

The pilot should migrate only Music album entries into a new, isolated v2 output location.

Recommended target shape:

```text
ArchiveData-v2/
├─ entries/
│  └─ music/
│     └─ album/
│        └─ <entry-id>/
│           ├─ entry.yaml
│           ├─ content.md
│           ├─ cover.*
│           └─ audio.*
└─ migration/
   ├─ migration-manifest.json
   ├─ unmapped-files.json
   └─ legacy-field-report.md
```

The first write-enabled pilot should not migrate Games, Visions, Texts, homepage config, layout config, UI config, reports, caches, or generated frontend JSON.

## Allowed In A Future Write-Enabled Pilot

Only after explicit approval, a pilot migration may:

- Create `ArchiveData-v2/` if it does not exist.
- Create `entries/music/album/<entry-id>/` directories.
- Copy Music Markdown bodies into `content.md`.
- Copy matched cover files as `cover.<ext>`.
- Copy matched audio files as `audio.<ext>`.
- Create `entry.yaml` files for Music album entries.
- Create migration reports under `ArchiveData-v2/migration/`.
- Compute and write checksums for copied source files.

## Forbidden In The Pilot

The pilot must not:

- Modify old OneDrive Data.
- Rename, delete, or rewrite Music Markdown, Covers, or Songs source files.
- Modify `build_archive.py`.
- Run `build_archive.py`.
- Modify `public/data`, `src/data`, caches, or reports data.
- Migrate Games, Visions, Texts, or homepage config.
- Guess subjective fields such as ratings, notes, categories, descriptions, or media choices.
- Enter Archive Studio frontend work.
- Run release or Git push commands.

## Entry Mapping Rules

Each Music Markdown source entry maps to one `music/album` v2 entry.

Suggested `entry.yaml` fields:

```yaml
id:
board: music
kind: album
title:
date:
url:
note:
description:
track_title:
legacy:
```

Field handling:

| Field | Source | Handling |
|---|---|---|
| `id` | generated from file stem | stable slug; collisions require manual report |
| `board` | constant | `music` |
| `kind` | constant | `album` |
| `title` | source file stem or frontmatter if available | public display field |
| `date` | source metadata if available | optional |
| `url` | source metadata if available | optional |
| `note` | source metadata if available | optional short field |
| `description` | existing frontmatter | preserve if present |
| `track_title` | source metadata if available | optional |
| `legacy` | old relative source facts | preserve old file names and source roles without full local paths |

The pilot should not invent missing fields. Missing optional fields may remain empty or absent.

## File Mapping Rules

For each Music album:

- Source Markdown body becomes `content.md`.
- Matched cover becomes `cover.<original-extension>`.
- Matched audio becomes `audio.<original-extension>`.
- Source file names and source roles are recorded in migration metadata using relative identifiers, not full local paths.
- Checksums are recorded for source and copied files to prove no byte loss during copying.

If an entry lacks a matched cover or audio in a future run, the pilot should not guess a replacement. It should report the item as requiring manual confirmation and stop or continue only in an explicitly degraded mode.

## Migration Reports

The pilot should write reports only inside `ArchiveData-v2/migration/`:

- `migration-manifest.json`: source role, relative source identifier, target role, target relative path, checksum, and status.
- `unmapped-files.json`: any Music source file that has no destination.
- `legacy-field-report.md`: fields preserved in `legacy`, fields omitted because empty, and fields needing human confirmation.

Reports must not contain full local paths, account data, secrets, tokens, or private machine-specific roots.

## Acceptance Criteria

The pilot is acceptable only if all of these are true:

- Old OneDrive Data file hashes are unchanged before and after the pilot.
- Music source counts are preserved: 33 Markdown entries, 33 covers, and 33 audio files, unless a later source change is explicitly explained.
- V2 Music album entry count is 33.
- Every source Markdown, cover, and audio file has a target role or a report entry.
- Checksums can verify copied Markdown, cover, and audio files.
- `scripts/check-music-media-shape.mjs` still passes after the pilot.
- A future v2 Music shape check passes after it is created.
- No `public/data`, `src/data`, caches, reports data, or old source files are modified.
- The generated `ArchiveData-v2/` pilot output can be deleted without affecting the old site.

## Validation Commands

Before a future write-enabled pilot:

```powershell
node scripts/check-source-data-shape.mjs
node scripts/check-music-media-shape.mjs
node scripts/dry-run-archive-data-v2-migration.mjs
git status --short --branch
```

After a future write-enabled pilot:

```powershell
node scripts/check-source-data-shape.mjs
node scripts/check-music-media-shape.mjs
git status --short --branch
```

A future v2-specific check should be added before treating the pilot output as complete.

## Rollback

Because the pilot must not modify old OneDrive Data, rollback should be simple:

1. Delete the generated `ArchiveData-v2/` pilot output.
2. Re-run the source-side checks.
3. Confirm old OneDrive Data hashes are unchanged.
4. Do not run `build_archive.py` or the release script as part of rollback.

## Recommended Next Task

Create a read-only v2 Music pilot planner that outputs the exact Music target directories, target file roles, and collision/manual-confirmation counts without writing `ArchiveData-v2/`.

Do not proceed directly to write-enabled migration until that planner is reviewed.
