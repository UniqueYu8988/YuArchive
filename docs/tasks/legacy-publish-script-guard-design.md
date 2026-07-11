# Legacy Publish Script Guard Design

## Goal

Design the smallest safe guard for the legacy one-click publish script without changing the script yet.

The script is:

`一键发布到云端.bat`

It currently chains legacy generation and Git publishing. That makes it unsuitable as an always-ready double-click command while YuArchive is moving to `Archive` and Archive Studio.

## Current Risk

The legacy publish script currently:

- runs `python -X utf8 build_archive.py`;
- stages all local changes with `git add -A`;
- creates a commit;
- runs `git push`;
- has no explicit confirmation phrase before these actions.

This is risky because `build_archive.py` still reads old `Data`, writes generated JSON/caches/reports, and may write old game source YAML. The publish script then stages and pushes changes.

## Boundaries

This design task does not:

- modify `一键发布到云端.bat`;
- run `一键发布到云端.bat`;
- run `build_archive.py`;
- run npm dev/build/preview;
- modify old OneDrive `Data`;
- modify current `Archive`;
- modify public JSON, generated data, caches, reports, or source media;
- execute Git write operations.

## Minimal Guard Proposal

When implementation is explicitly authorized, add an early confirmation gate to the top of `一键发布到云端.bat`.

Recommended behavior:

1. Print that this is a legacy publish path.
2. Explain it will run `build_archive.py`, stage all changes, commit, and push.
3. Require the user to type an exact phrase, for example:

   `PUBLISH_LEGACY_YUARCHIVE`

4. If the phrase does not match exactly, exit before running `build_archive.py`.
5. Keep the existing build/commit/push behavior after the gate, so the first implementation is small and reversible.

## Why Start With Publish Script Guard

This is safer than editing `build_archive.py` first because:

- it prevents the most dangerous accidental action: generate + commit + push;
- it does not change the old generator's output behavior;
- it is easy to test without actually publishing;
- it is easy to revert.

## Alternative Options

| Option | Benefit | Risk |
|---|---|---|
| Rename the script to include `LEGACY_DISABLED` | Reduces accidental double-click | May break user muscle memory and docs until updated |
| Add exact confirmation phrase | Clear, minimal, reversible | Still allows legacy path when phrase is typed |
| Split build / commit / push into separate scripts | Safer long term | Larger workflow change |
| Replace with Archive-based publish flow | Best future direction | Needs broader design and validation |

## Recommended Next Implementation

First implementation should only add the exact confirmation phrase gate to `一键发布到云端.bat`.

Do not change:

- `build_archive.py`;
- Git commands;
- generated output paths;
- source data paths;
- public sync logic.

## Validation Plan

After implementation, validate without publishing:

1. Run a static guard check:

   ```bash
   node scripts/check-legacy-publish-script-guard.mjs
   ```

2. Inspect the script diff and confirm the only behavior change is an early guard.
3. Do not run the publish script unless a separate publish task explicitly authorizes it.

## First Check Result

Command:

```bash
node scripts/check-legacy-publish-script-guard.mjs
```

Result:

- Check completed successfully.
- `guarded: false`.
- The legacy publish script exists.
- It still contains build, stage-all, commit, and push steps.
- It does not contain the required confirmation phrase.
- It does not contain a prompt-based gate.

Interpretation:

The next implementation step, if explicitly authorized, should add only the confirmation gate. The publish script should still not be run during that implementation task.

## Rollback

Rollback is removing the guard block from `一键发布到云端.bat`. Since the proposed guard is at the top of the script and does not alter the later build/commit/push commands, rollback should be a small diff.
