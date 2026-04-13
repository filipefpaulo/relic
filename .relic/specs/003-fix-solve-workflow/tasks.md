# Tasks: Fix Solve Workflow

**Spec ID:** 003-fix-solve-workflow
**Generated from plan:** 2026-04-13

---

## ⚠️ Phase 0 — Pre-implementation cleanup (DO THIS FIRST — before any TypeScript tasks)

- [x] **T-17a** Amend `constitution.md` — update the stale `current-spec` principle
  - Line 81: `".relic/current-spec is gitignored — each team member tracks their own active spec session"`
    → `".relic/session.json is gitignored — each team member tracks their own active spec and fix session in session.json"`
  - Append a dated amendment block at the bottom of `constitution.md` documenting the change:
    `[2026-04-13] session.json replaces current-spec as the single session state file. Priority 3 in spec resolution now reads session.json (session.spec field). Authorised by spec 003-fix-solve-workflow.`
  - **Must be done before T-03 through T-08** so the constitution accurately describes the
    system before the behaviour it governs is changed.

- [x] **T-17b** Update 3 stale manifest entries in `shared/*/manifest.json`
  - `shared/domains/manifest.json` — `SpecResolutionDomain` entry:
    - `tldr`: change `"arg > env > current-spec file > git branch"` → `"arg > env > session.json (session.spec) > git branch"`
    - `tags`: remove `"current-spec"`, add `"session-json"`, `"session"`
  - `shared/domains/manifest.json` — `FixDomain` entry:
    - `tags`: remove `"current-fix"`, add `"session-fix"`
  - `shared/contracts/manifest.json` — `SessionStateContract` entry:
    - `tags`: remove `"current-spec"` and `"current-fix"`, add `"session-spec"`, `"session-fix"`

---

## Phase 1 — Session utility in `@relic/utility`

- [x] **T-01** Create `packages/utility/src/session.ts`
  - Export `SessionState` interface: `{ spec: string | null; fix: string | null }`
  - Export `readSession(relicDir: string): SessionState` — reads `.relic/session.json`;
    returns `{ spec: null, fix: null }` if file absent or malformed
  - Export `writeSession(relicDir: string, state: SessionState): void` — writes
    `session.json` as formatted JSON; always writes both fields

- [x] **T-02** Update `packages/utility/src/index.ts`
  - Add: `export { SessionState, readSession, writeSession } from "./session.ts"`

---

## Phase 2 — `relic init` infrastructure

- [x] **T-03** Update `packages/core/src/commands/init.ts`
  - Change `writeText(join(relicDir, ".gitignore"), "current-spec\n")` → `"session.json\n"`
  - Add `join(relicDir, "fixes")` to the `dirs` array
  - After dirs creation: `writeText(join(relicDir, "fixes", "manifest.json"), "[]\n")`
  - After dirs creation: `writeJson(join(relicDir, "session.json"), { spec: null, fix: null })`
  - Update console output: replace `current-spec` mention with `session.json`; add
    `fixes/manifest.json` to the "Created:" list

---

## Phase 3 — `relic scaffold` session.json migration

- [x] **T-04** Update `packages/core/src/commands/scaffold.ts`
  - Add import: `readSession, writeSession` from `@relic/utility`
  - In `resolveExistingSpec`: replace `current-spec` file read with
    `readSession(relicDir).spec ?? null`
  - Replace `writeText(join(relicDir, "current-spec"), specId + "\n")` with
    `writeSession(relicDir, { ...readSession(relicDir), spec: specId })`

---

## Phase 4 — `relic context` session.json + `current_fix` field

- [x] **T-05** Update `packages/core/src/commands/context.ts`
  - Add import: `readSession` from `@relic/utility`
  - Update `ContextResult["active_spec_source"]` type:
    `"arg" | "env" | "session" | "git-branch"` (remove `"current-spec"`)
  - Add `current_fix: string | null` field to `ContextResult` interface
  - In `resolveSpec` priority 3: replace `current-spec` file read with
    `readSession(relicDir).spec`; return source `"session"`
  - In `runContext`: read `readSession(relicDir).fix`; populate `result.current_fix`
  - Update `--text` output: add `Fix: <fix-id or "(none)">` line after `Spec:`

---

## Phase 5 — `relic fix` stub session.json resolution

- [x] **T-06** Update `packages/core/src/commands/fix.ts`
  - Add import: `readSession` from `@relic/utility`
  - Replace `current-spec` file read block (lines 17–21) with:
    `specId = readSession(options.relicDir).spec ?? undefined`
  - Remove now-unused `readText` import if no longer referenced

