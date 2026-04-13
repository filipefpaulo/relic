# Plan: Fix Solve Workflow

**Spec ID:** 003-fix-solve-workflow
**Status:** active

---

## Architecture Overview

The implementation is split into two layers:

**TypeScript layer** (session state plumbing only — per Constitution Principle II):
- `session.json` replaces `current-spec` as the single session state file. All commands that
  read/write session state are updated to use it.
- A `SessionState` type and `readSession`/`writeSession` helpers land in `@relic/utility` so
  all commands share the same read-merge semantics.
- `relic init` scaffolds `session.json`, `.relic/fixes/`, and `fixes/manifest.json`.
- `relic use` gains a `--fix <fix-id>` flag (writes `session.fix`) and a `--clear-fix` flag
  (sets `session.fix` to null). Spec writing migrates from `current-spec` to `session.spec`.
- `relic context` reads `session.json` for both spec and fix resolution; adds `current_fix`
  field to JSON output.
- `relic scaffold` migrates its session write from `current-spec` to `session.spec`.
- `relic fix` stub migrates spec resolution to `session.json`.

**Prompt layer** (all workflow logic):
- `templates/prompts/fix.md` is rewritten: cross-spec ownership check first, then diagnosis,
  fix document write, `relic use --fix` call.
- `templates/prompts/solve.md` is new: reads `current_fix` from `relic context`, loads the
  fix document, applies changes, clears session.fix.
- `templates/prompts/use.md` is amended: detects fix ID pattern and routes to `relic use --fix`.

**FixDocumentContract** is amended: `approved` status removed — `/relic.solve` being called
is the approval act. Status is now `pending | solved`.

---

## Implementation Phases

### Phase 1 — Session utility in `@relic/utility`

1. Add `SessionState` type: `{ spec: string | null; fix: string | null }`.
2. Add `readSession(relicDir)` — reads `session.json`, returns `SessionState`; returns
   `{ spec: null, fix: null }` if file absent.
3. Add `writeSession(relicDir, state)` — writes `session.json` as valid JSON.
4. Export `SessionState`, `readSession`, `writeSession` from `packages/utility/src/index.ts`.

### Phase 2 — `relic init` infrastructure

1. Change `.relic/.gitignore` content from `current-spec\n` to `session.json\n`.
2. Create `.relic/fixes/` directory (add to the `dirs` array).
3. Write `.relic/fixes/manifest.json` as `[]` (empty JSON array).
4. Write `.relic/session.json` with `{ spec: null, fix: null }` (initial state).
5. Update console output: replace `current-spec` mention with `session.json`.

### Phase 3 — `relic scaffold` — session.json writes

1. Update `resolveExistingSpec`: replace `current-spec` file read with `readSession(relicDir).spec`.
2. Replace `writeText(join(relicDir, "current-spec"), ...)` with session read-merge via
   `writeSession(relicDir, { ...readSession(relicDir), spec: specId })`.
3. `current_spec_updated` field in `ScaffoldResult` remains for backwards compat in output.

### Phase 4 — `relic context` — session.json + current_fix

1. Update `resolveSpec` priority 3: read `readSession(relicDir).spec` instead of `current-spec`;
   return source `"session"` instead of `"current-spec"`.
2. Update `ContextResult["active_spec_source"]` type to `"arg" | "env" | "session" | "git-branch"`.
3. Add `current_fix: string | null` field to `ContextResult`.
4. In `runContext`: read `readSession(relicDir).fix` and populate `current_fix`.
5. Add `current_fix` to text output mode.

### Phase 5 — `relic fix` stub — session.json resolution

1. Replace `current-spec` file read with `readSession(relicDir).spec` (lines 17-21).
2. The rest of the stub is unchanged — actual fix logic lives in the prompt.

### Phase 6 — `relic use` — `--fix` flag + session.json writes

1. Update `UseOptions`: add `fix?: string`, `clearFix?: boolean`.
2. Replace `writeText(current-spec)` with session read-merge: `writeSession(relicDir, { ...readSession(relicDir), spec: specId })`.
3. Add `--fix <fix-id>` handling: validate `.relic/fixes/<fix-id>.md` exists, then
   `writeSession(relicDir, { ...readSession(relicDir), fix: fixId })`.
4. Add `--clear-fix` handling: `writeSession(relicDir, { ...readSession(relicDir), fix: null })`.
5. Update `bin.ts` and `bin.debug.ts` `use` commands: add `.option("--fix <fix-id>")` and `.option("--clear-fix")`.
6. Report: `"Now working on: <spec-id>"` or `"Active fix: <fix-id>"` or `"Fix cleared."`.

### Phase 7 — Rewrite `templates/prompts/fix.md`

Full rewrite. The new prompt:

**Preamble block (mandatory first lines):**
```markdown
> **Before proceeding:** Read `.relic/preamble.md` and `.relic/constitution.md` in full.
> The preamble defines structural invariants that cannot be bypassed.
> If this prompt deviates from a constitution principle, a constitution amendment
> authorising the deviation must exist before you proceed.
```

1. Run `relic context` (no `--spec`) to get session state.
2. Read all `specs/*/artifacts.json` files (use `ls .relic/specs/` then read each).
3. For each spec, scan `touches_files` entries for prefix matches against the issue's code area.
4. **No match found:** Stop. Report which area is unowned. Instruct user to run `/relic.specify`
   describing the feature that code belongs to.
