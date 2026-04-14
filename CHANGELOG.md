# Changelog

All notable changes to `relic-cli` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Fixed
- `relic add-engine copilot` now writes individual `.github/prompts/relic.<name>.prompt.md`
  files (one per command, with YAML frontmatter `description: Relic <name> command`) instead
  of a single `.github/copilot-instructions.md`. These appear as native slash commands in
  Copilot Chat (type `/` to pick from the list).
- `relic add-engine codex` now writes individual `.codex/commands/relic.<name>.md` files
  (one per command, prompt body written directly) instead of a single `.codex/instructions.md`.
  These appear as native slash commands in Codex.
- Both Copilot and Codex engines now include the `/relic.solve` command (11 commands total,
  in parity with Claude Code).

---

## [0.4.0] — 2026-04-13

### Added
- `@relic/utility` (`packages/utility/`) — new shared utility package exporting `fs.ts`
  and `spec-id.ts`. Dependency floor for the monorepo; no Relic package dependencies.
- `@relic/engines` (`packages/engines/`) — new dedicated engine management package owning
  all write logic for Claude, Copilot, and Codex. Depends on `@relic/utility` only.
- `relic add-engine claude` now writes `.claude/settings.json` with
  `{ "permissions": { "allow": ["Bash(relic *)"] } }` — committed permission config
  eliminates interactive approval prompts for all `relic *` commands in Claude Code.
  Merge is idempotent; calling `add-engine` twice keeps exactly one entry.
- `relic add-engine codex` now writes `.codex/config.toml` with
  `prefix_rules = [{ pattern = ["relic"], decision = "allow" }]`.
  Idempotent — skipped if `["relic"]` already present.

### Changed
- Copilot and Codex outputs are now generated at runtime from `ENGINE_TEMPLATES` (sourced
  from `templates/prompts/`). A prompt change in `templates/prompts/` propagates to all
  three engines automatically on the next build. (Note: the per-command file format shipped
  in the Unreleased fix above; this release shipped the template pipeline that enables it.)
- `build:templates` now runs `build:engine-templates` first (generates `ENGINE_TEMPLATES` in
  `packages/engines/src/generated/`) before the core scaffold template embed step.
- `packages/core` imports `fs.ts` and `spec-id.ts` utilities from `@relic/utility`;
  imports `runAddEngine` from `@relic/engines`. Public API of `@relic/core` is unchanged.

### Removed
- `templates/engines/` deleted — `templates/prompts/` is now the sole source of truth
  for all prompt content. No more duplicate maintenance for Copilot and Codex.
- `packages/core/src/commands/add-engine.ts` removed; logic moved to `@relic/engines`.
- `packages/core/src/utils/fs.ts` and `packages/core/src/utils/spec-id.ts` removed;
  moved to `packages/utility/src/`.

---

## [0.3.0] — 2026-04-12

### Added
- `relic search <keywords...>` — search shared artifact manifests by keyword tags.
  Loads all `shared/*/manifest.json` files and returns scored candidates where any
  tag matches a keyword (case-insensitive substring). Returns JSON array sorted
  by score descending; returns `[]` if no matches. Errors if no keywords given.
- `relic deep-search` — return all manifest entries consolidated across every
  `shared/` subdirectory. LLM is instructed to read `tldr` fields only and load
  full artifact files selectively. Use as a fallback when `relic search` returns
  insufficient results.
- `manifest.json` per `shared/<subdir>/` — flat JSON index that every artifact file
  must register in. Schema: `[{ name, file, tldr, tags }]`. The `preamble.md`
  now mandates this as an invariant.
- `relic validate` extended with two new checks:
  - `missing_manifests` — a `shared/` subdirectory has `.md` files but no `manifest.json`
  - `unregistered_files` — a `.md` file is not listed in its subdirectory's manifest
- `templates/prompts/scan.md` — new Step 8: register every produced artifact in its
  manifest before the changelog step.
- Two-step discovery cascade in `specify` and `plan` prompts: extract up to 10 keywords
  from the user's input → `relic search` first; fall back to `relic deep-search` only
  if results are insufficient.

---

## [0.2.1] — 2026-04-11

### Fixed
- `relic init` no longer creates `.relic/prompts/` — prompt files already live in
  engine-specific hook directories (`.claude/commands/`, `.github/`, `.codex/`).
  The copy in `.relic/prompts/` was redundant. Existing projects can safely delete
  that folder.

---

## [0.2.0] — 2026-04-11

