# Spec: Agent Permission Config

**Spec ID:** 002-agent-permission-config
**Created:** 2026-04-12
**Status:** ready

---

## Overview

Two problems solved together because they share the same root cause — engine management
in Relic has no structure.

**Problem 1 — No permission pre-approval:** Every `relic context`, `relic validate`,
`relic scaffold`, etc. triggers an interactive approval prompt during AI workflows.
The fix is to write a committed, project-level permission config during `relic add-engine`
so the whole team gets zero-prompt behaviour via `git pull`.

**Problem 2 — Engine structure is broken:** Claude's slash command prompts live in
`templates/prompts/` — there is no `templates/engines/claude/`. Copilot and Codex each
get a single giant file that duplicates all workflow documentation inline. When any prompt
changes, it must be updated in three places. Adding a fourth engine has no clear path.

The solution has three parts. First, introduce `packages/utility` (`@relic/utility`) — a shared
utility package that owns `fs.ts` and `spec-id.ts`, currently duplicated or at risk of
duplication. Both `@relic/core` and `@relic/engines` depend on it. New utility scopes
(e.g. a future `string.ts` or `json.ts`) are added as new files in this package — no new
packages needed.

Second, introduce `packages/engines` (`@relic/engines`) — a dedicated package owning all
engine write logic. Each engine is an isolated directory. `@relic/engines` depends on
`@relic/utility`, not `@relic/core`.

Third, clean up templates: `templates/engines/` is deleted (it was the duplication). The
single source of truth for all prompt content is `templates/prompts/` only. At build time,
`scripts/embed-engine-templates.ts` reads from `templates/prompts/` and produces `ENGINE_TEMPLATES`
in `packages/engines/src/generated/`. Copilot and Codex outputs are assembled at runtime
by composing from that map. Permission configs are part of each engine's write output.

---

## Requirements

### Functional Requirements

**Shared utils package:**

- **FR-1:** Create `packages/utility/` as a new Bun workspace package (`@relic/utility`).
  It has no dependencies on any other Relic package. It exports `fs.ts` (all file I/O
  helpers) and `spec-id.ts` (spec ID utilities), moved verbatim from
  `packages/core/src/utils/`. Both `@relic/core` and `@relic/engines` replace their
  local utils imports with imports from `@relic/utility`.

**Engine package structure:**

- **FR-2:** Create `packages/engines/` as a new Bun workspace package (`@relic/engines`).
  It depends on `@relic/utility` only — not on `@relic/core`. It owns all engine write logic.
  `@relic/core` imports `runAddEngine` and `SUPPORTED_ENGINES` from it, and removes its
  own `commands/add-engine.ts`.

- **FR-3:** Each engine gets a dedicated directory `packages/engines/src/engines/<name>/`
  with its own `index.ts` (write logic only — no templates inside the package source).
  Initial engines: `claude/`, `copilot/`, `codex/`.

- **FR-4 (Build step):** A new `scripts/embed-engine-templates.ts` reads exclusively from
  `templates/prompts/` (the sole source of truth for prompt content) and produces
  `packages/engines/src/generated/engine-templates.ts` as the `ENGINE_TEMPLATES` map.
  `templates/engines/` is deleted as part of this spec — it was the duplication. The
  `@relic/core` TEMPLATES map no longer contains `prompts/*` keys; it retains only the
  5 scaffold templates: `preamble.md`, `constitution.md`, `spec.md`, `plan.md`, `tasks.md`.

- **FR-5:** Claude's write logic reads 10 prompt keys from `ENGINE_TEMPLATES` (e.g.
  `prompts/specify.md`) and writes them as individual slash command files. Same content,
  new source.

- **FR-6 (Runtime composition):** Copilot and Codex write functions assemble their
  single-file output at runtime by reading multiple prompt keys from `ENGINE_TEMPLATES`
  and concatenating them with appropriate headers. No duplication — a prompt change in
  `templates/prompts/` propagates to all three engines via the shared map.

**Permission configs:**

- **FR-7 (Claude):** The Claude write function also writes `.claude/settings.json` with:
  ```json
  { "permissions": { "allow": ["Bash(relic *)"] } }
  ```
  Merge strategy: if the file exists, deep-merge — preserve existing keys, append
  `"Bash(relic *)"` to `allow` only if not already present. Idempotent.

- **FR-8 (Codex):** The Codex write function also writes `.codex/config.toml` with:
  ```toml
  [rules]
  prefix_rules = [
    { pattern = ["relic"], decision = "allow" }
  ]
  ```
  Merge strategy: if the file exists and already contains `["relic"]`, skip. If the file
  exists but lacks it, append the rule block as a TOML string fragment. No TOML parser
  dependency — simple string-based idempotency check.

- **FR-9 (Copilot):** No permission mechanism exists for Copilot. No file written.
  Documented as N/A in console output.

- **FR-10:** Console output of `relic add-engine` lists every file written for the engine,
  including permission config files.

### Non-Functional Requirements

- **NFR-1:** `@relic/utility` has no dependencies on any other Relic package. It is the
  dependency floor — nothing it imports can create a cycle.
- **NFR-2:** `@relic/engines` depends only on `@relic/utility`. No dependency on `@relic/core`.
- **NFR-3:** `@relic/core` re-exports `runAddEngine`, `SUPPORTED_ENGINES`, and `Engine`
  from `@relic/engines` to preserve the public API for `packages/cli-node`. No changes
  needed in CLI packages.
