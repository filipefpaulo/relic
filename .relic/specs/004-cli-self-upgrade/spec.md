# Spec: CLI Self Upgrade

**Spec ID:** 004-cli-self-upgrade
**Created:** 2026-04-13
**Status:** draft

---

## Overview

`relic upgrade` is a native CLI command that keeps Relic up to date without losing any
project knowledge. It detects how the CLI was installed (npm or PyPI), checks for a newer
published version, upgrades the binary via the correct package manager, and refreshes all
AI engine hook files in the user's project — without touching anything in the shared brain,
specs, fixes, or project governance documents.

The problem it solves: developers who upgrade Relic manually risk running stale prompt
templates (the engine hook files in `.claude/commands/`, `.codex/`, `.github/`) while
their binary is updated. Conversely, a naive `npm install -g relic-cli` gives them a new
binary but leaves the old slash commands in place. `relic upgrade` closes this gap in a
single idempotent command.

---

## Requirements

### Functional Requirements

**Version check:**

- **FR-1:** `relic upgrade --check` checks the npm registry for the latest published
  version of `relic-cli`, compares it against the running binary's version, and reports
  whether an update is available. It does not install anything. Output is JSON by default
  (`{ "current": "0.5.1", "latest": "0.6.0", "update_available": true }`);
  `--text` produces a human-readable summary.

- **FR-2:** `relic upgrade` (no flags) performs `--check` first. If already at the latest
  version, it reports this and exits cleanly. If an update is available, it proceeds to
  install it.

**Installation channel detection:**

- **FR-3:** The running binary must be able to report which install channel produced it:
  `"npm"` or `"pypi"`. This is determined at build time — each distribution embeds its
  channel identifier. The upgrade command reads this to select the correct upgrade mechanism.

- **FR-4:** If the install channel cannot be determined (e.g. a local dev build), the
  command reports a warning and exits with instructions to upgrade manually.

**Binary upgrade:**

- **FR-5:** When `INSTALL_CHANNEL` is `"npm"`, upgrade by running:
  `npm install -g relic-cli@<latest>`. The `npm` command must be available on `PATH`.
  If not found, error with instructions to run it manually.

- **FR-6:** When `INSTALL_CHANNEL` is `"pypi"`, try `uv tool upgrade relic-cli` first;
  fall back to `pip install --upgrade relic-cli` if `uv` is not on `PATH`. If neither
  is found, error with instructions.

**Engine hook refresh:**

- **FR-7:** After a successful binary upgrade (or when run as `relic upgrade --prompts`),
  the command detects which AI engines are installed in the current project by checking
  for the presence of their hook directories/files:
  - Claude: `.claude/commands/` directory exists
  - Copilot: `.github/copilot-instructions.md` exists
  - Codex: `.codex/instructions.md` exists

- **FR-8:** For each detected engine, re-run the engine write function (same logic as
  `relic add-engine`) to overwrite the hook files with the versions embedded in the new
  binary. Permission config files (`.claude/settings.json`, `.codex/config.toml`) are
  written with the same idempotent merge logic as `add-engine` — never overwritten
  destructively.

- **FR-9:** `relic upgrade --prompts` refreshes engine hook files only, without upgrading
  the binary. Useful when the binary is already current but hook files are stale from a
  manual install.

**Protected files — MUST NOT be touched:**

- **FR-10:** The following are never modified by `relic upgrade`, regardless of flags:
  - `.relic/shared/` — the entire shared brain
  - `.relic/specs/` — all spec documents
  - `.relic/fixes/` — all fix documents
  - `.relic/changelog.md` — audit trail
  - `.relic/constitution.md` — project governance
  - `.relic/session.json` — personal session state

- **FR-11:** `.relic/preamble.md` IS updated by `relic upgrade` — it is a Relic-owned
  document (not project-specific) that may change across versions. A log line is written
  if preamble content changed.

**Discovery:**

- **FR-12:** Version information is fetched from the npm registry JSON endpoint:
  `https://registry.npmjs.org/relic-cli/latest` → `{ "version": "..." }`.
  Both npm and PyPI channels use this endpoint — they publish from the same version tag.

### Non-Functional Requirements

- **NFR-1:** Constitution Principle V — JSON output by default, `--text` for
  human-readable. All output structs must be typed TypeScript interfaces.

