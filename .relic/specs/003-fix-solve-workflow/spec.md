# Spec: Fix Solve Workflow

**Spec ID:** 003-fix-solve-workflow
**Created:** 2026-04-13
**Status:** draft

---

## Overview

The current `/relic.fix` command is a context-assembly stub that assumes the user already
knows which spec owns the broken code. This spec replaces it with a complete cross-spec fix
pipeline built around a core philosophy: **every part of the codebase should eventually have
a spec that owns it**. The fix command enforces this invariant — it refuses to run on code
that has no owning spec, using that refusal as a forcing function to grow spec coverage over
time.

The pipeline has two stages separated by a human review step:

1. **`/relic.fix <issue>`** — diagnoses the problem, finds the responsible spec, classifies
   the root cause, and writes a fix document to `.relic/fixes/` for human review.
2. **`/relic.solve`** — applies the approved fix: code changes, spec amendments, changelog
   entry, and clears the fix session state.

To support this, both spec and fix session state are consolidated into a single structured
file: `.relic/session.json` (gitignored). This supersedes the existing `.relic/current-spec`
flat text file. `session.json` holds all personal session state in one place and can grow
without adding new files to `.relic/`. When a fix is active (`session.fix` is set), it takes
precedence over `session.spec` for context-sensitive commands (`/relic.clarify`, `/relic.analyse`).

---

## Requirements

### Functional Requirements

**Ownership check:**

- **FR-1:** `/relic.fix` accepts an issue description as input (error message, symptom,
  stack trace, or natural language). Before any diagnosis, it identifies which spec owns
  the relevant code area by scanning all `artifacts.json` `touches_files` entries across
  all specs using prefix matching (e.g. `src/auth/` matches `src/auth/middleware.ts`).

- **FR-2:** If **no spec** owns the relevant code area, the command stops immediately and
  instructs the user:
  ```
  No spec owns this code area. Run relic scaffold --title "<feature name>"
  then /relic.specify to create one before running /relic.fix.
  ```
  This is intentional — it is the mechanism that drives spec coverage growth across large
  codebases. The command MUST NOT attempt a fix without an owning spec.

- **FR-3:** If **multiple specs** match via `touches_files`, report all candidates and select
  the most specific match (longest matching path prefix wins). If two specs match equally,
  report both and ask the user to confirm before proceeding.

**Diagnosis:**

- **FR-4:** When an owning spec is found, assemble full spec context: `spec.md`, `plan.md`,
  and all shared artifacts referenced in `artifacts.json` (`owns` + `reads`). Use
  `relic context --spec <id>` to obtain paths.

- **FR-5:** Classify the root cause into exactly one of:
  - `code-bug` — spec is correct; the implementation deviated from it
  - `misspecification` — spec didn't capture this edge case or scenario
  - `misunderstanding` — spec is correct but was misread during implementation
  - `wrong-spec` — the spec's requirement itself is incorrect or has become stale

- **FR-6:** Write a fix document to `.relic/fixes/<fix-id>.md`. Fix IDs use format
  `YYYY-MM-DD-<slug>` where slug is derived from the issue description (e.g.
  `2026-04-13-null-session-crash`). Document structure is defined in `FixDocumentContract`.

- **FR-7:** After writing the fix document, write the fix ID to `.relic/current-fix`. Report
  to the user: owning spec, classification, and a summary of the proposed fix. Instruct them
  to review `.relic/fixes/<fix-id>.md` and run `/relic.solve` to apply, or `/relic.clarify`
  to adjust the diagnosis.

**Fix session state:**

- **FR-8:** Session state lives in a single `.relic/session.json` (gitignored, JSON format).
  Shape: `{ "spec": "<spec-id> | null", "fix": "<fix-id> | null" }`. Both fields are
  optional and written independently by different commands. When `fix` is non-null, it takes
  precedence over `spec` for `/relic.clarify` and `/relic.analyse`. `/relic.fix` and
  `/relic.solve` always operate on `session.fix` when present.

