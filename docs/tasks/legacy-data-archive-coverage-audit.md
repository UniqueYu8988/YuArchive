# Legacy Data / Archive Coverage Audit

## Goal

Add a repeatable read-only audit that compares the old OneDrive `Data` directory with the current `Archive` directory at the board and file-role level.

This is the next step after `docs/tasks/legacy-data-retirement-audit.md`. It helps decide what must be true before the old `Data` directory can move from active read-only baseline to cold backup.

## Scope

Allowed:

- Read old `Data` directory structure and count files by board and role.
- Read current `Archive` directory structure and count v2 entries, content files, media files, migration files, and config files.
- Read project scripts to identify references to old `Data`.
- Output only counts, board names, role names, config filenames, and relative project filenames.

Forbidden:

- Do not modify old `Data`.
- Do not modify current `Archive`.
- Do not run `build_archive.py`.
- Do not run `npm run dev`, `npm run build`, or `npm run preview`.
- Do not run the publish script.
- Do not modify `public/data`, `src/data`, cache directories, reports, or source media.
- Do not output titles, body text, rating detail, account data, tokens, secrets, or full private file paths.

## Script

The read-only audit script is:

`scripts/audit-legacy-data-archive-coverage.mjs`

It checks:

- whether old `Data` and current `Archive` exist;
- old board file counts for Games, Visions, Music, and Texts;
- current Archive entry counts and role counts for each board;
- current Archive config files;
- project files that still reference the old source root or `build_archive.py`;
- whether old `Data` appears ready for retirement.

The script intentionally does not produce a full migration diff. It is a retirement-readiness signal, not a cleanup or migration tool.

## Current Expected Result

Old `Data` should remain **not ready for deletion** while:

- `build_archive.py` still reads old `Data`;
- the one-click publish script still runs `build_archive.py`;
- migration, audit, shape-check, and smoke-test scripts still use old `Data` as baseline;
- no final cold-backup and retention decision has been made.

## First Run Result

Command:

```bash
node scripts/audit-legacy-data-archive-coverage.mjs
```

Result:

- Audit completed successfully.
- `retirementReady: false`.
- Old `Data` exists.
- Current `Archive` exists.
- Archive has all four board entry roots and current config files.
- The blocking dependency count is 2:
  - legacy generator;
  - legacy publish path.
- Additional non-blocking references remain in documentation, migration/audit/check scripts, and Studio/smoke-test safety code.

Interpretation:

Old `Data` is no longer the daily maintenance source, but it is still needed as a read-only baseline and legacy dependency. It is not suitable for deletion or rename yet.

## Validation

Run:

```bash
node scripts/audit-legacy-data-archive-coverage.mjs
```

Expected behavior:

- The command exits successfully when the audit can complete.
- The result may still say `retirementReady: false`.
- `retirementReady: false` is expected until legacy generator and publish dependencies are retired or guarded.

## Rollback

Remove this task file and `scripts/audit-legacy-data-archive-coverage.mjs`. No source data, Archive data, generated JSON, cache, report, or Git state is changed by this task.
