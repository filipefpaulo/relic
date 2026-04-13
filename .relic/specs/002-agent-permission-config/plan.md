# Plan: Agent Permission Config

**Spec ID:** 002-agent-permission-config
**Status:** ready

---

## Architecture Overview

This is a structural refactor of the monorepo. Three new packages are introduced, two
source files are moved, and the build pipeline gains a second embed step.

**Dependency graph after this plan:**
```
@relic/utility   (no Relic deps)
      ↑
@relic/engines   (depends on @relic/utility only)
      ↑
@relic/core      (depends on @relic/utility + @relic/engines)
      ↑
packages/cli-node / packages/cli-python   (unchanged)
```

**Template flow after this plan:**
```
templates/prompts/  (10 files, only source of truth for prompts)
        ↓  embed-engine-templates.ts
packages/engines/src/generated/engine-templates.ts  (ENGINE_TEMPLATES map)
        ↓  runtime, per-engine write function
.claude/commands/*.md  |  .github/copilot-instructions.md  |  .codex/instructions.md
```

`templates/engines/` is deleted. `packages/core`'s `TEMPLATES` map retains only the 5
scaffold templates and no longer contains `prompts/*` keys.

**Phase ordering constraint:** Phase 1 (`@relic/utility`) must complete before Phase 2
(`@relic/engines`) and Phase 4 (`@relic/core` import updates), since both depend on it.
Phase 3 (build scripts) must run before Phase 5 (engines tests need `ENGINE_TEMPLATES`).

---

## Implementation Phases

### Phase 1 — Create `packages/utility`

1. Create `packages/utility/package.json` — name `@relic/utility`, ESM, no Relic deps,
   devDep `@types/bun`, scripts `"test": "bun test src/__tests__"`.
2. Create `packages/utility/src/fs.ts` — exact copy of `packages/core/src/utils/fs.ts`.
3. Create `packages/utility/src/spec-id.ts` — exact copy of `packages/core/src/utils/spec-id.ts`,
   with import updated from `./fs.ts` to `./fs.ts` (same filename, no change needed).
4. Create `packages/utility/src/index.ts` — re-exports everything from `./fs.ts` and `./spec-id.ts`.
5. Move `packages/core/src/__tests__/fs.test.ts` → `packages/utility/src/__tests__/fs.test.ts`
   (update import path: `../commands/...` → `../fs.ts` / adjust relative paths).
6. Move `packages/core/src/__tests__/spec-id.test.ts` → `packages/utility/src/__tests__/spec-id.test.ts`
   (update import path: `../utils/spec-id.ts` → `../spec-id.ts`).

### Phase 2 — Create `packages/engines`

1. Create `packages/engines/package.json` — name `@relic/engines`, ESM, dep `@relic/utility`,
   devDep `@types/bun`, scripts `"test": "bun test src/__tests__"`.
2. Create `packages/engines/src/engines/claude/index.ts` — write logic ported from
   `add-engine.ts` `writeClaude()`. Adds: write `.claude/settings.json` with
   `{ "permissions": { "allow": ["Bash(relic *)"] } }` (JSON merge, idempotent).
3. Create `packages/engines/src/engines/copilot/index.ts` — write logic ported from
   `add-engine.ts` `writeCopilot()`. Updated: instead of reading a single template key,
   compose the output at runtime by reading all 10 `prompts/*.md` keys from `ENGINE_TEMPLATES`
   with section headers, then write `copilot-instructions.md`. No permission file (N/A).
4. Create `packages/engines/src/engines/codex/index.ts` — write logic ported from
   `add-engine.ts` `writeCodex()`. Updated: runtime composition same as Copilot. Adds:
   write `.codex/config.toml` with `[rules] prefix_rules = [{ pattern = ["relic"], decision = "allow" }]`
   (string-based idempotency check for `["relic"]`, no TOML parser).
5. Create `packages/engines/src/index.ts` — exports `runAddEngine`, `SUPPORTED_ENGINES`,
   `Engine` type, each engine's write function.

### Phase 3 — Build scripts and template cleanup

1. Write `scripts/embed-engine-templates.ts` — reads all `.md` files under `templates/prompts/`
   only, produces `packages/engines/src/generated/engine-templates.ts` as `ENGINE_TEMPLATES`.
   Same escaping logic as `embed-templates.ts`.
