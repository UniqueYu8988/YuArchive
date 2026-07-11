# Archive Migration Cold Storage Plan

## Goal

Prepare a safe cold-storage path for `Archive/migration` without deleting or moving it yet.

`Archive/migration` is not daily maintenance data, but it still contains migration manifests, legacy field reports, unmapped file reports, and Archive Studio transaction records. These records should be preserved before any cleanup.

## Scope

Allowed:

- Read `Archive/migration`.
- Count files and directories.
- Compute file sizes and SHA-256 hashes.
- Produce a dry-run manifest in terminal output.

Forbidden:

- Do not move `Archive/migration`.
- Do not delete `Archive/migration`.
- Do not modify current `Archive`.
- Do not modify old `Data`.
- Do not write a cold backup yet.
- Do not run `build_archive.py`.
- Do not run the legacy publish script.

## Cold Storage Proposal

When the user explicitly authorizes transfer, use this shape:

```text
[Archive]/_cold_storage/migration-YYYYMMDD-HHMMSS/
├─ migration/
└─ migration-cold-storage-manifest.json
```

The transfer task should:

1. Create the cold-storage directory.
2. Copy `Archive/migration` into it.
3. Write a manifest containing relative paths, file sizes, hashes, and totals.
4. Verify every copied file against the manifest.
5. Only after verification, optionally remove the original `Archive/migration`.

For the first implementation, prefer copy-only. Deletion of the original migration folder should be a separate explicit step.

## Dry-Run Script

The dry-run script is:

`scripts/plan-archive-migration-cold-storage.mjs`

It reports:

- whether `Archive/migration` exists;
- total files;
- total bytes;
- top-level directory names;
- latest modified time;
- proposed cold-storage target label;
- SHA-256 digest over all manifest records.

It does not write any file.

## Validation

Run:

```bash
node scripts/plan-archive-migration-cold-storage.mjs
```

Expected current result:

- dry-run succeeds;
- files are detected;
- result recommends copy-only cold storage before deletion.

First recorded run:

- result: pass;
- files: 21;
- total bytes: 531,583;
- latest modified time: 2026-06-28;
- deletion recommended now: false;
- next step: copy to cold storage and verify before any delete.

The dry-run is also included in `scripts/run-retirement-readiness-experiments.mjs` as `archive_migration_cold_storage_plan`. It is evidence for a future transfer task, not permission to delete `Archive/migration`.

## Rollback

This task only adds a plan and a dry-run script. Rollback is removing this document and `scripts/plan-archive-migration-cold-storage.mjs`.
