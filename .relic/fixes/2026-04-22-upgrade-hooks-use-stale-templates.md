# Fix: 2026-04-22-upgrade-hooks-use-stale-templates

**Date:** 2026-04-22
**Owning spec:** 004-cli-self-upgrade
**Status:** solved

---

## Issue

`relic upgrade` requires two commands to fully update: `relic upgrade && relic upgrade --prompts`.
The plain `relic upgrade` upgrades the binary but the hook/prompt refresh still writes stale
templates from the old binary's embedded `TEMPLATES` map.

## Root Cause

**Classification:** code-bug

After `upgradeBinary()` replaces the on-disk binary with the new version, the currently
running Node.js/Bun process still holds the **old** `TEMPLATES` map in memory (it was baked
in at build time via `scripts/embed-templates.ts`). When `refreshHooks()` runs immediately
after, it calls `runAddEngine()` and reads `TEMPLATES["preamble.md"]` — both sourced from
the old process's memory. The result: hook files are "refreshed" with the same stale content.

The spec (FR-2, FR-8) requires that `relic upgrade` (no flags) atomically upgrades the
binary AND refreshes hooks with the **new** templates. The current implementation satisfies
the letter of the code flow but not the intent — the hooks are refreshed, just with the
wrong content.

## Proposed Changes

### Code changes

**`packages/core/src/commands/upgrade.ts`** — After `upgradeBinary()` succeeds, instead of
calling `refreshHooks()` directly (which uses in-memory stale templates), spawn the **new**
binary as a child process to perform the hook refresh:

```
spawnSync("<resolved-binary-path>", ["upgrade", "--prompts"], { stdio: "inherit" })
```

This ensures the new binary's embedded templates are used. The `--prompts` flag already
implements exactly the right logic — it just needs to be invoked from the new binary.

Binary path resolution:
- `npm` channel: `npx relic upgrade --prompts` or resolve via `npm bin -g`
- `pypi` channel: `relic upgrade --prompts` (the PATH entry is already updated)
- Alternatively, use `process.argv[0]` since the binary has been replaced in-place

Parse the JSON output from the spawned `--prompts` to populate `hooks_refreshed`,
`preamble_updated`, and any warnings into the parent's `UpgradeResult`.

### Spec amendments

None — the spec correctly requires atomic upgrade + refresh. This is a code-bug, not a
misspecification.

### Shared artifact changes

None — no contract or domain changes required.

## Changelog entry (draft)

### [2026-04-22] Fix: `relic upgrade` now refreshes hooks using the new binary's templates

**Spec:** 004-cli-self-upgrade
**Classification:** code-bug

After upgrading the binary, `refreshHooks` was called in the same process — which still
held the old `TEMPLATES` map in memory. Hook files were written with stale content, requiring
a second `relic upgrade --prompts` invocation. Fixed by spawning the newly installed binary
with `--prompts` instead of calling `refreshHooks` in-process.
