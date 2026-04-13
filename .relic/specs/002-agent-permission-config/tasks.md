# Tasks: Agent Permission Config

**Spec ID:** 002-agent-permission-config
**Generated from plan:** 2026-04-12

---

## Phase 1 — Create `packages/utility`

- [ ] **T-01** Create `packages/utility/package.json`
  - name `@relic/utility`, `"type": "module"`, no Relic deps
  - devDep `@types/bun`, scripts `"test": "bun test src/__tests__"`
  - exports `"."`: `"./src/index.ts"`

- [ ] **T-02** Create `packages/utility/src/fs.ts`
  - Copy verbatim from `packages/core/src/utils/fs.ts`

- [ ] **T-03** Create `packages/utility/src/spec-id.ts`
  - Copy verbatim from `packages/core/src/utils/spec-id.ts`
  - Internal import `./fs.ts` is unchanged

- [ ] **T-04** Create `packages/utility/src/index.ts`
  - Re-export everything from `./fs.ts` and `./spec-id.ts`

- [ ] **T-05** Move `packages/core/src/__tests__/fs.test.ts` → `packages/utility/src/__tests__/fs.test.ts`
  - Update import: `../utils/fs.ts` → `../fs.ts`
  - Delete the original from `packages/core`

- [ ] **T-06** Move `packages/core/src/__tests__/spec-id.test.ts` → `packages/utility/src/__tests__/spec-id.test.ts`
  - Update import: `../utils/spec-id.ts` → `../spec-id.ts`
  - Delete the original from `packages/core`

---

## Phase 2 — Create `packages/engines`

- [ ] **T-07** Create `packages/engines/package.json`
  - name `@relic/engines`, `"type": "module"`
  - dep `@relic/utility: "workspace:*"`, devDep `@types/bun`
  - scripts `"test": "bun test src/__tests__"`
  - exports `"."`: `"./src/index.ts"`

- [ ] **T-08** Create `packages/engines/src/engines/claude/index.ts`
  - Port `writeClaude()` from `packages/core/src/commands/add-engine.ts`
  - Import `ENGINE_TEMPLATES` from `../../generated/engine-templates.ts`
  - Import file I/O from `@relic/utility`
  - Add: write `.claude/settings.json` with `{ "permissions": { "allow": ["Bash(relic *)"] } }`
    — read existing JSON if present, merge `allow` array, write back; skip if `Bash(relic *)` already present
  - Update console output to list `settings.json` alongside the command files

- [ ] **T-09** Create `packages/engines/src/engines/copilot/index.ts`
  - Port `writeCopilot()` from `add-engine.ts`
  - Replace single-template read with runtime composition: iterate all 10 `prompts/*.md` keys
    from `ENGINE_TEMPLATES` in order, prepend a `## <CommandName>` header per section, concatenate
  - Write result to `.github/copilot-instructions.md`
  - No permission file; console output notes `(no permission config for Copilot)`

- [ ] **T-10** Create `packages/engines/src/engines/codex/index.ts`
  - Port `writeCodex()` from `add-engine.ts`
  - Replace single-template read with runtime composition (same as T-09)
  - Write result to `.codex/instructions.md`
  - Add: write `.codex/config.toml` with:
    ```toml
    [rules]
    prefix_rules = [
      { pattern = ["relic"], decision = "allow" }
    ]
    ```
    Idempotency: if file exists and already contains the string `["relic"]`, skip; otherwise
    create fresh or append the block

- [ ] **T-11** Create `packages/engines/src/index.ts`
  - Export `runAddEngine(options: { engine: Engine; projectDir: string }): Promise<void>`
  - Export `SUPPORTED_ENGINES: Engine[]` and `Engine` type
  - Dispatch to the correct engine `index.ts` based on the `engine` argument
  - Re-export `Engine` as a type

---

## Phase 3 — Build scripts and template cleanup

- [ ] **T-12** Create `scripts/embed-engine-templates.ts`
  - Read all `.md` files under `templates/prompts/` (recursive)
  - Produce `packages/engines/src/generated/engine-templates.ts` as `ENGINE_TEMPLATES` map
  - Key format: `prompts/<filename>` (e.g. `prompts/specify.md`)
  - Same backtick/escape logic as `scripts/embed-templates.ts`
  - Log: `Embedded N engine templates → packages/engines/src/generated/engine-templates.ts`

- [ ] **T-13** Modify `scripts/embed-templates.ts`
  - Add filter: skip any file whose path falls under `templates/prompts/`
  - After `templates/engines/` is deleted, the 5 root scaffold files are all that remain

- [ ] **T-14** Delete `templates/engines/` directory
  - Remove `templates/engines/copilot/copilot-instructions.md`
  - Remove `templates/engines/codex/instructions.md`
  - Remove now-empty `templates/engines/copilot/`, `templates/engines/codex/`, `templates/engines/`

- [ ] **T-15** Update root `package.json` build scripts
  - Add `"build:engine-templates": "bun run scripts/embed-engine-templates.ts"`
  - Update `"build:templates"`: `"bun run build:engine-templates && bun run scripts/embed-templates.ts"`
  - Verify all existing `build:*` targets that call `build:templates` still compose correctly

