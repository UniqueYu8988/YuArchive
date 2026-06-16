# archive-data-v2-migration-audit

## Goal

Create a read-only migration audit for the future ArchiveData-v2 migration.

This task does not migrate data. It only counts and classifies legacy OneDrive Data entries, files, metadata fields, and likely v2 kind mappings so the next `migration dry-run` can be designed from evidence.

## Allowed Scope

- Add `scripts/audit-archive-data-v2-migration.mjs`.
- Read legacy OneDrive Data structure.
- Read YAML keys and Markdown frontmatter keys.
- Count source files by board and extension.
- Estimate v2 board/kind mapping counts.
- Report unmapped or manually-confirm-needed counts.
- Update `CURRENT_STATE.md` and `docs/plans/STABILIZATION_PLAN.md`.

## Forbidden Scope

- Do not modify OneDrive Data.
- Do not create an `ArchiveData-v2` data directory.
- Do not copy, move, rename, delete, or rewrite source files.
- Do not write migration manifests, unmapped files, checksums, or generated data.
- Do not modify `build_archive.py`.
- Do not run `build_archive.py`.
- Do not modify `public/data`, `src/data`, caches, reports data, or frontend code.
- Do not run npm dev/build/preview or the release script.
- Do not perform Git write operations.
- Do not output full local paths, account data, secrets, tokens, long Markdown bodies, or rating details.

## Audit Rules

The script reports counts only:

- legacy source files by board and extension;
- likely entry counts by board and v2 kind;
- metadata/frontmatter key sets by board;
- config references from homepage/layout/ui;
- files or fields that need manual confirmation before migration.

It intentionally does not:

- generate stable final v2 ids;
- compute or persist checksums;
- create `migration-manifest.json`;
- infer subjective fields;
- decide ambiguous kind mappings for the user.

## Verification

Run:

```powershell
node scripts/audit-archive-data-v2-migration.mjs
```

Expected result:

- The command exits successfully.
- Output contains board-level counts and manual-confirmation counts.
- Output contains no full local paths or long content.
- No source files or generated files are modified.

## Current Result

Last run:

```powershell
node scripts/audit-archive-data-v2-migration.mjs
```

Result:

- Source boards: 4
- Total source files: 774
- Parse errors: 0
- Manual-confirmation count: 218
- Games likely mapping: `normal_game` 273, `dlc` 6, `live_game` 3, live season assets 40
- Visions likely mapping: `movie` 111, `series` 40, `showcase` 1, showcase assets 40
- Music likely mapping: `album` 33, cover assets 33, audio assets 33
- Texts likely mapping: `article` 15, `book_note` 54, `series_note` 63

Notes:

- The script originally exposed some metadata top-level titles as field keys; this was corrected so output stays at field/count level.
- Manual-confirmation counts are not automatic errors. They identify relationships that dry-run must preserve or report, such as DLC parent mapping, live season mapping, showcase asset mapping, and Texts section-to-kind mapping.

## Rollback

Delete `scripts/audit-archive-data-v2-migration.mjs` and this task file, then remove the related notes from `CURRENT_STATE.md` and `docs/plans/STABILIZATION_PLAN.md`.
