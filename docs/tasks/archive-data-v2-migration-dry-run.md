# archive-data-v2-migration-dry-run

## Goal

Create a read-only migration dry-run for ArchiveData-v2.

The dry-run plans where legacy OneDrive Data files would go in the ArchiveData-v2 structure, computes in-memory checksum coverage, and reports manual-confirmation categories. It does not create the new data directory and does not write migration output files.

## Allowed Scope

- Add `scripts/dry-run-archive-data-v2-migration.mjs`.
- Read legacy OneDrive Data files.
- Compute checksums in memory.
- Build an in-memory virtual migration plan.
- Print only aggregate counts, target role counts, and manual-confirmation counts.
- Update `CURRENT_STATE.md` and `docs/plans/STABILIZATION_PLAN.md`.

## Forbidden Scope

- Do not modify OneDrive Data.
- Do not create an `ArchiveData-v2` directory.
- Do not copy, move, rename, delete, or rewrite source files.
- Do not write `migration-manifest.json`, `unmapped-files.json`, checksum files, or generated data.
- Do not modify `build_archive.py`.
- Do not run `build_archive.py`.
- Do not modify `public/data`, `src/data`, caches, reports data, or frontend code.
- Do not run npm dev/build/preview or the release script.
- Do not perform Git write operations.
- Do not output full local paths, account data, secrets, tokens, long Markdown bodies, titles lists, or rating details.

## Dry-run Output

The script reports:

- total files considered;
- checksum count and total bytes;
- ignored system file count;
- unmapped file count;
- planned target roles, such as `entry_yaml`, `content_md`, `cover`, `audio`, `asset`, `legacy_metadata`, and `config`;
- planned board/kind counts;
- manual-confirmation counts.

The script intentionally does not output actual checksums or full file paths. Those belong in a future write-enabled migration dry-run artifact only after explicit approval.

## Verification

Run:

```powershell
node scripts/dry-run-archive-data-v2-migration.mjs
```

Expected result:

- The command exits successfully.
- The command reports zero write actions.
- No `ArchiveData-v2` directory is created.
- No source data or generated data changes.

Latest result on 2026-06-16:

- Result: pass.
- Source files considered: 778.
- Checksum files: 778.
- Checksum errors: 0.
- Planned entries: 559.
- Planned target roles: 1336.
- Manual confirmations: 223.
- Unmapped files: 0.
- Ignored system files: 1.
- Write actions: 0.
- No `ArchiveData-v2` directory was created.

The script was also checked for common write, network, build, release, and Git command calls; no matches were found.

## Notes

- Games `meta.yaml` files are treated as legacy metadata instead of virtual entries.
- Music files outside the standard `Covers` and `Songs` matching rules are counted as extra assets requiring manual mapping, not as unmapped files.
- Manual-confirmation counts are intentional. They represent places where a future migration should ask for human review rather than guessing.

## Rollback

Delete `scripts/dry-run-archive-data-v2-migration.mjs` and this task file, then remove related notes from `CURRENT_STATE.md` and `docs/plans/STABILIZATION_PLAN.md`.