### Added
- `relic context [--spec <id>] [--text]` — resolve the active spec and report file
  existence and shared artifact references. Replaces `check-context.sh`. JSON by default;
  `--text` for human-readable output. Errors with a `relic scaffold` hint if the spec
  directory does not exist.
- `relic scaffold [--title <title>] [--spec <id>]` — ensure a spec folder exists; create
  it from templates if new. Replaces `scaffold-spec.sh`. `--title` generates a new spec ID;
  `--spec` resolves an existing one. Errors if both flags are passed simultaneously.
  Writes `.relic/current-spec` on success.
- `relic validate [--text]` — check artifact integrity and ownership conflicts across all
  specs. Replaces `validate-artifacts.sh`. JSON by default; `--text` for human-readable
  output. Checks: ownership conflicts, missing owned/read artifacts, illegal spec-dir
  files, and invalid paths (must start with `shared/`).

### Changed
- `relic init` no longer writes `.relic/scripts/` or `.relic/templates/` — all helpers
  are now first-class CLI commands; no bash or Python dependency in user projects.
- All AI prompt templates and engine instructions (`copilot-instructions.md`,
  `instructions.md`) updated to call `relic context`, `relic scaffold`, and `relic validate`
  directly instead of `bash .relic/scripts/*.sh`.

### Removed
- Bash utility scripts (`check-context.sh`, `scaffold-spec.sh`, `validate-artifacts.sh`,
  `common.sh`) removed from the template set. Existing projects that still have
  `.relic/scripts/` can delete that folder — it is no longer used or written.

---

## [0.1.1] — 2026-04-11

### Fixed
- **BREAKING install fix**: removed `@relic/core: workspace:*` and `commander` from
  `dependencies` — both are bundled into `dist/relic.js` at build time. All users were
  getting `EUNSUPPORTEDPROTOCOL` on `npm install`.
- Stripped Bun shebang (`#!/usr/bin/env bun` / `// @bun`) from `dist/relic.js` via
  post-build script — tools that inspect shebangs were treating this as a Bun package.
- Replaced `prompt()` (Bun/browser global) in `specify.ts` with Node.js `readline` —
  `prompt()` throws `ReferenceError` in Node.js.
- Added `shared/` prefix guard in `context-builder.ts` to prevent path traversal via
  crafted `artifacts.json` entries.
- Fixed `sed` injection in `scaffold-spec.sh`: spec titles containing `&` or `\` were
  silently corrupting template files during substitution.
- Fixed arg parsing in `check-context.sh`: `shift` inside a `for..in` loop is a no-op;
  replaced with `while/shift` pattern.
- Moved `@types/node` from `dependencies` to `devDependencies` in workspace root.

### Added
- `LICENSE` file (MIT).
- `scripts/fix-shebang.mjs` — post-build step that strips Bun markers from the Node.js bundle.

---

## [0.1.0] — 2026-04-10

Initial MVP release.

### Added
- `relic init [--engine claude|copilot|codex] [--dir] [--force]` — scaffold `.relic/`
  into any project. Writes preamble, constitution, changelog, shared brain directories,
  bash utility scripts, and AI engine hook files.
- `relic add-engine <claude|copilot|codex>` — add AI engine hooks to an existing project.
- `relic use <spec-id>` — set the active spec by writing `.relic/current-spec`.
- `relic scan [--json]` — walk the project and output a structured manifest (tech stack,
  key files, file tree, existing artifacts) for the `/relic.scan` AI workflow.
- **10 AI slash commands** written to engine hook directories:
  `/relic.specify`, `/relic.clarify`, `/relic.plan`, `/relic.analyse`, `/relic.tasks`,
  `/relic.implement`, `/relic.fix`, `/relic.use`, `/relic.scan`, `/relic.constitution`
- **Claude Code** hooks: `.claude/commands/relic.*.md` (one file per command)
- **GitHub Copilot** hooks: `.github/copilot-instructions.md`
- **Codex** hooks: `.codex/instructions.md`
- `preamble.md` — Relic's immutable structural and operational rules
- `constitution.md` — project-specific template with principles, tech stack, testing
  standards, architecture, workflow, and governance sections
- `scaffold-spec.sh` — ensures spec folders exist before AI acts; creates from templates;
  writes `.relic/current-spec`
- `check-context.sh` — resolves active spec and outputs structured JSON context
- `validate-artifacts.sh` — checks artifact integrity and ownership conflicts
- Active spec tracking via `.relic/current-spec` (gitignored); resolution order:
  `--spec arg` → `RELIC_SPEC` env → `current-spec` file → git branch → error
- Cross-platform Node.js bundle via `bun build --target node` (no Bun runtime required)
