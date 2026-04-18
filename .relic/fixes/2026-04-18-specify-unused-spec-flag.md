# Fix: 2026-04-18-specify-unused-spec-flag

**Date:** 2026-04-18
**Owning spec:** 007-remote-ollama-engine
**Status:** solved

---

## Issue

The `relic specify` command in `packages/cli-node/src/bin.ts` registers a `--spec <id>` option
("Spec ID (for referencing existing spec context)") but the action handler ignores it — `opts.spec`
is never read, and `runSpecify()` does not accept a `spec` parameter. The flag is dead code that
appears in `relic specify --help` but has no effect.

## Root Cause

**Classification:** code-bug

The `--spec <id>` option was copy-pasted from another workflow command's registration (e.g.
`clarify`, `plan`) when the `specify` command was wired up in `bin.ts`. `specify` always creates a
new spec (it generates the next ID via `nextSpecId()`); there is no valid use case for passing an
existing spec ID to it. The spec (FR-1) describes `relic specify` purely as a "create new spec"
command — no `--spec` flag is mentioned. The TypeScript handler type `{ title?: string; stream:
boolean; resetContext: boolean }` omits `spec` entirely, confirming it was never intended to be read.

## Proposed Changes

### Code changes

**`packages/cli-node/src/bin.ts`** — remove the `.option("--spec <id>", ...)` line from the
`specify` command registration. No other change needed: `runSpecify()` already has no `spec`
parameter and the handler type has no `spec` field.

### Spec amendments

None. The spec correctly describes `relic specify` without a `--spec` flag.

### Shared artifact changes

None.

## Changelog entry (draft)

```
### Fixed
- `relic specify --spec <id>` option removed — the flag was registered but silently ignored
  (runSpecify() has no spec parameter). specify always creates a new spec; --spec has no
  defined meaning on a create command. (Fix: 2026-04-18-specify-unused-spec-flag)
```
