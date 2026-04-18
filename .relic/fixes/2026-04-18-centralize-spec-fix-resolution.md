# Fix: 2026-04-18-centralize-spec-fix-resolution

**Date:** 2026-04-18
**Owning spec:** 007-remote-ollama-engine
**Status:** solved

---

## Issue

Two related Copilot review findings:

**Finding 1 — `relic model --reset-context` uses an incomplete resolution chain.**
The `model` command in `bin.ts` resolves the spec only from `--spec` or `session.json`. All other
commands (clarify, plan, analyse, tasks, implement, fix, specify) use the full four-step chain:
`--spec arg → RELIC_SPEC env → session.json → git branch inference`. The `model` command is
inconsistent and will fail silently for users who rely on env or branch resolution.

**Finding 2 — No centralized resolution utility.**
The four-step chain is copy-pasted verbatim across 8+ command files. Any change to the resolution
order (e.g. adding a new step) must be applied to every file individually. A centralized
`resolveSpec()` and `resolveFix()` in `@relic/utility` would make the chain a single source of
truth and eliminate future drift.

**Note on second Copilot finding (model-runner.ts solve history):**
The `runModel` / solve history persistence bug raised in the second review comment was already
fixed in fix `2026-04-18-solve-persists-history-against-spec`. The comment is stale — `solve.ts`
no longer passes `fixId` to `runModel`, so `historyPath` is null and no write occurs.

## Root Cause

**Classification:** code-bug

The `relic model --reset-context` handler in `bin.ts` was written inline without reusing the
established resolution pattern from the other commands. Since the pattern was not yet a utility
function, the author had to reproduce it manually — and did so incompletely. The missing steps
(`RELIC_SPEC` env and git branch) are not edge cases; they are priority 2 and 4 in the documented
resolution chain.

## Proposed Changes

### Code changes

**1. `packages/utility/src/spec-id.ts`** — add two resolver functions:

- `resolveSpec(arg: string | undefined, relicDir: string): string | undefined`
  Implements: `arg → process.env["RELIC_SPEC"] → readSession(relicDir).spec → inferSpecFromBranch(git branch)`
  Returns `undefined` if no step resolves. Callers are responsible for the error/exit.

- `resolveFix(arg: string | undefined, relicDir: string): string | undefined`
  Implements: `arg → readSession(relicDir).fix`
  Returns `undefined` if neither resolves.

The git branch inference step wraps `execSync` in a try/catch (not in a git repo is not an error).

**2. `packages/utility/src/index.ts`** — export `resolveSpec` and `resolveFix`.

**3. Refactor all commands that copy-paste the resolution chain:**

The following files replace their 10–15 line inline resolution block with `resolveSpec(options.spec, relicDir)`:
- `packages/core/src/commands/clarify.ts`
- `packages/core/src/commands/plan.ts`
- `packages/core/src/commands/analyse.ts`
- `packages/core/src/commands/tasks.ts`
- `packages/core/src/commands/implement.ts`
- `packages/core/src/commands/fix.ts`
- `packages/core/src/commands/specify.ts`

Existing imports of `inferSpecFromBranch`, `readSession` removed from each file after refactor
(only needed inside `resolveSpec` now).

**4. `packages/cli-node/src/bin.ts` — `relic model` handler:**

Replace the incomplete inline resolution:
```typescript
// BEFORE (missing RELIC_SPEC and git branch steps)
let specId = opts.spec;
if (!specId) {
  specId = readSession(relicDir).spec ?? undefined;
}
```
With:
```typescript
// AFTER
const specId = resolveSpec(opts.spec, relicDir);
```

**5. `packages/core/src/commands/solve.ts`** — replace inline fix resolution:
```typescript
const fixId = options.fix ?? readSession(relicDir).fix ?? undefined;
```
With:
```typescript
const fixId = resolveFix(options.fix, relicDir);
```

### Spec amendments

None. The spec correctly describes the resolution chain; the utility function was not yet
defined but the behavior was always intended. No spec.md or plan.md changes required.

### Shared artifact changes

**`shared/domains/SpecResolutionDomain.md`** — add a note that `resolveSpec()` and `resolveFix()`
are the canonical resolution utilities. No structural change to the resolution order itself.

Check which specs `read` this artifact to determine cascade:

## Changelog entry (draft)

```
### Fixed
- Centralized spec and fix resolution into `resolveSpec()` and `resolveFix()` utilities in
  `@relic/utility`. All workflow commands now use the same four-step chain:
  `--spec arg → RELIC_SPEC env → session.json → git branch inference`. Previously the chain
  was copy-pasted across 8+ command files with no shared implementation.
- `relic model --reset-context` now correctly uses the full resolution chain. Previously it
  skipped the RELIC_SPEC env var and git branch inference steps, failing silently when users
  relied on those fallbacks.
  (Fix: 2026-04-18-centralize-spec-fix-resolution)
```
