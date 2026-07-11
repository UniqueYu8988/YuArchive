# Legacy Data / Migration Retirement Experiments

## Goal

Create a repeatable experiment suite that decides whether old `Data` and `Archive/migration` are safe to delete or move to cold storage.

The user should not have to manually test the website repeatedly. This task turns the retirement criteria into runnable checks and a clear PASS / BLOCKED result.

## Scope

Allowed:

- Read project files, public JSON, current `Archive`, and old `Data`.
- Run existing read-only checks.
- Run existing sandbox checks that only write to system temporary directories.
- Produce an experiment report in terminal output.

Forbidden:

- Do not delete, move, rename, or modify old `Data`.
- Do not delete, move, rename, or modify `Archive/migration`.
- Do not modify current `Archive` entries or config.
- Do not run `build_archive.py`.
- Do not run `一键发布到云端.bat`.
- Do not run Git write operations as part of the experiment.
- Do not output titles, body text, ratings detail, full private paths, accounts, tokens, or secrets.

## Experiment Suite

The suite is implemented by:

`scripts/run-retirement-readiness-experiments.mjs`

It checks:

1. Git working tree state.
2. Public JSON shape and privacy.
3. Archive v2 shape for Games, Music, Texts, and Visions.
4. Archive Studio public sync sandbox behavior.
5. Archive Studio update sandbox behavior.
6. Old `Data` / `Archive` coverage audit.
7. Legacy generation / publish dependency audit.
8. Legacy publish script guard status.
9. Whether `Archive/migration` still contains transaction or migration records.

## Decision Meaning

The experiment suite can produce two levels:

- `runtimeReady`: the current website and Archive Studio maintenance workflow look healthy.
- `retirementReady`: old `Data` and/or `Archive/migration` are safe to delete or transfer.

It is possible, and currently expected, for `runtimeReady` to pass while `retirementReady` remains blocked.

## Current Expected Result

Current expected result is:

- runtime checks should pass;
- retirement should be blocked because:
  - old `Data` still exists as baseline;
  - legacy generator and legacy publish path still exist;
  - `Archive/migration` still contains useful migration and transaction records;
  - no cold backup manifest has been recorded.

## First Run Result

Command:

```bash
node scripts/run-retirement-readiness-experiments.mjs
```

Result:

- Experiment suite completed.
- `runtimeReady: false`.
- `retirementReady: false`.
- Public JSON shape passed.
- Generated data privacy passed.
- Games, Music, Texts, and Visions Archive shape checks passed.
- Archive Studio public sync sandbox passed.
- Archive Studio update sandbox passed.

Runtime issue:

- `git_worktree_clean` failed because this experiment task itself created new uncommitted project files.
- This is not a data-loss signal. Rerun after committing the experiment files to confirm runtime readiness.

Retirement blockers:

- old `Data` / `Archive` coverage audit still reports legacy generator and publish dependencies;
- legacy generation / publish audit reports four blockers;
- legacy publish script still has no explicit guard;
- `Archive/migration` still exists and contains migration / transaction records;
- old `Data` still exists and has not yet been transferred to a verified cold backup.

Interpretation:

The current Archive Studio runtime path looks healthy, but old `Data` and `Archive/migration` are not ready to delete or transfer yet.

## Future Deletion / Transfer Gate

Codex should only help delete or transfer old `Data` or `Archive/migration` after:

- this suite reports no blocking retirement issues;
- the user explicitly chooses delete or transfer;
- a backup or cold archive target is verified;
- a final dry-run list of files to move/delete is shown;
- the user confirms the exact action.

## Validation

Run:

```bash
node scripts/run-retirement-readiness-experiments.mjs
```

This should not alter project data or OneDrive data.

## Rollback

This task only adds documentation and a read-only/sandbox experiment runner. Rollback is removing this document and `scripts/run-retirement-readiness-experiments.mjs`.