---

## Phase 6 — `relic use` `--fix` and `--clear-fix` flags

- [x] **T-07** Update `packages/core/src/commands/use.ts`
  - Add import: `readSession, writeSession, fileExists` from `@relic/utility`
  - Update `UseOptions` interface: add `fix?: string`, `clearFix?: boolean`
  - Replace `writeText(join(relicDir, "current-spec"), specId)` with:
    `writeSession(relicDir, { ...readSession(relicDir), spec: specId })`
  - Add `--fix <fix-id>` handling branch:
    - Validate `.relic/fixes/<fix-id>.md` exists; error and exit if not
    - `writeSession(relicDir, { ...readSession(relicDir), fix: fixId })`
    - `console.log("Active fix: " + fixId)`
  - Add `--clear-fix` handling branch:
    - `writeSession(relicDir, { ...readSession(relicDir), fix: null })`
    - `console.log("Fix cleared.")`

- [x] **T-08** Update `packages/cli-node/src/bin.ts`
  - On the `use` command: add `.option("--fix <fix-id>", "Set active fix")`
  - Add `.option("--clear-fix", "Clear active fix", false)`
  - Update action to pass `fix: opts.fix, clearFix: opts.clearFix` to `runUse`
  - Also update `packages/cli-node/src/bin.debug.ts` (same changes — debug bin
    registers the same `use` command)

---

## Phase 7 — Rewrite `templates/prompts/fix.md`

- [x] **T-09** Rewrite `templates/prompts/fix.md`

  **Opening preamble block (mandatory):**
  ```
  > **Before proceeding:** Read `.relic/preamble.md` and `.relic/constitution.md` in full.
  > The preamble defines structural invariants that cannot be bypassed.
  > If this prompt deviates from a constitution principle, a constitution amendment
  > authorising the deviation must exist before you proceed.
  ```

  **Prompt logic:**
  1. `relic context` — get session state; note any active fix already set
  2. Scan all `specs/*/artifacts.json` for `touches_files` entries; do prefix matching
     against the code area described in the issue
  3. No match → stop; report unowned area; instruct user: `/relic.specify` describing
     the feature
  4. Single match → proceed with that spec
  5. Multiple matches → longest prefix wins; equal-length → ask user to confirm
  6. `relic context --spec <owning-spec-id>` — load spec context
  7. Read `spec.md`, `plan.md`, owned + read shared artifacts
  8. Classify root cause: `code-bug | misspecification | misunderstanding | wrong-spec`
  9. Generate fix ID: `YYYY-MM-DD-<slug>` (max 6-word slug from issue)
  10. Write `.relic/fixes/<fix-id>.md` per `FixDocumentContract`; status: `pending`
  11. Read `fixes/manifest.json`; append `{ id, owning_spec, classification, file, tldr }`;
      write back
  12. `relic use --fix <fix-id>`
  13. Report: owning spec, classification, fix doc path; instruct to run `/relic.solve`
      or `/relic.clarify` to adjust

---

## Phase 8 — Write `templates/prompts/solve.md`

- [x] **T-10** Create `templates/prompts/solve.md`

  **Opening preamble block (mandatory — same as all Relic prompts):**
  ```
  > **Before proceeding:** Read `.relic/preamble.md` and `.relic/constitution.md` in full.
  > The preamble defines structural invariants that cannot be bypassed.
  > If this prompt deviates from a constitution principle, a constitution amendment
  > authorising the deviation must exist before you proceed.
  ```

  **Prompt logic:**
  1. `relic context` — read `current_fix` field
  2. `current_fix` is null → stop; instruct user to run `/relic.fix <issue>` first
  3. Load `.relic/fixes/<current_fix>.md`; read owning spec
  4. `relic context --spec <owning-spec>` — load full spec context
  5. Apply code changes described in fix doc
  6. If classification is `misspecification`, `misunderstanding`, or `wrong-spec`:
     amend `spec.md` (and `plan.md` if architecture affected)
  7. If shared artifacts changed: update them; flag all reader specs
  8. Write changelog entry to `.relic/changelog.md`
  9. Set `Status: solved` in the fix document
  10. `relic use --clear-fix`
  11. Report: files changed, specs (if any) needing follow-up `/relic.clarify`

---

## Phase 9 — Update `templates/prompts/use.md`