2. Modify `scripts/embed-templates.ts` — add filter to skip the `prompts/` subdirectory so
   `TEMPLATES` no longer contains `prompts/*` keys. (After `templates/engines/` is deleted,
   only the 5 root scaffold files remain in scope.)
3. Delete `templates/engines/` (both `copilot/copilot-instructions.md` and `codex/instructions.md`).
4. Update root `package.json`:
   - Add `"build:engine-templates": "bun run scripts/embed-engine-templates.ts"`
   - Update `"build:templates"` to run both: `bun run build:engine-templates && bun run scripts/embed-templates.ts`
     (engine templates first, since engines tests depend on them)
   - Ensure all `build:*` targets that currently run `build:templates` still work.

### Phase 4 — Update `packages/core`

1. Update `packages/core/package.json` — add `@relic/utility` and `@relic/engines` as
   dependencies (workspace: `"@relic/utility": "workspace:*"` etc.).
2. Update all 18 import sites in `packages/core/src/` that reference `../utils/fs.ts` or
   `../utils/spec-id.ts` → change to `@relic/utility`. Files to update:
   `commands/context.ts`, `commands/fix.ts`, `commands/init.ts`, `commands/scaffold.ts`,
   `commands/scan.ts`, `commands/search.ts`, `commands/specify.ts`, `commands/use.ts`,
   `commands/validate.ts`, `core/artifact-registry.ts`, `core/changelog.ts`,
   `core/context-builder.ts`.
3. Delete `packages/core/src/commands/add-engine.ts`.
4. Delete `packages/core/src/utils/fs.ts` and `packages/core/src/utils/spec-id.ts`.
   Remove `packages/core/src/utils/` directory if empty.
5. Update `packages/core/src/index.ts`:
   - Remove `export ... from "./commands/add-engine.ts"`
   - Add `export { runAddEngine, SUPPORTED_ENGINES } from "@relic/engines"`
   - Add `export type { Engine } from "@relic/engines"`
   - Update `export { findRelicDir } from "./utils/fs.ts"` → `from "@relic/utility"`
   - Update `export { nextSpecId, ... } from "./utils/spec-id.ts"` → `from "@relic/utility"`
6. Review `packages/core/src/__tests__/init.test.ts` — `runInit` calls `runAddEngine`
   (now from `@relic/engines`). The test sets up a temp dir with preamble/constitution and
   checks directory structure. The engine write functions will now also write
   `.claude/settings.json`; verify the test does not fail due to unexpected files being
   created, and update assertions if needed.

### Phase 5 — Tests for `packages/engines`

1. Create `packages/engines/src/__tests__/add-engine.test.ts` covering:
   - `runAddEngine` claude: `.claude/commands/` created with correct file count; `.claude/settings.json`
     written with `Bash(relic *)` allow rule.
   - `runAddEngine` claude idempotency: calling twice does not duplicate the `allow` entry.
   - `runAddEngine` copilot: `.github/copilot-instructions.md` created; content contains prompt section headers.
   - `runAddEngine` codex: `.codex/instructions.md` created; `.codex/config.toml` written
     with `["relic"]` rule.
   - `runAddEngine` codex idempotency: calling twice does not duplicate the config.toml rule.
   - `ENGINE_TEMPLATES` contains all 10 expected `prompts/*.md` keys (smoke test for build step).

### Phase 6 — Verify

1. Run `bun run build:templates` — both embed steps succeed, no errors.
2. Run `bun run test` — all packages pass (utility, engines, core).
3. Run `relic validate` — clean.
4. Smoke test `relic add-engine claude` against a temp directory — confirm `.claude/settings.json`
   is written with the correct permission rule.

---

## File Changes

