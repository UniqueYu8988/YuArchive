# Legacy Generation / Publish Retirement Plan

## Goal

Design a safe retirement path for the legacy generation and publish chain:

- `build_archive.py`
- `一键发布到云端.bat`

This task is part of the old `Data` retirement process. It does not modify either script. It only classifies current dependencies and recommends the order for future protective changes.

## Scope

Allowed:

- Read `build_archive.py`.
- Read `一键发布到云端.bat`.
- Read `package.json`.
- Read project scripts and documentation to classify old `Data` references.
- Add a read-only dependency audit script.
- Record the recommended retirement path.

Forbidden:

- Do not run `build_archive.py`.
- Do not run the publish script.
- Do not run npm dev/build/preview.
- Do not modify old OneDrive `Data`.
- Do not modify current `Archive`.
- Do not modify public JSON, generated data, caches, reports, or source media.
- Do not execute Git write operations.

## Current Findings

`build_archive.py` is still a legacy generator. It:

- reads old `Data`;
- writes `public/data`;
- writes `src/data/archive_data.json` and `src/data/site_config.json`;
- writes media caches;
- writes reports;
- can call network lookup code;
- can call subprocesses for media conversion;
- can write back game `meta.yaml` templates.

`一键发布到云端.bat` is still a legacy publish chain. It:

- runs `python -X utf8 build_archive.py`;
- runs `git add -A`;
- runs `git commit`;
- runs `git push`.

`package.json` does not currently chain `build_archive.py` or the publish script from npm scripts.

## Read-Only Audit Script

The dependency audit script is:

`scripts/audit-legacy-generation-publish-dependencies.mjs`

It checks:

- whether `build_archive.py` exists;
- whether the one-click publish script exists;
- whether npm scripts call `build_archive.py` or the publish script;
- key legacy generator capability markers;
- key publish script Git operation markers;
- project file categories that still reference old `Data`, `ARCHIVE_SOURCE_ROOT`, `build_archive.py`, or the publish script.

## First Run Result

Command:

```bash
node scripts/audit-legacy-generation-publish-dependencies.mjs
```

Result:

- Audit completed successfully.
- Legacy generator exists.
- Legacy publish script exists.
- npm scripts do not call the legacy generator or publish script.
- The legacy generator still has source-read, generated-output, cache-output, reports-output, network, subprocess, and source-write markers.
- The publish script still has build, stage, commit, and push markers.
- Retirement recommendation is to keep both disabled by default until they are guarded, renamed, or replaced.
- Blocking markers:
  - legacy generator reads old `Data`;
  - legacy generator can write source YAML;
  - legacy publish script runs the legacy generator;
  - legacy publish script performs Git write operations.

Current classification:

| Area | Result |
|---|---|
| npm scripts | do not call legacy generation or publish |
| legacy generator | still high risk |
| legacy publish script | still high risk |
| best next step | add explicit publish-script guard or mark legacy-only |

## Retirement Options

### Option A: Mark legacy-only and keep disabled

Add clear naming and documentation that these scripts are legacy-only. This is low risk, but does not prevent accidental execution by itself.

### Option B: Add explicit guard to the publish script

Require a deliberate confirmation phrase before it can run. This reduces accidental publish risk but still leaves the old generation path intact.

### Option C: Split generation and publishing

Replace the one-click script with separate explicit steps: validate, generate/sync, review diff, commit, push. This is safer and more aligned with Archive Studio.

### Option D: Replace old generation with Archive-based generation

Build or formalize an Archive-based public sync/generation path. This is the long-term direction, but it should be done after coverage and dependency audits are clean.

## Recommendation

Next small task should be a design-only or minimal-guard task for the legacy publish script:

1. Do not delete old `Data`.
2. Do not remove `build_archive.py` yet.
3. First prevent accidental legacy publishing.
4. Then decide whether `build_archive.py` should become legacy-only, guarded, or replaced by Archive-based generation.

## Rollback

This task only adds documentation and a read-only audit script. Rollback is removing this document and `scripts/audit-legacy-generation-publish-dependencies.mjs`, plus the related status notes.
