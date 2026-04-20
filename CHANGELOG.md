# Changelog

All notable changes to `relic-cli` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [0.8.2] — 2026-04-20

### Fixed
- `models.json` numeric fields (`maxHistoryMessages`, `recentFullMessages`, `timeoutMs`) now
  validated on load. Negative values, non-integers, zero timeouts, and incoherent combinations
  (`recentFullMessages > maxHistoryMessages`) all produce actionable errors naming the field,
  its invalid value, the constraint, and the config path — then exit non-zero. Previously these
  were accepted silently and corrupted history trimming behaviour.
- Config parsing extracted to `parseModelConfig()` in `@relic/utility`, paralleling
  `resolveSpec()`. `ModelConfig` type moved to `@relic/utility` as the single source of truth
  for all consumers.
- `relic specify` and `relic fix` now error consistently when `.relic/models.json` is absent,
  matching every other workflow command. Previously both had silent fallbacks (print guidance /
  print context to stdout) that contradicted the documented behaviour.
- `scripts/publish.ts` no longer references the deleted `bin.debug.ts`. Version bump now covers
  exactly 5 files as documented.
- Root `package.json` `dev:debug` and `build:binary:debug` scripts removed — both targeted the
  deleted debug binary and would fail if invoked.
- `relic specify --spec <id>` option removed — the flag was registered but silently ignored.

### Changed
- Spec and fix resolution centralised into `resolveSpec()` and `resolveFix()` in `@relic/utility`.
  All workflow commands now use the same five-step chain:
  `--spec arg → active fix owning spec → RELIC_SPEC env → session.json → git branch inference`.
  Previously the chain was copy-pasted across 8+ command files with no shared implementation.
- `relic model --reset-context` now uses the full five-step resolution chain. Previously it
  skipped the `RELIC_SPEC` env var, active-fix, and git branch inference steps.
- `relic clarify`, `relic analyse`, and other fix-aware commands now automatically use the fix's
  owning spec when a fix is active (`session.fix` is set), without requiring the user to also
  set `session.spec` separately.

### Infrastructure
- Release flow: `bun run publish` now pushes only the release branch. The `vX.Y.Z` tag is
  created automatically after the PR merges to `main` via the new `tag-release.yml` workflow.
  Publish CI can no longer fire before doc-guard has passed.
- GitHub Copilot workspace instructions (`.github/copilot-instructions.md`) added — scopes
  reviews to application code and enforces a 7-point checklist covering version sync, changelog
  completeness, README drift, template/generated sync, intersection safety, self-hosting
  coherence, and path security.
- Doc Guard CI (`doc-guard.yml`) added — detects version bumps on PRs, verifies a matching
  `## [X.Y.Z]` entry in `CHANGELOG.md`, warns on untouched `README.md`, and blocks merge on
  missing changelog entries.

---

## [0.8.0] — 2026-04-18

### Added
- **Direct model invocation** — workflow commands (`specify`, `clarify`, `plan`, `analyse`,
  `tasks`, `implement`, `fix`, `solve`, `constitution`) are now first-class production CLI
  commands. When `.relic/models.json` is present, each command assembles spec context, loads
  its prompt template, and calls any OpenAI-compatible API endpoint directly — no IDE required.
  Primary target: Ollama running locally or on a remote machine via SSH port forwarding.
- `relic specify / clarify / plan / analyse / tasks / implement / fix` — all workflow commands
  added to the production binary. Each accepts `--spec <id>`, `--no-stream`, and `--reset-context`.
- `relic solve [--fix <id>] [--no-stream]` — apply the active fix document via model call.
- `relic constitution [--no-stream]` — regenerate `.relic/constitution.md` from the codebase.
- `relic model --reset-context [--spec <id>]` — clear per-spec conversation history.
- `relic scan` default inverted — `relic scan` now runs the AI workflow by default, matching
  `/relic.scan` in the IDE. `--manifest` flag (and `--manifest --json`) preserve the previous
  manifest-only output. `--json` alone treated as `--manifest --json` for backward compatibility.