- **FR-8a:** `.relic/session.json` supersedes the existing `.relic/current-spec` flat text
  file. `relic use <spec-id>` writes `session.spec`; `relic use --fix <fix-id>` writes
  `session.fix`. For backwards compatibility, if `session.json` does not exist but
  `current-spec` does, the spec ID is read from `current-spec` (priority 3 in the resolution
  chain is unchanged). New writes always go to `session.json`.

- **FR-9:** `relic use --fix <fix-id>` writes `session.fix` in `.relic/session.json`.
  Validates that `.relic/fixes/<fix-id>.md` exists before writing. Errors if not found.
  `relic use <spec-id>` (no `--fix`) writes `session.spec` only — `session.fix` is
  untouched.

- **FR-10:** `/relic.use` (the AI slash command) is amended to support both fields. When the
  argument matches the fix ID pattern (`YYYY-MM-DD-*`), it calls `relic use --fix <fix-id>`.
  Otherwise it calls `relic use <spec-id>` as before.

**Apply the fix:**

- **FR-11:** `/relic.solve` reads `current-fix`, loads the fix document, and applies the fix:
  - Makes the code changes described in the fix document
  - If classification is `misspecification`, `misunderstanding`, or `wrong-spec`: amends
    `spec.md` (and `plan.md` if the architecture is affected) in the owning spec
  - If a shared artifact contract changed: updates the artifact and flags all reader specs
  - Writes a changelog entry to `.relic/changelog.md`
  - Sets fix document status to `solved`
  - Clears `session.fix` in `.relic/session.json` (sets field to null)

- **FR-12:** If the fix document status is not `approved` when `/relic.solve` runs, the
  command stops and tells the user to set `status: approved` in the fix document first.

**Infrastructure updates:**

- **FR-13:** `relic init` adds `session.json` to `.relic/.gitignore`. `current-spec` remains
  gitignored for backwards compatibility (existing projects may still have it).

- **FR-14:** `relic context` JSON output gains a `current_fix` field: `session.fix` value
  if set, `null` otherwise. The existing `active_spec_source` field reports `session` when
  the spec was resolved from `session.json`.

### Non-Functional Requirements

- **NFR-1:** Constitution Principle II applies — `/relic.fix` and `/relic.solve` workflow
  logic lives in `templates/prompts/fix.md` and the new `templates/prompts/solve.md`.
  TypeScript stubs exist only for session-state operations (flag parsing, file I/O).

- **NFR-2:** `.relic/fixes/` is created at fix time by the prompt (not by `relic init`).
  The directory does not exist until the first fix is diagnosed.

- **NFR-3:** Fix documents are committed — they are audit trail. Only `current-fix`
  (the session pointer) is gitignored.

- **NFR-4:** Fix ID slugs are lowercase, hyphenated, max 6 words from the issue description.

- **NFR-5:** `touches_files` prefix matching is case-sensitive and path-separator-normalised.
  A spec declaring `"src/auth/"` owns any file starting with that string.

- **NFR-6:** `relic use --fix` errors if the fix document does not exist. It does not create
  fix documents — that is `/relic.fix`'s responsibility.

- **NFR-7:** `session.json` is always written as valid JSON with both `spec` and `fix` keys
  present (values may be null). Partial writes (only updating one field) must read-merge,
  not overwrite the whole file.

---

## User Stories

- As a developer, I want `/relic.fix` to identify which spec owns the broken code so I
  understand the original intent before debugging.
- As a developer, I want `/relic.fix` to refuse to diagnose unowned code, prompting me to
  write a spec — growing coverage gradually across a large codebase.
- As a team member, I want fix documents in `.relic/fixes/` so teammates can see the
  diagnosis and rationale before a fix is applied.
- As a developer, I want a review gate between diagnosis and application so I never
  auto-apply a fix I haven't read.
- As a maintainer, I want spec docs amended when the classification is `misspecification`
  or `wrong-spec`, so the spec stays accurate after the fix.