- **NFR-2:** Constitution Principle IV — no bash scripts. Package manager invocations
  (`npm`, `uv`, `pip`) use `child_process.spawnSync` from TypeScript, not shell strings.

- **NFR-3:** Idempotent — running `relic upgrade` when already at latest is always safe.
  The prompt refresh step is also idempotent (re-writing the same content is safe).

- **NFR-4:** Network errors (registry unreachable, timeout) produce a clear error message
  and non-zero exit code. The command never silently fails.

- **NFR-5:** `INSTALL_CHANNEL` must be embedded at build time — one value per distribution
  target. It must not be determined at runtime by heuristics such as inspecting
  `process.execPath`.

- **NFR-6:** `relic upgrade` is registered in the production binary (`bin.ts`) — it is a
  user-facing utility command, not a workflow stub.

- **NFR-7:** `relic upgrade` works from any directory with a `.relic/` folder (standard
  `findRelicDir` resolution). Engine hook refresh is relative to the project root.
  If run outside a Relic project, `--check` still works; `--prompts` errors gracefully.

---

## User Stories

- As a developer, I want to run `relic upgrade` and have both the binary and my slash
  commands updated atomically, so I'm never running new prompts with an old binary or
  vice versa.
- As a developer, I want `relic upgrade --check` to tell me if I'm behind without
  installing anything, so I can decide when to upgrade.
- As a developer, I want upgrade to never touch my shared brain, specs, or constitution,
  so I can upgrade confidently on a project mid-flight.
- As a team member, I want to run `relic upgrade --prompts` after a colleague updated
  hook files via `add-engine`, to sync my local copies without re-upgrading the binary.
- As a developer, I want a clear error message if my package manager isn't on PATH, so
  I know exactly what to run manually.

---

## Scope

### In Scope

- `relic upgrade` CLI command (production binary)
- `relic upgrade --check` — version check only
- `relic upgrade --prompts` — hook refresh only, no binary upgrade
- `relic upgrade --text` — human-readable output
- Install channel detection via build-time embedded `INSTALL_CHANNEL` constant
- Binary upgrade via npm / uv / pip (spawned as child process)
- Engine hook refresh (Claude, Copilot, Codex) reusing `@relic/engines` write logic
- `.relic/preamble.md` refresh on upgrade
- `packages/core/src/commands/upgrade.ts` — new command
- `packages/cli-node/src/bin.ts` and `bin.debug.ts` — register upgrade command
- `INSTALL_CHANNEL` embedding mechanism (one channel per distribution target)
- Tests in `packages/core/src/__tests__/upgrade.test.ts`

### Out of Scope

- Auto-upgrade on every `relic` invocation
- Downgrade / version pinning
- Changelog diff between versions ("what changed in this upgrade")
- Homebrew upgrade support (channel not yet implemented)
- Migration scripts for breaking schema changes
- Refreshing `.relic/constitution.md` (project-owned; user updates manually)
- Modifying `relic add-engine` itself — upgrade reuses its logic, not replaces it

---

## Shared Artifacts

**Owns:**
- `shared/domains/UpgradeDomain.md` — the upgrade lifecycle, install channel concept,
  protected file list, and engine hook refresh rules

**Reads:**
- `shared/domains/DistributionDomain.md` — install channels, package names, registry info
- `shared/domains/TemplateDomain.md` — which engine hook files exist and how they're written

---

## Open Questions

- **OQ-1 (INSTALL_CHANNEL mechanism):** Should `INSTALL_CHANNEL` be embedded via separate
  entry point files (`bin-npm.ts` / `bin-pypi.ts` each exporting the constant), via a
  `bun build --define` flag in the build script, or via a generated constant file at
  build time? Blocking for planning. The spec requires build-time embedding but defers
  the mechanism to `/relic.plan`.

- **OQ-2 (spawn vs Bun.spawn):** `child_process.spawnSync` is available in both the
  Node.js npm bundle and the Bun PyPI binary (Bun polyfills Node.js builtins). This is
  the recommended approach and is non-blocking — noting for the plan.

- **OQ-3 (version fetch):** Fetching from the npm registry requires an HTTP client.
  `fetch` is available globally in both Bun and Node.js 18+. No new dependency needed.
  Non-blocking.