- **Conversation history** — persisted per-spec at `.relic/specs/<spec-id>/history.json`
  (gitignored). Subsequent commands within a spec retain reasoning continuity.
- **Structural history compression** — messages older than `recentFullMessages` (default: 2)
  are compressed deterministically: headings and bullets kept, prose truncated to first sentence,
  code blocks dropped. No model calls, no cost.
- `models.json` config: `baseUrl`, `model`, `apiKey?`, `maxHistoryMessages?` (default 20),
  `recentFullMessages?` (default 2), `timeoutMs?` (default 300,000ms / 5 min).
- Env var overrides: `RELIC_MODEL_BASE_URL`, `RELIC_MODEL_MODEL`, `RELIC_MODEL_API_KEY` — enable
  CI usage without committed credentials.
- `getPromptTemplate(name)` export added to `@relic/engines` — surfaces `ENGINE_TEMPLATES` for
  use by the model runner.
- `relic init` now writes all three gitignore entries: `session.json`, `models.json`,
  `specs/**/history.json`.

### Changed
- Single production binary — `bin.debug.ts` deleted; all commands live in `bin.ts`. One system
  to understand and maintain.
- `fetchWithTimeout` in `@relic/utility` now accepts an optional `RequestInit` parameter,
  enabling POST requests with headers and body.
- `preamble.md` (template and installed copy) updated: spec directories now officially allow
  five files (`spec.md`, `plan.md`, `tasks.md`, `artifacts.json`, `history.json`).
- `relic validate` allows `history.json` in spec directories (session-local, not a content check).

### Fixed
- `relic init` was writing only `session.json` to `.relic/.gitignore`, omitting `models.json`
  and `specs/**/history.json`. New projects now receive all three entries on init.

---

## [0.7.0] — 2026-04-15

### Added
- **Toon manifest format** — `shared/*/manifest.toon` replaces `manifest.json` as the default
  index format. Toon is a compact, pipe-delimited line format optimised for LLM consumption:
  one entry per line, no JSON overhead, scannable without parsing.
- `relic toon-migrate` — convert existing `shared/*/manifest.json` files to `manifest.toon`;
  rebuild the spec and fix indexes in the new format.
- `relic search` and `relic deep-search` now output toon lines by default (Constitution
  amendment: toon is the enforced default for all list-returning LLM-facing commands).
  `--json` flag available for machine consumers.

### Changed
- `relic validate` prefers `manifest.toon` over `manifest.json`; warns and falls back when
  only `manifest.json` is present.
- `relic search` `--knowledge`, `--spec`, `--fix` scope flags now work against the toon indexes.

---

## [0.6.4] — 2026-04-14

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

## [0.6.0] — 2026-04-13

### Added
- `relic upgrade [--check] [--prompts] [--text]` — upgrade the `relic-cli` binary and refresh
  AI engine hook files. `--check` reports available updates without installing. `--prompts`
  refreshes hook files only (skips binary upgrade). `--text` for human-readable output.

---

## [0.5.0] — 2026-04-13

### Added
- **Two-stage fix pipeline** — `/relic.fix` (diagnosis) + `/relic.solve` (application).
  `/relic.fix` identifies the owning spec, classifies the root cause, and writes a fix document
  to `.relic/fixes/<fix-id>.md`. `/relic.solve` applies code changes, updates the knowledge
  layer if contracts changed, and closes the fix.
- `session.json` replaces `.relic/current-spec` as the session state file. Carries both
  `session.spec` and `session.fix`, enabling the two-stage fix pipeline.
- `relic use --fix <fix-id>` — set the active fix (validates the fix document exists).
- `relic use --clear-fix` — clear the active fix from session state.
- `relic context` now reports `current_fix` alongside the active spec.
- `.relic/fixes/` directory and `fixes/manifest.toon` index created by `relic init`.
- Fix ID format: `YYYY-MM-DD-<slug>` (e.g. `2026-04-13-null-session-read-on-missing-file`).

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
