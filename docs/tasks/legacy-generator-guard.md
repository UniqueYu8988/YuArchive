# Legacy Generator Guard

## Goal

Demote `build_archive.py` and the legacy one-click publish script from active daily workflow entry points to explicitly guarded legacy tools.

This supports old `Data` retirement planning by making accidental legacy generation or publish much harder, without rewriting the legacy generator or running it.

## Scope

Allowed:

- Add an early confirmation gate to `build_archive.py`.
- Let the legacy publish script pass that gate only after its own exact confirmation phrase.
- Update audit scripts so guarded legacy tools are not treated as unguarded active blockers.

Forbidden:

- Do not run `build_archive.py`.
- Do not run the legacy publish script.
- Do not modify old `Data`.
- Do not modify current `Archive` data.
- Do not rewrite the legacy generator.
- Do not publish.

## Guard Design

Direct execution of `build_archive.py` now requires:

```text
YUARCHIVE_LEGACY_BUILD_CONFIRMATION=RUN_LEGACY_BUILD_ARCHIVE
```

The legacy publish script already requires:

```text
PUBLISH_LEGACY_YUARCHIVE
```

Only after that phrase matches should the script set the generator confirmation environment variable before calling Python.

## Validation

Run:

```bash
node scripts/audit-legacy-generation-publish-dependencies.mjs
node scripts/audit-legacy-data-archive-coverage.mjs
node scripts/run-retirement-readiness-experiments.mjs
```

Expected result:

- legacy generation / publish dependency audit is retirement-ready;
- coverage audit no longer treats guarded legacy generator / publish files as active unguarded blockers;
- total retirement remains blocked until old `Data` and `Archive/migration` are actually transferred or otherwise explicitly retained.

## Rollback

Rollback is reverting this task document and the guard changes in `build_archive.py`, `一键发布到云端.bat`, and the audit scripts.
