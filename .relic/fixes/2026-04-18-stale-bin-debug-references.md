# Fix: 2026-04-18-stale-bin-debug-references

**Date:** 2026-04-18
**Owning spec:** 007-remote-ollama-engine
**Status:** solved

---

## Issue

Three Copilot review findings, all caused by spec 007's deletion of `bin.debug.ts` without fully
cleaning up all consumers:

**Finding 1 — `scripts/publish.ts` references the deleted `bin.debug.ts`.**
Line 56 bumps the version in `packages/cli-node/src/bin.debug.ts` (file deleted by spec 007).
Line 66 `git add`s it. The script comment on line 52 still says "bump all 6 files".
`bun run publish` will error at runtime when it tries to read the deleted file.

**Finding 2 — Root `package.json` has debug scripts pointing to the deleted file.**
`dev:debug` and `build:binary:debug` both reference `packages/cli-node/src/bin.debug.ts`.
`docs/implementation.md` already documents that `dev:debug` was removed in Phase 14, but
`package.json` was never updated. `bun run dev:debug` and `bun run build:binary:debug` will fail.

**Finding 3 — README says workflow commands "require `.relic/models.json`" but `specify` and
`fix` have a fallback.**
When `models.json` is absent, `specify.ts` prints `"In your AI agent: /relic.specify"` and
`fix.ts` prints the assembled context to stdout — neither errors. All other workflow commands
(`clarify`, `plan`, `analyse`, `tasks`, `implement`) call `runModel` unconditionally and let
`loadModelConfig` error. The inconsistency is user-visible and contradicts both the README and
spec FR-2 ("the command prints a clear, actionable error to stderr and exits non-zero").

## Root Cause

**Classification:** code-bug

Spec 007 deleted `packages/cli-node/src/bin.debug.ts` as part of the single-binary consolidation,
but three consumers were not updated:
- `scripts/publish.ts` — still reads and git-adds the deleted file
- `package.json` (root) — still defines `dev:debug` / `build:binary:debug` targeting the deleted file
- `specify.ts` and `fix.ts` — retained pre-007 fallback branches that were never removed when the
  single-binary model was adopted

The `touches_files` array in spec 007's `artifacts.json` listed `bin.debug.ts` but did not include
`scripts/publish.ts`, `README.md`, or the root `package.json`, so these files were not tracked as
part of the spec's scope and escaped cleanup.

## Proposed Changes

### Code changes

**1. `scripts/publish.ts`**
- Remove line that calls `bumpRegex("packages/cli-node/src/bin.debug.ts", ...)`.
- Update comment from "bump all 6 files" → "bump all 5 files".
- Remove `packages/cli-node/src/bin.debug.ts` from the `git add` command on line 66.
- Result: publish script bumps exactly the 5 files already documented in `docs/distribution.md`.

**2. `package.json` (root)**
- Remove the `"dev:debug"` script.
- Remove the `"build:binary:debug"` script.
- Result: matches what `docs/implementation.md` already states (dev:debug removed in Phase 14).

**3. `packages/core/src/commands/specify.ts`**
- Remove the `if (fileExists(modelsJsonPath)) { ... } else { console.log(...) }` block.
- Always call `runModel(...)` after scaffolding. When `models.json` is absent, `loadModelConfig`
  now exits with a helpful actionable error (field name + minimum schema) — better UX than
  `"In your AI agent: /relic.specify"`.
- Remove the now-unused `modelsJsonPath` variable and `fileExists` import (if no longer needed).

**4. `packages/core/src/commands/fix.ts`**
- Remove the `if (fileExists(modelsJsonPath)) { ... } else { console.log(rendered) }` block.
- Always call `runModel(...)`. When `models.json` is absent, `loadModelConfig` exits with an
  actionable error — consistent with every other workflow command.
- Remove the now-unused `modelsJsonPath` variable and `fileExists` import (if no longer needed).

**5. `README.md`**
- The README says "These commands require `.relic/models.json`". After fixing specify.ts and
  fix.ts, this is accurate — no change needed to the core claim.
- However, the section intro can be made more accurate: change from "These commands require
  `.relic/models.json` with a `baseUrl` and `model`." → "These commands require `.relic/models.json`
  (with `baseUrl` and `model`) to call your configured model directly — no IDE required." (already
  correct; minimal wording improvement to remove ambiguity about the fallback that will no longer exist).

**6. `specs/007-remote-ollama-engine/artifacts.json`** — add to `touches_files`:
  - `scripts/publish.ts`
  - `README.md`
  - `package.json` (root — already in specs 001 and 002 touches_files; multiple specs may list it)

### Spec amendments

None. FR-2 already states the correct behavior ("prints a clear, actionable error to stderr and
exits non-zero"). The implementation was simply incomplete — fix.ts and specify.ts retained
pre-007 fallback branches that contradict FR-2. No spec text needs to change.

### Shared artifact changes

None.

## Changelog entry (draft)

```
### Fixed
- `scripts/publish.ts` no longer references deleted `packages/cli-node/src/bin.debug.ts`.
  The publish script now bumps exactly the 5 files documented in `docs/distribution.md`.
  `bun run publish` will no longer error at the version-bump step.
- Root `package.json` `dev:debug` and `build:binary:debug` scripts removed — these targeted
  the deleted debug binary and would fail if invoked. Matches what `docs/implementation.md`
  already described as "removed in Phase 14".
- `relic specify` and `relic fix` now consistently error (with the minimum schema hint) when
  `.relic/models.json` is absent, matching every other workflow command and spec FR-2.
  Previously both commands had a silent fallback (print guidance / print context) that
  contradicted the documented behavior.
  (Fix: 2026-04-18-stale-bin-debug-references)
```
