# protect-source-data-shape

## Goal

Build a read-only source-side structure check for YuArchive's OneDrive Data directory before deeper system upgrades.

The check verifies that the source directory, four archive sections, top-level YAML config files, and basic Markdown frontmatter shapes are still recognizable without running the data generator.

## Allowed Scope

- Add `scripts/check-source-data-shape.mjs`.
- Read the OneDrive Data directory structure.
- Read `homepage.yaml`, `site-layout.yaml`, `site-ui.yaml`, and `Texts/sections.yaml`.
- Read Markdown frontmatter from Music and Texts entries.
- Read Games and Visions `meta.yaml` files for shape checks only.
- Update status and stabilization Markdown.

## Forbidden Scope

- Do not modify OneDrive Data.
- Do not modify YAML, Markdown, image, audio, or media source files.
- Do not run `build_archive.py`.
- Do not modify `public/data`, `src/data`, caches, reports, frontend code, or the release script.
- Do not auto-fix ratings, notes, text content, classifications, covers, or media choices.
- Do not run npm dev/build/preview.
- Do not perform Git write operations.

## Verification

Run:

```powershell
node scripts/check-source-data-shape.mjs
```

Expected behavior:

- The script reads only source files needed for structure checks.
- It prints section-level pass/warn/fail summaries.
- It reports counts and parse-error summaries only.
- It does not print full local paths, item bodies, rating details, credentials, or secret values.
- It exits with code `0` when there are no failures, and non-zero when required source structure is missing or unreadable.

Homepage matching is best-effort. For Games, it considers image stems, `meta.yaml` top-level titles, display titles, English titles, URLs, and non-`meta.yaml` YAML stems such as `Game-Live` representative entries.

## Rollback

Delete `scripts/check-source-data-shape.mjs` and this task file, then remove the related status notes from `CURRENT_STATE.md` and `docs/plans/STABILIZATION_PLAN.md`.
