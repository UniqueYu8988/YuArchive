# Legacy Data Retirement Audit

## Goal

Start a safe retirement process for the old OneDrive `Data` directory now that daily maintenance has moved to `Archive` and Archive Studio.

This task does not delete, rename, move, migrate, or rewrite any source data. It only records the current relationship between old `Data`, current `Archive`, legacy generators, and the public website.

## Boundaries

Allowed:

- Read current project documents and scripts.
- Read directory shape and file counts for old `Data` and current `Archive`.
- Search code and scripts for references to the old data root.
- Record retirement criteria and next safe steps.

Forbidden:

- Do not modify old OneDrive `Data`.
- Do not modify current `Archive`.
- Do not run `build_archive.py`.
- Do not run the one-click publish script.
- Do not modify public JSON, caches, reports, or source media.
- Do not delete or rename old `Data`.
- Do not execute Git write operations.

## Current Facts

- Old `Data` still exists and has the four legacy board directories: `Games`, `Visions`, `Music`, and `Texts`.
- Current `Archive` exists and has `config`, `entries`, and `migration`.
- Current `Archive` contains v2 entries for all four boards and current config files.
- Archive Studio is the current daily maintenance path for normal create/update and public sync.
- The public website reads `public/data/*.json` at runtime, not old `Data` directly.
- Old `build_archive.py` still reads old `Data` directly.
- The one-click publish script still runs `build_archive.py` before Git commit and push.

## Read-Only Count Snapshot

The first audit pass counted only files, extensions, and entry markers. It did not output titles, notes, body text, accounts, tokens, or full private file paths.

Old `Data` snapshot:

| Board | Files | YAML/YML | Markdown | Media |
|---|---:|---:|---:|---:|
| Games | 329 | 8 | 0 | 321 |
| Visions | 157 | 6 | 0 | 151 |
| Music | 101 | 0 | 33 | 68 |
| Texts | 187 | 1 | 132 | 54 |

Current `Archive` snapshot:

| Board | Files | entry.yaml | content.md | Media |
|---|---:|---:|---:|---:|
| games | 647 | 284 | 0 | 323 |
| music | 136 | 34 | 34 | 68 |
| texts | 318 | 132 | 132 | 54 |
| visions | 283 | 112 | 0 | 151 |

Current `Archive` config files:

- `games.yaml`
- `homepage.yaml`
- `texts-sections.yaml`
- `visions-periods.yaml`

## Current Relationship to the Website

Old `Data` is no longer the intended daily maintenance source for the website. It remains related in two indirect ways:

1. Legacy generation: `build_archive.py` still reads old `Data` and can write public JSON, caches, reports, and the ignored aggregate JSON.
2. Legacy publish path: the one-click publish script still runs `build_archive.py` before Git commit and push.

The current public website itself reads generated `public/data/*.json`. It does not directly read either old `Data` or current `Archive` at runtime.

## Why Not Delete Now

Old `Data` should not be deleted yet because:

- It is the legacy source and rollback baseline.
- It is still referenced by the legacy generator and several migration, audit, check, and smoke-test scripts.
- It is still useful for validating whether `Archive` has complete coverage.
- Removing it before retiring old generation paths could break legacy checks or accidentally hide missing migration coverage.
- Deletion is not easily reversible unless an external backup has already been verified.

## Retirement Criteria

Old `Data` can only move from active read-only baseline to cold archive after all of these are true:

- `Archive` coverage is confirmed for Games, Visions, Music, Texts, and homepage/config.
- Archive Studio create/update flows are stable enough for normal maintenance.
- Public sync can update `public/data/*.json` from `Archive` without using old `Data`.
- A read-only coverage audit confirms no expected source assets or config are missing from `Archive`.
- Legacy `build_archive.py` and the one-click publish script are retired, guarded, or clearly marked as legacy-only.
- An external backup of old `Data` has been verified.
- A retention period has passed without needing old `Data` for recovery.

## Recommended Retirement Phases

### Phase 1: Read-Only Coverage Audit

Compare old `Data` and current `Archive` by board using counts, stable IDs, media roles, and config coverage. Do not compare or output full content.

### Phase 2: Legacy Dependency Audit

List every script that still reads old `Data`, and classify each as:

- legacy generator;
- migration/audit helper;
- Studio safety check;
- smoke-test baseline;
- obsolete helper.

### Phase 3: Generation Path Decision

Decide whether to retire `build_archive.py`, keep it as legacy-only, or replace it with Archive-based generation.

### Phase 4: Publish Path Guard

Ensure no publish path can accidentally regenerate from old `Data` and push without explicit confirmation.

### Phase 5: Cold Archive

Only after coverage, dependency, and backup checks pass, move old `Data` out of the active workflow or keep it as a clearly labeled cold backup.

## Current Recommendation

Do not delete or rename old `Data` yet.

The next safe task is a read-only coverage audit that compares old `Data` and current `Archive` by board and role, then reports only counts, missing categories, and dependency blockers.

## Rollback

This task only creates project Markdown documentation. Rollback is removing this document and the related status notes. No OneDrive source data, current Archive data, generated public JSON, cache, report, or Git tracking state is changed by this task.
