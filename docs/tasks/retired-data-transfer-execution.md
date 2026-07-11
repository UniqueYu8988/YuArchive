# Retired Data Transfer Execution

## Goal

Move old `Data` and `Archive/migration` out of their active locations only after verified cold-storage copies exist.

This is the final high-risk step for the retirement experiment. It must prove that runtime checks pass, legacy generator and publish paths are guarded, and cold storage can be verified before the original active folders are removed.

## Scope

Allowed:

- Create cold-storage copies under `[Archive]/_cold_storage`.
- Write manifest JSON files for the copied data.
- Verify copied files with size and SHA-256.
- Remove the original old `Data` and `Archive/migration` only after all copies verify.
- Ignore Windows / OneDrive system metadata files such as `desktop.ini` when deciding collection-data integrity.

Forbidden:

- Do not modify collection content.
- Do not run `build_archive.py`.
- Do not run the legacy publish script.
- Do not run npm dev/build/preview.
- Do not push during the transfer itself.
- Do not expose full local paths or private values.

## Execution Command

The script is:

`scripts/transfer-retired-legacy-data.mjs`

Default mode is plan-only:

```bash
node scripts/transfer-retired-legacy-data.mjs
```

Real execution requires both flags:

```bash
node scripts/transfer-retired-legacy-data.mjs --execute --confirm TRANSFER_LEGACY_DATA_AND_MIGRATION
```

## Target Shape

```text
[Archive]/_cold_storage/
├─ legacy-data-YYYYMMDD-HHMMSS/
│  ├─ Data/
│  └─ legacy-data-cold-storage-manifest.json
└─ migration-YYYYMMDD-HHMMSS/
   ├─ migration/
   └─ migration-cold-storage-manifest.json
```

## Verification

After execution, run:

```bash
node scripts/run-retirement-readiness-experiments.mjs
```

Expected result after successful transfer:

- runtimeReady: true;
- retirementReady: true;
- old `Data` no longer exists at the old active location;
- `Archive/migration` no longer exists at the active location;
- cold-storage manifests verify.

Notes:

- `desktop.ini` is treated as Windows / OneDrive system metadata and is ignored in collection-data integrity checks.
- V2 board shape checks treat active `Archive/migration` as optional after cold storage has been verified; entry/config/media checks remain mandatory.

## Rollback

Rollback is manual and should use the cold-storage copies:

1. Locate the latest `[Archive]/_cold_storage/legacy-data-*` and `migration-*` directories.
2. Copy `Data/` back to the old legacy active location if needed.
3. Copy `migration/` back to `[Archive]/migration` if needed.
4. Run the retirement experiments again.
