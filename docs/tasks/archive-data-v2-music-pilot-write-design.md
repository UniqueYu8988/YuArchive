# archive-data-v2-music-pilot-write-design

## Goal

Design the first write-enabled Music-only Archive pilot migration.

This document is an approval gate. It describes what a future migration task may write, how it must prove old source data stayed unchanged, and how the generated pilot output can be removed. This task does not execute the migration.

## Current Preconditions

Evidence already collected:

- Music source-side media check passes with 33 Markdown entries, 33 covers, and 33 audio files matched.
- Archive full dry-run reports `music/album:33` and zero unmapped files overall.
- Music v2 pilot planner reports 33 planned album entries, 33 target directories, and 132 target file roles.
- Music v2 pilot planner reports zero ID collisions, zero missing covers, zero missing audio, and zero manual confirmations.
- No real `Archive` directory exists yet.

These preconditions should be rechecked immediately before any write-enabled task runs.

## Proposed Write Scope

A future write-enabled pilot may create only this new output tree:

```text
Archive/
├─ entries/
│  └─ music/
│     └─ album/
│        └─ <entry-id>/
│           ├─ entry.yaml
│           ├─ content.md
│           ├─ cover.<ext>
│           └─ audio.<ext>
└─ migration/
   ├─ migration-manifest.json
   ├─ unmapped-files.json
   └─ legacy-field-report.md
```

The pilot must not write outside `Archive/`.

## Allowed In A Future Execution Task

Only after explicit user approval, the execution task may:

- Create `Archive/`.
- Create `Archive/entries/music/album/<entry-id>/` directories.
- Write `entry.yaml` for each Music album entry.
- Write `content.md` from the corresponding source Markdown content.
- Copy matched cover files as `cover.<original-extension>`.
- Copy matched audio files as `audio.<original-extension>`.
- Write `Archive/migration/migration-manifest.json`.
- Write `Archive/migration/unmapped-files.json`.
- Write `Archive/migration/legacy-field-report.md`.
- Compute SHA-256 checksums for old source files and new copied files.
- Use a temporary file outside the project if needed for source hash baselines.

## Forbidden In A Future Execution Task

The execution task must not:

- Modify old OneDrive Data.
- Rename, delete, move, or rewrite old Music Markdown, Covers, or Songs files.
- Modify Games, Visions, Texts, homepage config, layout config, or UI config.
- Modify `build_archive.py`.
- Run `build_archive.py`.
- Modify `public/data`, `src/data`, caches, reports data, or frontend code.
- Run npm dev/build/preview.
- Run the release script.
- Perform Git add, commit, push, or branch operations unless separately authorized.
- Guess subjective fields such as user notes, ratings, categories, descriptions, or media choices.
- Enter Archive Studio frontend work.

## Stop Conditions

The future execution task must stop before writing if any of these occur:

- `Archive/` already exists and is not explicitly approved for replacement.
- Music source-side check fails or reports warnings.
- Music pilot planner reports ID collisions, missing cover, missing audio, manual ID required, or manual confirmations.
- Source hash baseline cannot be computed.
- A planned target path would escape `Archive/`.
- A planned source file is outside the old Music source directory.

The future execution task must stop after writing and report before any further action if:

- Old OneDrive Data hashes change.
- Any copied file checksum differs from its source checksum.
- Generated entry count is not 33.
- Any source Markdown, cover, or audio file lacks a manifest destination.
- Any migration report contains a full local path or machine-specific root.

## Source Hash Baseline

Before writing, the future execution task should compute hashes for the old Music source files only:

- Music root Markdown entries;
- Music `Covers` files;
- Music `Songs` files.

The baseline should be kept outside the repository or in memory. Final reporting should include only counts and change totals, not full local paths or content.

Expected baseline counts from current evidence:

- Markdown files: 33.
- Cover files: 33.
- Audio files: 33.
- Total Music source files in the pilot baseline: 99.

## Entry Output Rules

Each old Music Markdown entry becomes one v2 `music/album` entry.

`entry.yaml` should include only stable, minimal fields:

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

Rules:

- `id` is generated from the old Markdown file stem using the reviewed planner logic.
- `board` is always `music`.
- `kind` is always `album`.
- `title` is derived from existing source metadata or source stem.
- Missing optional fields should be omitted or left blank; they must not be invented.
- `legacy` may store old relative source names and source roles, but must not store full local paths.

