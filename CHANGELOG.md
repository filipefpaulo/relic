# Changelog

All notable changes to `relic-cli` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

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