- [x] **T-11** Update `templates/prompts/use.md`
  - Verify opening preamble block is present; add it if missing
  - Add detection branch before existing logic: if argument matches `YYYY-MM-DD-*`
    pattern (fix ID format), call `relic use --fix <fix-id>` instead of
    `relic scaffold --spec`
  - After fix activation: report `Active fix: <fix-id>` and owning spec (read from
    fix document)
  - Keep existing spec-activation logic unchanged for non-fix-ID arguments

---

## Phase 10 — Embed templates

- [x] **T-12** Run `bun run build:templates`
  - Confirm both embed steps complete without error
  - Confirm `fix.md`, `solve.md`, `use.md` appear in `ENGINE_TEMPLATES`

---

## Phase 11 — Update tests

- [x] **T-13** Update `packages/core/src/__tests__/context.test.ts`
  [overlaps spec 001 T-11]
  - Change `active_spec_source: "current-spec"` assertion → `"session"`
  - Update the test that writes `current-spec` to set up session state: write
    `session.json` with `{ spec: "<id>", fix: null }` instead of `current-spec` file
  - Add assertion: `current_fix` field exists in output (null when no fix set)

- [x] **T-14** Update `packages/core/src/__tests__/use.test.ts`
  [overlaps spec 001 T-08]
  - Change assertion from `current-spec` file existence → `session.json` existence
  - Assert `session.json` contains `{ spec: "<specId>", fix: null }`
  - Add test: `--fix <fix-id>` writes `session.fix`; requires creating a dummy fix doc
    at `.relic/fixes/<fix-id>.md` first
  - Add test: `--clear-fix` sets `session.fix` to null

- [x] **T-15** Update `packages/core/src/__tests__/scaffold.test.ts`
  [overlaps spec 001 T-09]
  - Change assertion from `current-spec` file → `session.json` file
  - Assert `session.json` contains `{ spec: "<specId>", fix: null }`
  - Verify `--title` path and `--spec` path both write `session.json`

- [x] **T-16** Add `packages/utility/src/__tests__/session.test.ts`
  - `readSession`: returns `{ spec: null, fix: null }` when file absent
  - `readSession`: returns correct values when `session.json` exists
  - `writeSession`: creates `session.json` with both fields
  - `writeSession` + `readSession` round-trip: spec and fix values survive
  - Read-merge: write spec, then write fix independently → both fields present

---

## Phase 12 — Verify

- [x] **T-17** Run `bun run test` — all packages pass (utility, engines, core)
- [x] **T-18** Run `relic validate` — `valid: true`
- [x] **T-19** Smoke-test the CLI: `relic use 003-fix-solve-workflow` writes
  `session.json`; `relic context` reports `active_spec_source: "session"` and
  `current_fix: null`

---

## Notes

- **Strict ordering:** T-17a and T-17b (Phase 0) must be done first — before any other
  task. Then T-01 and T-02 before T-03 through T-07 (all read `readSession`/`writeSession`).
  T-03 through T-07 are independent of each other. T-08 depends on T-07 (UseOptions changes).
  T-09 through T-11 (prompts) are independent of all TypeScript tasks. T-12 depends on
  T-09, T-10, T-11 being done. T-13 through T-16 can run in parallel after their respective
  TypeScript tasks.

- **`bin.debug.ts` (T-08):** Not in `touches_files` originally; added here because it
  registers the same `use` command. Low risk — purely additive flag registration.

- **Overlap with spec 001 tests (T-13, T-14, T-15):** Tests in `packages/core/src/__tests__/`
  were written by spec 001. They assert `current-spec` file behaviour which is being
  replaced. These tasks update existing test files — they do not conflict with spec 001's
  intent, only its implementation assumptions. Spec 001 is fully merged (v0.4.0 released).

- **`FixDocumentContract` Phase 10:** Already applied during planning session.
  No task needed here.

- **`init.test.ts` WILL break and must be updated as part of T-03:** The existing
  `init.test.ts` (spec 001 T-07) has a test that explicitly asserts
  `.gitignore` contains `"current-spec"` (confirmed at line 38). T-03 changes the gitignore
  to `session.json` — this test will fail. As part of T-03, update the assertion to check
  for `"session.json"` instead. Also add assertions for the new `session.json` and
  `fixes/manifest.json` files created by init.

- **Constitution Principle II applies:** `fix.md` and `solve.md` contain all workflow logic.
  The TypeScript changes in this spec are session-state plumbing only — no diagnosis,
  ownership-check, or fix-application logic in TypeScript.
