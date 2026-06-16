# archive-data-v2-music-generator-pilot-design

## Goal

Design the v2 Music generator pilot.

The pilot generator should read the accepted `ArchiveData-v2` Music album output and produce an isolated preview `music.json` for comparison. It must not replace the live frontend data.

## Current Evidence

- Current frontend reads `/data/music.json`.
- Current `public/data/music.json` top-level shape is:

```json
{
  "key": "",
  "display_name": "",
  "total_count": 0,
  "sort_mode": "music",
  "items": []
}
```

- Current `items` count is 33.
- Current Music item fields are:

```text
id, title, cover, description, content, audio, url, track_title
```

- `src/types.ts` defines `MusicCategory` and `MusicItem` with the same fields.
- `src/pages/MusicPage.tsx` depends on `items`, `cover`, `content`, `audio`, `url`, and `track_title`.
- v2 Music pilot output check passes with 33 album entries, 33 `entry.yaml`, 33 `content.md`, 33 covers, 33 audio files, 99 manifest records, and zero privacy/path hits.

## Non-goals

This pilot must not:

- modify `public/data/music.json`;
- modify `src/data`;
- modify old OneDrive Data;
- run `build_archive.py`;
- run npm dev/build/preview;
- copy v2 media into `public`;
- change frontend code;
- publish or push;
- become the final generator for all boards.

## Proposed Generator Input

Input:

```text
ArchiveData-v2/
└─ entries/
   └─ music/
      └─ album/
         └─ <entry-id>/
            ├─ entry.yaml
            ├─ content.md
            ├─ cover.*
            └─ audio.*
```

The generator should also read:

```text
ArchiveData-v2/migration/migration-manifest.json
```

The manifest is useful for preserving source-role evidence and for comparing migrated media roles.

## Proposed Preview Output

The first generator pilot should write only to an isolated preview output, preferably outside the project Git worktree.

Recommended output:

```text
<system-temp>/yuarchive-v2-music-preview/music.json
```

Rationale:

- avoids modifying live frontend data;
- avoids accidental Git inclusion;
- keeps generated preview easy to delete;
- allows side-by-side comparison with `public/data/music.json`.

The script should print only summary counts and relative output label, not full local paths.

## Preview JSON Shape

The preview should match the current frontend shape:

```json
{
  "key": "music",
  "display_name": "律动",
  "total_count": 33,
  "sort_mode": "music",
  "items": []
}
```

Each item should contain:

```json
{
  "id": "",
  "title": "",
  "cover": "",
  "description": "",
  "content": "",
  "audio": "",
  "url": "",
  "track_title": ""
}
```

## Field Mapping

| Preview field | v2 source | Notes |
|---|---|---|
| `id` | `entry.yaml.id` | Required |
| `title` | `entry.yaml.title` | Required |
| `cover` | `cover.*` | Preview path, not live public path |
| `description` | `entry.yaml.description` | Optional string |
| `content` | `content.md` | Required, body only |
| `audio` | `audio.*` | Preview path, not live public path |
| `url` | `entry.yaml.url` | Optional string |
| `track_title` | `entry.yaml.track_title` | Optional string |

Because preview media paths will point to v2-local media, they are not immediately usable by the current deployed frontend. This is acceptable for the pilot. The goal is shape and content comparison, not live page replacement.

## Comparison Rules

The generator pilot should compare the preview output with current `public/data/music.json` without printing titles or content bodies.

Minimum comparison:

- top-level keys match;
- item count matches;
- item field set matches;
- missing required field counts;
- blank optional field counts;
- content non-empty count;
- cover/audio present count;
- ID overlap count;
- ordering difference count if IDs are comparable;
- privacy/path rule hits in preview JSON.

The comparison should report counts only.

## Stop Conditions

The future implementation should stop before writing preview output if:

- v2 Music shape check fails;
- `ArchiveData-v2` Music album directory is missing;
- any entry is missing `entry.yaml`, `content.md`, cover, or audio;
- any entry id is missing or duplicated;
- preview output target would be inside `public/data`, `src/data`, reports data, caches, or old OneDrive Data;
- preview JSON would contain full local paths, OneDrive source roots, or secret-like fields.

## Validation Commands

Before future implementation:

```powershell
node scripts/check-archive-data-v2-music-shape.mjs
node scripts/check-music-media-shape.mjs
git status --short --branch
```

After future implementation:

```powershell
node scripts/generate-archive-data-v2-music-preview.mjs
node scripts/check-archive-data-v2-music-shape.mjs
git status --short --branch
```

The generator script should report preview output counts and comparison counts. It should not require a dev server or build.

## Acceptance Criteria

The pilot design is ready for implementation when:

- the input v2 Music shape is accepted;
- the output JSON shape matches `MusicCategory`;
- the preview output is isolated from live frontend data;
- comparison rules are count-based and do not print item bodies;
- rollback is simply deleting the preview output directory.

The future implementation is accepted only if:

- preview `music.json` is generated in the isolated output;
- preview top-level shape matches current `public/data/music.json`;
- preview item count is 33;
- required field missing counts are zero;
- privacy/path rule hits are zero;
- `public/data/music.json` is unchanged;
- `build_archive.py` is not run.

## Implementation Result

Latest result on 2026-06-16:

- Added `scripts/generate-archive-data-v2-music-preview.mjs`.
- The script writes only to `system-temp/yuarchive-v2-music-preview/music.json`.
- The script does not modify `public/data/music.json`.
- The script does not run `build_archive.py`.
- Preview generation result: pass.
- Preview item count: 33.
- Current live Music item count: 33.
- Top-level keys match: true.
- Item field set matches: true.
- Item count matches: true.
- Required missing fields: 0.
- Non-empty content fields: 33.
- Cover fields present: 33.
- Audio fields present: 33.
- Privacy/path rule hits: 0.

Important compatibility note:

- ID overlap with current `public/data/music.json`: 0.
- Ordering differences against current `public/data/music.json`: 33.

This does not block the isolated preview generator, because the preview is not used by the live frontend. It does mean that replacing live Music data later would require an explicit ID compatibility or mapping task.

## Rollback

Delete the isolated preview output directory.

Do not modify `public/data/music.json`, old OneDrive Data, or v2 Music pilot output as part of rollback.

## Recommended Next Task

Design an ID compatibility and media path strategy for using v2 Music output in the real frontend.

Do not replace `public/data/music.json` until the ID mapping and media URL strategy are reviewed.