| File | Action | Notes |
|---|---|---|
| `packages/utility/package.json` | create | `@relic/utility`, no Relic deps |
| `packages/utility/src/index.ts` | create | re-exports fs + spec-id |
| `packages/utility/src/fs.ts` | create | moved from `packages/core/src/utils/fs.ts` |
| `packages/utility/src/spec-id.ts` | create | moved from `packages/core/src/utils/spec-id.ts` |
| `packages/utility/src/__tests__/fs.test.ts` | create | moved from `packages/core` |
| `packages/utility/src/__tests__/spec-id.test.ts` | create | moved from `packages/core` |
| `packages/engines/package.json` | create | `@relic/engines`, dep on `@relic/utility` |
| `packages/engines/src/index.ts` | create | exports `runAddEngine`, `SUPPORTED_ENGINES`, `Engine` |
| `packages/engines/src/engines/claude/index.ts` | create | write logic + settings.json |
| `packages/engines/src/engines/copilot/index.ts` | create | runtime composition + N/A note |
| `packages/engines/src/engines/codex/index.ts` | create | runtime composition + config.toml |
| `packages/engines/src/__tests__/add-engine.test.ts` | create | per-engine output + idempotency |
| `packages/engines/src/generated/engine-templates.ts` | create (generated) | output of embed-engine-templates.ts |
| `scripts/embed-engine-templates.ts` | create | reads `templates/prompts/` → `ENGINE_TEMPLATES` |
| `scripts/embed-templates.ts` | modify | filter out `prompts/` subdirectory |
| `templates/engines/codex/instructions.md` | delete | replaced by runtime composition |
| `templates/engines/copilot/copilot-instructions.md` | delete | replaced by runtime composition |
| `packages/core/src/commands/add-engine.ts` | delete | logic moved to `@relic/engines` |
| `packages/core/src/utils/fs.ts` | delete | moved to `@relic/utility` |
| `packages/core/src/utils/spec-id.ts` | delete | moved to `@relic/utility` |
| `packages/core/src/__tests__/fs.test.ts` | delete | moved to `packages/utility` |
| `packages/core/src/__tests__/spec-id.test.ts` | delete | moved to `packages/utility` |
| `packages/core/src/index.ts` | modify | re-export from `@relic/engines` + `@relic/utility` |
| `packages/core/src/commands/context.ts` | modify | import from `@relic/utility` |
| `packages/core/src/commands/fix.ts` | modify | import from `@relic/utility` |
| `packages/core/src/commands/init.ts` | modify | import from `@relic/utility` |
| `packages/core/src/commands/scaffold.ts` | modify | import from `@relic/utility` |
| `packages/core/src/commands/scan.ts` | modify | import from `@relic/utility` |
| `packages/core/src/commands/search.ts` | modify | import from `@relic/utility` |
| `packages/core/src/commands/specify.ts` | modify | import from `@relic/utility` |
| `packages/core/src/commands/use.ts` | modify | import from `@relic/utility` |
| `packages/core/src/commands/validate.ts` | modify | import from `@relic/utility` |
| `packages/core/src/core/artifact-registry.ts` | modify | import from `@relic/utility` |
| `packages/core/src/core/changelog.ts` | modify | import from `@relic/utility` |
| `packages/core/src/core/context-builder.ts` | modify | import from `@relic/utility` |
| `packages/core/src/__tests__/init.test.ts` | modify | review for settings.json side-effect |
| `packages/core/package.json` | modify | add `@relic/utility`, `@relic/engines` deps |
| `package.json` | modify | add `build:engine-templates`, update `build:templates` |

---

## Shared Artifact Changes

| Artifact | Action | Notes |
|---|---|---|
| `shared/domains/TemplateDomain.md` | update | Reflect new `ENGINE_TEMPLATES` map and deletion of `templates/engines/`; update "Consumed by" to `@relic/engines` |
| `shared/assumptions/ClaudeAsDefaultEngine.md` | update | Reflect that `relic add-engine claude` now also writes `.claude/settings.json` |

---

## Intersection Notes

**Intersection with spec 001-workflow-test-suite (`touches_files`):**
- `packages/core/src/__tests__/fs.test.ts` and `spec-id.test.ts` — created by spec 001,
  moved by this spec. Spec 001 is merged and complete. Moving these files is safe; the
  logic is unchanged, only the import paths adjust.
- `package.json` — spec 001 added `"test": "bun run --filter '*' test"`. This spec adds
  `build:engine-templates` and updates `build:templates`. Both are additive — no conflict.
  The `--filter '*' test` script automatically picks up the new packages.

---

## Changelog Reference

Written at plan time — see `.relic/changelog.md` entry `[plan] 002-agent-permission-config`.
