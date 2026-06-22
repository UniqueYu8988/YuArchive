# archive-data-v2-music-live-compatible-preview

## Goal

Generate an isolated live-compatible Music preview from Archive.

This preview proves that v2 Music data can produce the same frontend-facing shape while preserving current live IDs and public media paths. It does not replace `public/data/music.json`.

## Allowed Scope

- Add `scripts/generate-archive-data-v2-music-live-compatible-preview.mjs`.
- Read `Archive/entries/music/album`.
- Read current `public/data/music.json`.
- Map v2 entries to live items using the proven normalized-title mapper.
- Write an isolated preview JSON under system temp.
- Report count-based comparison results.
- Update status and stabilization Markdown.

## Forbidden Scope

- Do not modify `public/data/music.json`.
- Do not modify `src/data`.
- Do not modify old OneDrive Data.
- Do not modify `Archive`.
- Do not copy media into `public`.
- Do not run `build_archive.py`.
- Do not run npm dev/build/preview.
- Do not run the release script.
- Do not perform Git write operations.
- Do not output title lists, Markdown bodies, full local paths, account data, secrets, or tokens.

## Output

The script writes only:

```text
system-temp/yuarchive-v2-music-live-compatible-preview/music.json
```

The preview keeps the current live `MusicCategory` shape:

```json
{
  "key": "music",
  "display_name": "",
  "total_count": 33,
  "sort_mode": "music",
  "items": []
}
```

Each preview item:

- uses the current live `id`;
- uses current live `cover` and `audio` public paths;
- uses v2 `title`, `description`, `content`, `url`, and `track_title` where available;
- preserves live item order.

## Verification

Run:

```powershell
node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs
```

Expected result:

- The command exits successfully.
- Preview item count is 33.
- Current live item count is 33.
- Mapped entries are 33.
- ID overlap is 33.
- Ordering differences are 0.
- Reused live cover paths are 33.
- Reused live audio paths are 33.
- Required missing fields are 0.
- Privacy/path rule hits are 0.
- `public/data/music.json` is unchanged.

Latest result on 2026-06-16:

- Result: pass.
- v2 entries: 33.
- live items: 33.
- mapped entries: 33.
- preview items: 33.
- unmapped live items: 0.
- ambiguous mappings: 0.
- reused live IDs: 33.
- reused live cover paths: 33.
- reused live audio paths: 33.
- required missing fields: 0.
- ordering differences: 0.
- privacy/path rule hits: 0.
- `public/data/music.json` was not modified.
- `build_archive.py` was not run.

## Rollback

Delete the isolated system-temp preview output directory.

Do not modify `public/data/music.json`, old OneDrive Data, or v2 Music pilot output as part of rollback.
