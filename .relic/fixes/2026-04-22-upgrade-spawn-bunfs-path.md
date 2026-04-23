# Fix: 2026-04-22-upgrade-spawn-bunfs-path

**Date:** 2026-04-22
**Owning spec:** 004-cli-self-upgrade
**Status:** solved

---

## Issue

`relic upgrade` fails to refresh hooks after binary upgrade with error:
`Module not found "/$bunfs/root/relic"`

## Root Cause

**Classification:** code-bug

The spawn code in `upgrade.ts` used `process.argv[0]` and `process.argv[1]` to reconstruct
the command for the child process. In a Bun-compiled binary (PyPI distribution),
`process.argv[1]` is `/$bunfs/root/relic` — a Bun virtual filesystem path internal to the
compiled binary. The new binary cannot resolve this path, causing the module-not-found error.

## Proposed Changes

### Code changes

**`packages/core/src/commands/upgrade.ts`** — Replace `process.argv`-based spawn with a
simple `"relic"` command. After `upgradeBinary()`, the `relic` command on PATH is the new
binary. The user is already running `relic upgrade`, so `relic` is guaranteed to be on PATH.

## Changelog entry (draft)

No cross-artifact mutation — code-only fix. No changelog entry required.