- As a developer, I want `current-fix` to auto-take precedence for clarify and analyse,
  so those commands operate in fix context without manual switching.

---

## Scope

### In Scope

- Full rewrite of `templates/prompts/fix.md`
- New `templates/prompts/solve.md`
- New `.relic/fixes/` directory (runtime-created, not scaffolded)
- `packages/core/src/commands/fix.ts` — add `--fix` flag; read/write `session.json`
- `packages/core/src/commands/use.ts` — add `--fix <fix-id>` flag; write `session.json`
- `packages/core/src/commands/init.ts` — gitignore `session.json` (keep `current-spec` too)
- `packages/core/src/commands/context.ts` — read `session.json`; add `current_fix` to output;
  update `active_spec_source` to report `session` when resolved from `session.json`
- `templates/prompts/use.md` — support fix ID argument detection
- `ContextResultContract` amendment — add `current_fix` field
- New `FixDomain` shared artifact
- New `FixDocumentContract` shared artifact
- New `SessionStateContract` — defines `.relic/session.json` schema

### Out of Scope

- Native TypeScript diagnosis or apply logic (stays in prompts per Principle II)
- A `relic solve` native CLI command (AI prompt only)
- Automated fix application without human review
- Fix history search or listing commands
- Changes to `relic validate` to check `.relic/fixes/`
- Distribution pipeline changes

---

## Shared Artifacts

**Owns:**
- `shared/domains/FixDomain.md` — the fix lifecycle, session state, and fix ID conventions
- `shared/contracts/FixDocumentContract.md` — schema of `.relic/fixes/<fix-id>.md`
- `shared/contracts/ContextResultContract.md` — claim ownership; amend to add `current_fix`
  field (currently unowned)

**Reads:**
- `shared/domains/SpecResolutionDomain.md` — fix session state extends the resolution chain
- `shared/domains/SpecDomain.md` — fix operates within the spec bounded context
- `shared/rules/ChangelogAppendOnlyRule.md` — `/relic.solve` must write a changelog entry

---

## Open Questions

*(None blocking.)*

---

## Decisions

- **Two-stage pipeline with human gate:** Separating diagnosis (`/relic.fix`) from application
  (`/relic.solve`) is non-negotiable. Misclassifying root cause and auto-applying can corrupt
  specs permanently. The review gate costs one step and prevents irreversible damage.

- **Ownership refusal as a forcing function:** Refusing to fix unowned code is the spec's
  most important property. On a large codebase every fix attempt either succeeds (spec exists)
  or results in a new spec. Coverage grows monotonically without a migration project.

- **`current-fix` takes precedence over `current-spec` for clarify/analyse:** When in a
  debugging session the developer is thinking in fix context. Automatic context switching
  removes the mental overhead of manually switching sessions.

- **Fix documents are committed, not gitignored:** The fix document is team audit trail.
  Teammates should see the diagnosis. Only the session pointer (`current-fix`) is personal.

- **`relic use --fix` as the API:** A flag on the existing `relic use` keeps the API surface
  minimal. The pattern is: `relic use` manages all active session state.

- **`session.json` not another flat text file:** Adding `.relic/current-fix` as a second
  flat text file alongside `current-spec` produces a proliferation of opaque, single-purpose
  files. A single `.relic/session.json` holds all personal session state in one readable,
  extensible place. Future session concerns (e.g. active branch override, last search query)
  can be added as fields without creating new files. JSON was chosen over TOML because Relic
  already has `readJson`/`writeJson` utilities in `@relic/utility` — no new parser dependency.

- **Backwards compatibility via read fallback:** `current-spec` is kept gitignored and
  readable as a fallback so existing users don't break on upgrade. New writes always go to
  `session.json`.

- **`wrong-spec` classification requires spec amendment:** When the spec itself is wrong,
  fixing only the code produces a codebase that contradicts its spec. `/relic.solve` must
  amend `spec.md` in this case. The spec is always the source of truth.
