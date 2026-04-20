# Fix: 2026-04-20-uv-stderr-leaks-on-pip-fallback

**Date:** 2026-04-20
**Owning spec:** 004-cli-self-upgrade
**Status:** solved

---

## Issue

`relic upgrade` prints uv's error message to the terminal even when the pip fallback succeeds,
making a successful upgrade appear to have failed:

```
error: Failed to upgrade relic-cli
  Caused by: `relic-cli` is not installed; run `uv tool install relic-cli` to install
Requirement already satisfied: relic-cli in /Users/filfp/.pyenv/versions/3.12.13/lib/python3.12/site-packages (0.8.1)
```

The upgrade succeeded (via pip — `binary_upgraded: true` in the JSON output), but the user sees
uv's error first and has no clear indication that the fallback ran and succeeded. The scenario
is common: user installed via `pip install relic-cli` (not `uv tool install relic-cli`), so
`uv tool upgrade` always fails with "not installed via uv tool".

## Root Cause

**Classification:** code-bug

The spec (FR-6) correctly describes the try-uv-then-pip fallback. The implementation logic is
correct — it does fall back and succeed. The bug is in the stdio handling: `spawnSync("uv", ...,
{ stdio: "inherit" })` lets uv write its error output directly to the terminal before the
fallback runs. When the pip fallback then succeeds, the user is left with a terminal showing an
error they can't explain.

The fix is to capture uv's output (`stdio: "pipe"`) so it doesn't leak when the fallback
succeeds. If both uv and pip fail, the captured uv output should be included in the thrown error
so no diagnostic information is lost.

## Proposed Changes

### Code changes

**`packages/core/src/commands/upgrade.ts`** — `upgradeBinary` function, pypi branch:

- Change `spawnSync("uv", ["tool", "upgrade", "relic-cli"], { stdio: "inherit" })` to use
  `stdio: "pipe"` instead. This suppresses uv's error output when the fallback succeeds.
- When uv fails and the pip fallback also fails, include the captured uv stderr in the thrown
  error message so no diagnostic is lost.
- When uv fails but pip succeeds, print a single brief line to stderr:
  `"uv: relic-cli not in uv tool store — upgraded via pip instead."` so the user understands
  what happened without seeing uv's raw error.
- The pip call already uses `stdio: "inherit"` — keep it that way so pip's progress output
  (or error) appears normally when it runs.

### Spec amendments

None. FR-6 describes the correct fallback behaviour. The stdio handling is an implementation
detail not specified at the spec level.

### Shared artifact changes

None.

## Changelog entry (draft)

```
### Fixed
- `relic upgrade` no longer shows uv's raw error message when the pip fallback succeeds.
  Previously, users who installed via pip (not `uv tool install`) would see
  "error: Failed to upgrade relic-cli" printed by uv before the successful pip upgrade,
  making a working upgrade appear broken. uv's output is now captured; on successful pip
  fallback a single diagnostic line is printed instead.
  (Fix: 2026-04-20-uv-stderr-leaks-on-pip-fallback)
```
