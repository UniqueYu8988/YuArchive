# archive-data-v2-music-live-compat-mapper

## Goal

Add a read-only mapper that checks whether v2 Music entries can be aligned with current live `public/data/music.json` items.

This mapper is a prerequisite for any live-compatible Music JSON generation. It does not write data and does not replace live Music data.

## Allowed Scope

- Add `scripts/map-archive-data-v2-music-live-compat.mjs`.
- Read `ArchiveData-v2/entries/music/album`.
- Read current `public/data/music.json`.
- Optionally read the isolated v2 preview JSON from system temp.
- Count mapping results and reusable live fields.
- Update status and stabilization Markdown.

## Forbidden Scope

- Do not modify `ArchiveData-v2`.
- Do not modify `public/data/music.json`.
- Do not modify `src/data`.
- Do not modify old OneDrive Data.
- Do not run `build_archive.py`.
- Do not run npm dev/build/preview.
- Do not run the release script.
- Do not perform Git write operations.
- Do not output title lists, Markdown bodies, full local paths, account data, secrets, or tokens.

## Mapping Rules

The first mapper uses normalized title matching:

- normalize v2 `entry.yaml.title`;
- normalize live `items[].title`;
- match one v2 entry to one live item when the normalized title key is unique on both sides.

The mapper reports ambiguous or duplicate candidates as counts only.

## Output

The script reports:

- v2 entry count;
- live item count;
- mapped count;
- unmapped v2 count;
- unmapped live count;
- duplicate v2 key count;
- duplicate live key count;
- ambiguous mapping count;
- reusable live ID count;
- reusable live cover path count;
- reusable live audio path count;
- preview ID overlap count;
- privacy/path rule hits.

## Verification

Run:

```powershell
node scripts/map-archive-data-v2-music-live-compat.mjs
```

Expected result:

- The command exits successfully.
- It reports 33 v2 entries and 33 live items.
- It reports 33 mapped entries.
- It reports zero unmapped and zero ambiguous mappings.
- It reports 33 reusable live IDs, 33 live cover paths, and 33 live audio paths.
- It does not modify live data.

Latest result on 2026-06-16:

- Result: pass.
- v2 entries: 33.
- live items: 33.
- mapped entries: 33.
- unmapped v2 entries: 0.
- unmapped live items: 0.
- ambiguous mappings: 0.
- duplicate v2 candidates: 0.
- duplicate live candidates: 0.
- reusable live IDs: 33.
- reusable live cover paths: 33.
- reusable live audio paths: 33.
- preview ID overlap: 0.
- privacy/path rule hits: 0.
- write actions: 0.

The result confirms that the current v2 Music entries can align to live Music items through normalized title matching, while still needing a compatibility layer because v2 IDs do not overlap live IDs.

## Rollback

Delete `scripts/map-archive-data-v2-music-live-compat.mjs` and this task file, then remove related status notes from `CURRENT_STATE.md` and `docs/plans/STABILIZATION_PLAN.md`.