- **NFR-4:** `bun run build:templates` in `package.json` is updated to also run the engine
  embed step. Both embeds must run before any binary build target.
- **NFR-5:** Adding a new engine requires only: create `packages/engines/src/engines/<name>/`,
  write its `index.ts`, add the name to `SUPPORTED_ENGINES`. Nothing else changes.
  Adding a new shared utility requires only: create a new file in `packages/utility/src/`.

**Testing:**

- **NFR-6:** `packages/utility` gets its own test suite (`src/__tests__/`, test script in
  `package.json`). The existing `fs.test.ts` and `spec-id.test.ts` move from
  `packages/core/src/__tests__/` to `packages/utility/src/__tests__/` — they test the same
  code, just from its new home.
- **NFR-7:** `packages/engines` gets its own test suite. Tests cover: each engine's file
  output (files created, content shape), permission file writes, idempotency of merges,
  `ENGINE_TEMPLATES` key presence after build.
- **NFR-8:** `packages/core/src/__tests__/` loses `fs.test.ts` and `spec-id.test.ts`
  (moved to utils). The `init.test.ts` is reviewed — it calls `runAddEngine` indirectly;
  the import path changes but the test logic survives. The CI `--filter '*'` automatically
  covers all three new packages.

---

## User Stories

- As a developer adopting Relic, I want `relic init` to pre-approve all `relic *` commands
  so I never see permission prompts during workflows.
- As a team member, I want the permission config committed so I get zero-prompt behaviour
  after `git clone`, without manual setup.
- As a Relic contributor adding a new engine, I want a clear isolated directory to put
  engine logic without touching `@relic/core`.
- As a maintainer, I want a single source of truth for each workflow prompt — one edit in
  `templates/prompts/` propagates to Claude, Copilot, and Codex.

---

## Scope

### In Scope

- New `packages/utility/` workspace package (`@relic/utility`) — `fs.ts` and `spec-id.ts` moved from core
- New `packages/engines/` workspace package (`@relic/engines`) — write logic only, depends on `@relic/utility`
- Per-engine directories: `claude/`, `copilot/`, `codex/` (each with `index.ts` only)
- `templates/engines/` deleted entirely (it was the duplication)
- New `scripts/embed-engine-templates.ts` — reads `templates/prompts/` only, writes `ENGINE_TEMPLATES` into `packages/engines/src/generated/`
- `@relic/core` TEMPLATES map stripped of prompt keys (retains 5 scaffold templates)
- `@relic/core` utils imports updated to point to `@relic/utility`
- Runtime composition of Copilot and Codex single-file outputs from `ENGINE_TEMPLATES`
- Permission configs: `.claude/settings.json` (FR-7), `.codex/config.toml` (FR-8)
- `packages/core/src/commands/add-engine.ts` removed; `packages/core/src/index.ts` re-exports from `@relic/engines`
- `package.json` `build:templates` updated to run both embed steps
- Test suites in `packages/utility/src/__tests__/` and `packages/engines/src/__tests__/`
- `fs.test.ts` and `spec-id.test.ts` moved from `packages/core` to `packages/utility`
- `init.test.ts` in `packages/core` reviewed post-refactor

### Out of Scope

- Moving `packages/cli-node` or `packages/cli-python` — unchanged
- Changing the `relic add-engine` CLI interface
- Adding new engines beyond the three existing ones
- `settings.local.json` — personal file, untouched
- Global / user-level permission config

---

## Shared Artifacts

**Owns:**
- (none — structural monorepo change; no new shared artifact needed)

**Reads:**
- `shared/assumptions/ClaudeAsDefaultEngine.md`
- `shared/domains/TemplateDomain.md`

---

## Open Questions

*(All resolved — no blocking questions.)*

---

## Decisions

- **`@relic/utility` as the dependency floor:** No Relic package may create a utility
  function that another Relic package needs and not put it in `@relic/utility`. The dep
  graph is: `utils` ← `engines`, `utils` ← `core`, `engines` ← `core`. No cycles possible.
- **`fs.ts` and `spec-id.ts` move to utils, not copied:** Moving (not duplicating) keeps
  tests in one place and makes the import graph unambiguous.
- **New package for each new concern, new file for each new utility within a concern:**
  `@relic/utility` grows by adding files. Only create a new package when the concern has
  its own lifecycle, dependencies, or deployment boundary.
- **`templates/prompts/` as the single update point for prompts:** This is the only place
  a prompt is ever edited. `templates/engines/` is deleted — it was the source of drift.
  The build step reads from `templates/prompts/` only and produces `ENGINE_TEMPLATES`. No
  prompt content lives anywhere else. A change to any prompt is automatically reflected in
  Claude slash commands, Copilot instructions, and Codex instructions on the next build.
- **The 5 scaffold templates stay in `@relic/core`:** `preamble.md`, `constitution.md`,
  `spec.md`, `plan.md`, `tasks.md` are used by `init.ts` and `scaffold.ts` in core — they
  remain in `TEMPLATES` and are not touched by this spec.
- **Runtime composition for Copilot/Codex:** Cheaper than a build-time concatenation step.
  The write function reads N keys from `ENGINE_TEMPLATES` and concatenates — no extra tooling.
- **Codex TOML merge without a parser:** A string-contains check for `["relic"]` is
  sufficient for idempotency. Avoids adding a TOML dependency.
- **Wildcard `Bash(relic *)` for Claude:** Covers all current and future subcommands.
- **Committed `settings.json`, not `settings.local.json`:** The local file stays for
  personal overrides. The committed file is the team-shared baseline.
