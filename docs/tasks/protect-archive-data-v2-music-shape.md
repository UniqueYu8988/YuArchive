# protect-archive-data-v2-music-shape

## Goal

Add a read-only check for the generated ArchiveData-v2 Music pilot output.

This check validates the pilot output after the write-enabled Music migration has created `ArchiveData-v2/`. It does not modify v2 output or old OneDrive Data.

## Allowed Scope

- Add `scripts/check-archive-data-v2-music-shape.mjs`.
- Read generated `ArchiveData-v2/entries/music/album`.
- Read generated `ArchiveData-v2/migration` reports.
- Count `entry.yaml`, `content.md`, `cover.*`, and `audio.*`.
- Check manifest and unmapped report shape.
- Scan generated v2 reports for full local path or secret-like strings.
- Update status and stabilization Markdown.

## Forbidden Scope

- Do not modify old OneDrive Data.
- Do not modify generated `ArchiveData-v2` output.
- Do not run `build_archive.py`.
- Do not modify `public/data`, `src/data`, caches, reports data, or frontend code.
- Do not run npm dev/build/preview or the release script.
- Do not perform Git write operations.
- Do not output full local paths, account data, secrets, tokens, long Markdown bodies, or long title lists.

## Check Rules

The script checks:

- `ArchiveData-v2` exists.
- Music album directory exists.
- 33 album entry directories exist.
- Each entry directory has one `entry.yaml`, one `content.md`, one cover file, and one audio file.
- `migration-manifest.json` exists and has 99 records.
- `unmapped-files.json` exists and is empty.
- `legacy-field-report.md` exists.
- Generated migration reports do not contain full local paths or obvious secret-like field names.

## Verification

Run:

```powershell
node scripts/check-archive-data-v2-music-shape.mjs
```

Expected result after the pilot:

- The command exits successfully.
- It reports 33 entries.
- It reports 33 `entry.yaml`, 33 `content.md`, 33 cover files, and 33 audio files.
- It reports 99 manifest records.
- It reports zero unmapped files.
- It reports zero privacy/path rule hits.

Latest result on 2026-06-16:

- Result: pass.
- Album entry directories: 33.
- `entry.yaml` files: 33.
- `content.md` files: 33.
- Cover files: 33.
- Audio files: 33.
- Malformed entry directories: 0.
- Manifest records: 99.
- Unmapped files: 0.
- Legacy field report exists.
- Privacy/path rule hits: 0.

## Rollback

Delete `scripts/check-archive-data-v2-music-shape.mjs` and this task file, then remove related notes from `CURRENT_STATE.md` and `docs/plans/STABILIZATION_PLAN.md`.
