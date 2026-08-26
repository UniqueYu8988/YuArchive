# Separate Local Archive Studio

## Goal

Separate Archive Studio from the public collection website and provide a local-only, lightweight management entry for creating, editing, previewing, checking, and synchronizing Archive data.

## Scope

- Remove Studio routes and navigation from the public React entry.
- Add a standalone local-only named Studio HTML and React entry that does not collide with the former public route.
- Reuse the existing localhost-only API and controlled preview/preflight/write flow.
- Reduce repeated headings, status summaries, and explanatory copy in the visible Studio shell.
- Add a local launcher and a desktop shortcut using the YuArchive icon.

## Safety Boundary

- Do not run `build_archive.py` or the legacy publish script.
- Do not directly edit Archive entries, old Data, generated JSON, reports, or caches.
- Do not add authentication or expose the Studio API beyond localhost.
- Do not add Studio to the public production build entry.

## Verification

- Confirm the public application no longer imports or routes to Studio.
- Confirm the standalone Studio can reach the localhost API and all five management views.
- Run TypeScript/build checks and existing Studio server checks.
- Verify desktop shortcut startup and browser layout on desktop and mobile widths.

## Rollback

Revert the public entry split, remove the standalone Studio files and launcher, and delete the desktop shortcut. Existing Archive data is unaffected by the UI-only rollback.