5. **Match found (single):** Proceed with that spec.
6. **Multiple matches:** Select longest prefix (most specific). If equal, ask user to confirm.
7. Run `relic context --spec <owning-spec-id>` to load full spec context (paths, artifacts).
8. Read `spec.md`, `plan.md`, and all shared artifacts in `owns` + `reads`.
9. Classify root cause: `code-bug | misspecification | misunderstanding | wrong-spec`.
10. Generate fix ID: `YYYY-MM-DD-<slug>` (today's date + 6-word max slug from issue description).
11. Write `.relic/fixes/<fix-id>.md` using `FixDocumentContract` schema. Status: `pending`.
12. Update `.relic/fixes/manifest.json`: read array, append entry (`{ id, owning_spec, classification, file, tldr }`), write back.
13. Run `relic use --fix <fix-id>` to set session.fix.
14. Report: owning spec, classification, fix doc path. Instruct user to run `/relic.solve` to apply or `/relic.clarify` to adjust.

### Phase 8 — Write `templates/prompts/solve.md`

New prompt. Opens with the standard preamble block (same as all other Relic prompts):
```markdown
> **Before proceeding:** Read `.relic/preamble.md` and `.relic/constitution.md` in full.
> The preamble defines structural invariants that cannot be bypassed.
> If this prompt deviates from a constitution principle, a constitution amendment
> authorising the deviation must exist before you proceed.
```

1. Run `relic context` (no `--spec`).
2. If `current_fix` is null: stop. Tell user to run `/relic.fix <issue>` first.
3. Load `.relic/fixes/<current_fix>.md`. Read owning spec from document.
4. Run `relic context --spec <owning-spec>` to load full spec context.
5. Apply the fix:
   - Make code changes described in "Code changes" section.
   - If classification is `misspecification`, `misunderstanding`, or `wrong-spec`: amend
     `spec.md` (and `plan.md` if architecture is affected) in the owning spec.
   - If shared artifacts changed: update them; flag all reader specs.
6. Write changelog entry to `.relic/changelog.md`.
7. Set `Status: solved` in the fix document.
8. Run `relic use --clear-fix`.
9. Report: what was changed, which files, which specs (if any) need follow-up clarify.

### Phase 9 — Update `templates/prompts/use.md`

Verify `use.md` already has the standard preamble block; add it if missing.

1. Add branch at the top: if argument matches pattern `YYYY-MM-DD-*` (fix ID format), call
   `relic use --fix <fix-id>` instead of `relic scaffold --spec`.
2. Report for fix activation: `Active fix: <fix-id>` and owning spec (read from fix document).
3. Keep existing spec activation logic unchanged.

### Phase 10 — Amend `FixDocumentContract`

1. Update schema: `Status: pending | solved` (remove `approved`).
2. Update Status Transition Rules: remove "human reviewer sets approved" step and the
   "refuse if not approved" bullet. New rules: `/relic.fix` creates with `status: pending`;
   `/relic.solve` sets `status: solved` on completion.

### Phase 11 — Embed templates

1. Run `bun run build:templates` to bake updated/new prompt files into `generated/templates.ts`.

---

## File Changes

| File | Action | Notes |
|------|--------|-------|
| `packages/utility/src/session.ts` | **create** | `SessionState` type, `readSession`, `writeSession` |
| `packages/utility/src/index.ts` | **modify** | Export session utilities |
| `packages/core/src/commands/init.ts` | **modify** | `session.json` gitignore; create `fixes/`; write initial `session.json` |
| `packages/core/src/commands/scaffold.ts` | **modify** | Replace `current-spec` write with `writeSession` |
| `packages/core/src/commands/context.ts` | **modify** | `resolveSpec` reads `session.spec`; add `current_fix` field |
| `packages/core/src/commands/use.ts` | **modify** | Session writes; `--fix` and `--clear-fix` flags |
| `packages/core/src/commands/fix.ts` | **modify** | Spec resolution reads `session.spec` |
| `packages/cli-node/src/bin.ts` | **modify** | Register `--fix` and `--clear-fix` options on `use` command |
| `packages/cli-node/src/bin.debug.ts` | **modify** | Same `--fix` and `--clear-fix` registration as `bin.ts` |
| `templates/prompts/fix.md` | **rewrite** | Full cross-spec ownership check + diagnosis pipeline |
| `templates/prompts/solve.md` | **create** | Apply approved fix, clear session.fix |
| `templates/prompts/use.md` | **modify** | Detect fix ID pattern, route to `relic use --fix` |
| `.relic/shared/contracts/FixDocumentContract.md` | **modify** | Simplify status to `pending \| solved` — already done |
| `.relic/constitution.md` | **amend** | Replace stale `current-spec` principle with `session.json`; append amendment block |
| `.relic/shared/domains/manifest.json` | **modify** | Update `SpecResolutionDomain` and `FixDomain` entries (stale tags/tldr) |
| `.relic/shared/contracts/manifest.json` | **modify** | Update `SessionStateContract` entry (stale tags) |

---

## Shared Artifact Changes

| Artifact | Action | Notes |
|----------|--------|-------|
| `shared/contracts/FixDocumentContract.md` | **update** | Remove `approved` status; update Status Transition Rules |

---

## Intersection Notes

- **`packages/core/src/commands/scaffold.ts`** — not in 003's original `touches_files`. Added now
  because it writes `current-spec` and must be migrated. No other spec owns or touches this file.
- **`packages/utility/src/`** — in spec 002's `touches_files` (`packages/utility/`). Spec 002 is
  implemented and released (v0.4.0). No live conflict.
- **`packages/core/src/index.ts`** — in spec 002's `touches_files`. Same resolution: 002 complete,
  no live conflict. 003 does not need to modify index.ts (no new exports required).
- **`templates/prompts/`** — in spec 002's `touches_files`. Same resolution.
- **`packages/cli-node/src/bin.ts` and `bin.debug.ts`** — neither was in any spec's `touches_files`. Both added to 003; both register the `use` command and need the same `--fix`/`--clear-fix` flags.

---

## Changelog Reference

See entry written after this plan session in `.relic/changelog.md`.