---

## Phase 4 — Update `packages/core`

- [ ] **T-16** Update `packages/core/package.json`
  - Add `"@relic/utility": "workspace:*"` to dependencies
  - Add `"@relic/engines": "workspace:*"` to dependencies

- [ ] **T-17** Update imports in `packages/core/src/commands/` (9 files)
  - `context.ts`: `../utils/fs.ts` → `@relic/utility`; `../utils/spec-id.ts` → `@relic/utility`
  - `fix.ts`: same pattern
  - `init.ts`: `../utils/fs.ts` → `@relic/utility`
  - `scaffold.ts`: both utils imports → `@relic/utility`
  - `scan.ts`: `../utils/fs.ts` → `@relic/utility`
  - `search.ts`: `../utils/fs.ts` → `@relic/utility`
  - `specify.ts`: both utils imports → `@relic/utility`
  - `use.ts`: both utils imports → `@relic/utility`
  - `validate.ts`: `../utils/fs.ts` → `@relic/utility`

- [ ] **T-18** Update imports in `packages/core/src/core/` (3 files)
  - `artifact-registry.ts`: `../utils/fs.ts` → `@relic/utility`
  - `changelog.ts`: `../utils/fs.ts` → `@relic/utility`
  - `context-builder.ts`: `../utils/fs.ts` → `@relic/utility`

- [ ] **T-19** Delete `packages/core/src/commands/add-engine.ts`

- [ ] **T-20** Delete `packages/core/src/utils/fs.ts`, `packages/core/src/utils/spec-id.ts`
  - Remove `packages/core/src/utils/` directory

- [ ] **T-21** Update `packages/core/src/index.ts`
  - Remove: `export { runAddEngine, SUPPORTED_ENGINES } from "./commands/add-engine.ts"`
  - Remove: `export type { Engine } from "./commands/add-engine.ts"`
  - Add: `export { runAddEngine, SUPPORTED_ENGINES } from "@relic/engines"`
  - Add: `export type { Engine } from "@relic/engines"`
  - Update: `export { findRelicDir } from "./utils/fs.ts"` → `from "@relic/utility"`
  - Update: `export { nextSpecId, slugify, inferSpecFromBranch, availableSpecs } from "./utils/spec-id.ts"` → `from "@relic/utility"`

- [ ] **T-22** Review and update `packages/core/src/__tests__/init.test.ts`
  - `runInit` now calls `runAddEngine` from `@relic/engines` which writes `.claude/settings.json`
    in addition to the command files
  - Verify existing assertions don't break due to the additional file; add assertion for
    `.claude/settings.json` existence if appropriate

---

## Phase 5 — Tests for `packages/engines`

- [ ] **T-23** Create `packages/engines/src/__tests__/add-engine.test.ts`
  - Use `mkdtempSync` / `afterEach rmSync` pattern (same as all other tests)
  - Must run `bun run build:engine-templates` before this test suite can import `ENGINE_TEMPLATES`
    (handled by CI `build:templates` step; locally run `bun run build:templates` first)
  - Claude: `.claude/commands/` contains 10 files; `.claude/settings.json` exists with `Bash(relic *)`
  - Claude idempotency: call twice → `allow` array still has exactly one `Bash(relic *)` entry
  - Copilot: `.github/copilot-instructions.md` exists; content includes at least one prompt section header
  - Codex: `.codex/instructions.md` exists; `.codex/config.toml` exists and contains `["relic"]`
  - Codex idempotency: call twice → `config.toml` still contains exactly one `["relic"]` occurrence
  - `ENGINE_TEMPLATES` has entries for all 10 `prompts/*.md` keys

---

## Phase 6 — Verify

- [ ] **T-24** Run `bun run build:templates` and confirm both embed steps complete without error
- [ ] **T-25** Run `bun run test` and confirm all packages pass (utility, engines, core)
- [ ] **T-26** Run `relic validate` and confirm output is `valid: true`

---

## Notes

- **Ordering is strict for Phases 1–3:** T-01 through T-06 (utility package) must complete
  before T-08 through T-11 (engines imports from utility) and before T-17/T-18 (core imports
  from utility). T-12 through T-15 (build scripts) must complete before T-23 (engines tests
  import `ENGINE_TEMPLATES`).
- **T-17 and T-18 are mechanical:** Every `../utils/fs.ts` import becomes `@relic/utility`;
  every `../utils/spec-id.ts` import becomes `@relic/utility`. Named imports stay the same.
- **Overlap with spec 001:** T-05 and T-06 delete files created by spec 001. Spec 001 is
  fully merged — this is safe. The test logic is unchanged; only import paths adjust.
- **`process.exit` constraint (from constitution):** `runAddEngine` calls `process.exit` on
  unknown engine. T-23 tests only success paths. Error paths are not tested.
- **T-22 note:** If `init.test.ts` checks only the `.relic/` directory contents and not the
  project root, the new `.claude/settings.json` may be created outside the assertion scope —
  no change needed. Read the test before deciding.