## Content And Media Rules

- Markdown body becomes `content.md`.
- Matched cover becomes `cover.<original-extension>`.
- Matched audio becomes `audio.<original-extension>`.
- Cover and audio bytes must be copied exactly.
- File checksums must verify old source bytes and new copied bytes match.
- The pilot should preserve original media extensions.

## Migration Manifest Rules

`migration-manifest.json` should include one record per source file used by the pilot.

Recommended fields:

```json
{
  "board": "music",
  "kind": "album",
  "entryId": "",
  "sourceRole": "",
  "sourceRelative": "",
  "targetRole": "",
  "targetRelative": "",
  "sha256": "",
  "status": "copied"
}
```

Rules:

- `sourceRelative` and `targetRelative` must be relative identifiers only.
- Manifest records must not include full local paths.
- Every source Markdown, matched cover, and matched audio file must have exactly one manifest record.
- Current expected manifest records: 99.

## Unmapped Report Rules

`unmapped-files.json` should exist even when empty.

For the current pilot, expected result:

```json
[]
```

If any Music source file has no destination, the future execution task should stop unless the user has explicitly approved a degraded run.

## Legacy Field Report Rules

`legacy-field-report.md` should summarize:

- which old fields were mapped into `entry.yaml`;
- which old fields were preserved under `legacy`;
- which optional fields were absent;
- whether any fields require manual confirmation.

It should not include long Markdown bodies, full local paths, or secrets.

## Validation Commands

Before future execution:

```powershell
node scripts/check-source-data-shape.mjs
node scripts/check-music-media-shape.mjs
node scripts/plan-archive-data-v2-music-pilot.mjs
git status --short --branch
```

After future execution:

```powershell
node scripts/check-source-data-shape.mjs
node scripts/check-music-media-shape.mjs
node scripts/plan-archive-data-v2-music-pilot.mjs
git status --short --branch
```

A v2 Music shape check should be created after the pilot output exists, before treating the pilot as accepted.

## Acceptance Criteria

The future write-enabled pilot is accepted only if:

- Old Music source hash baseline reports zero changes after execution.
- 33 v2 Music album directories are created.
- 33 `entry.yaml` files are created.
- 33 `content.md` files are created.
- 33 cover files are copied.
- 33 audio files are copied.
- `migration-manifest.json` records 99 source file mappings.
- `unmapped-files.json` exists and is empty.
- `legacy-field-report.md` exists.
- No full local paths or machine-specific roots appear in v2 output reports.
- Existing source-side checks still pass.
- No `build_archive.py`, frontend data, cache, reports data, or old source files are modified.

## Execution Result

Latest result on 2026-06-16:

- Result: pass.
- The first attempted run stopped on a checksum validation design issue before completion. The partial generated pilot output contained 4 files and was removed using the documented rollback path.
- The migration script was corrected so Markdown records are treated as a frontmatter-to-`entry.yaml` transformation plus body-to-`content.md`, while cover and audio files remain byte-for-byte copies.
- Final run succeeded.
- Source baseline files: 99.
- Source changed files after migration: 0.
- Source missing files after migration: 0.
- Entries created: 33.
- `entry.yaml` files: 33.
- `content.md` files: 33.
- Cover files copied: 33.
- Audio files copied: 33.
- Manifest records: 99.
- Unmapped files: 0.
- `build_archive.py` was not run.
- Release script was not run.

Post-run validation:

- `node scripts/check-source-data-shape.mjs`: pass.
- `node scripts/check-music-media-shape.mjs`: pass.
- `node scripts/check-archive-data-v2-music-shape.mjs`: pass.
- Generated v2 migration reports have zero local-path or secret-like rule hits.

## Rollback

Rollback should be limited to deleting the generated `Archive/` pilot output.

After rollback:

```powershell
node scripts/check-source-data-shape.mjs
node scripts/check-music-media-shape.mjs
git status --short --branch
```

Rollback must not run `build_archive.py`, modify old OneDrive Data, or run the release script.

## Recommended Next Task

If the user approves a write-enabled pilot, implement a narrowly scoped migration script for Music only. The script should refuse to run if `Archive/` already exists unless an explicit overwrite/clean option is designed and approved.
