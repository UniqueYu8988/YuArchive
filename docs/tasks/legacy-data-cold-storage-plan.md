# Legacy Data Cold Storage Plan

## Goal

Prepare a safe cold-storage plan for old `Data` without deleting, moving, or modifying it.

Old `Data` is no longer the daily maintenance entry, but it remains a migration source, rollback baseline, and legacy generator dependency. It must not be removed until the project can prove both runtime independence and a verified cold backup or transfer path.

## Scope

Allowed:

- Read old `Data`.
- Count files and top-level entries.
- Compute file sizes and SHA-256 hashes.
- Produce a dry-run manifest summary in terminal output.

Forbidden:

- Do not move old `Data`.
- Do not delete old `Data`.
- Do not modify old `Data`.
- Do not write a cold backup yet.
- Do not run `build_archive.py`.
- Do not run the legacy publish script.
- Do not expose full local paths or collection content.

## Cold Storage Proposal

When the user explicitly authorizes transfer, use this shape:

```text
[Archive]/_cold_storage/legacy-data-YYYYMMDD-HHMMSS/
├─ Data/
└─ legacy-data-cold-storage-manifest.json
```

The transfer task should:

1. Create the cold-storage directory.
2. Copy old `Data` into it.
3. Write a manifest containing relative paths, file sizes, hashes, and totals.
4. Verify every copied file against the manifest.
5. Only after verification, optionally remove or rename the original old `Data`.

For the first implementation, prefer copy-only. Deletion of the original old `Data` folder should be a separate explicit step.

## Dry-Run Script

The dry-run script is:

`scripts/plan-legacy-data-cold-storage.mjs`

It reports:

- whether old `Data` exists;
- total files;
- total bytes;
- top-level entry names;
- latest modified time;
- proposed cold-storage target label;
- SHA-256 digest over all manifest records.

It does not write any file.

## Validation

Run:

```bash
node scripts/plan-legacy-data-cold-storage.mjs
```

Expected current result:

- dry-run succeeds;
- files are detected;
- result recommends copy-only cold storage before deletion.

First recorded run:

- result: pass;
- files: 778;
- total bytes: 900,422,560;
- latest modified time: 2026-05-01;
- deletion recommended now: false;
- next step: copy to cold storage and verify before any delete.

The dry-run is also included in `scripts/run-retirement-readiness-experiments.mjs` as `legacy_data_cold_storage_plan`. It is evidence for a future transfer task, not permission to delete old `Data`.

## Rollback

This task only adds a plan and a dry-run script. Rollback is removing this document and `scripts/plan-legacy-data-cold-storage.mjs`.
