# protect-music-media-shape

## Goal

Add a read-only Music media shape check that verifies the basic relationship between Music Markdown entries, the `Covers` directory, and the `Songs` directory.

This task is a protective upgrade only. It reports possible source-side issues before running `build_archive.py`; it does not repair, rename, delete, or generate anything.

## Allowed Scope

- Add `scripts/check-music-media-shape.mjs`.
- Read the Music source directory.
- Read Music Markdown frontmatter and file names.
- Check cover and audio file existence using the same broad matching conventions as `build_archive.py`.
- Update status and stabilization Markdown.

## Forbidden Scope

- Do not modify OneDrive Data.
- Do not modify Music Markdown, covers, songs, or media files.
- Do not rename, delete, move, or generate source files.
- Do not modify `build_archive.py`.
- Do not run `build_archive.py`.
- Do not modify `public/data`, `src/data`, caches, reports, or frontend code.
- Do not run npm dev/build/preview or the release script.
- Do not perform Git write operations.

## Check Rules

### Markdown Entries

- Music root Markdown files must be readable.
- Frontmatter, when present, must close with `---`.
- A title or file stem must exist.
- The script does not print Markdown bodies.

### Covers

- `Covers` is checked for readability when present.
- For each Markdown entry, the script checks the explicit `cover` frontmatter value if present.
- It also checks fallback conventions: same-folder image, `Covers/<markdown-stem>.<ext>`, and normalized stem matching in `Covers`.
- Missing covers are reported as counts only.

### Songs

- `Songs` is checked for readability when present.
- For each Markdown entry, the script checks the explicit `audio` frontmatter value if present.
- It also checks fallback conventions: same-folder audio, `Songs/<markdown-stem>.<ext>`, and normalized stem matching in `Songs`.
- Audio content is not opened or validated; only file presence and extension are checked.

## Verification

Run:

```powershell
node scripts/check-music-media-shape.mjs
```

Expected output:

- Markdown entry count.
- Cover and song file counts.
- Cover and audio pass/warn/fail status.
- Missing or suspicious counts only.
- No full local paths, credentials, secrets, or long Markdown content.

## Rollback

Delete `scripts/check-music-media-shape.mjs` and this task file, then remove the related status notes from `CURRENT_STATE.md` and `docs/plans/STABILIZATION_PLAN.md`.

