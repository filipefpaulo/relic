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

- **FR-1:** `relic upgrade --check` checks the appropriate registry for the latest
  published version of `relic-cli` (endpoint is channel-specific — see FR-12), compares
  it against the running binary's version, and reports whether an update is available.
  It does not install anything. Output is JSON by default
  (`{ "current": "0.5.1", "latest": "0.6.0", "update_available": true, "channel": "npm" }`);
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

- **FR-6:** When `INSTALL_CHANNEL` is `"pypi"`, try `uv tool upgrade relic-cli` first.
  If `uv` exits with a non-zero code (not on `PATH`, or the package is not in uv's tool
  registry because it was installed via pip), fall back to `pip install --upgrade
  relic-cli`. If neither succeeds, error with instructions. This try-first-then-fallback
  approach handles all PyPI installation scenarios correctly without requiring separate
  build-time flags for uv vs pip — the same PyPI wheel is installed by either tool, and
  the runtime fallback correctly identifies which manager owns the installation.

**Engine registry:**

- **FR-7:** Engine detection uses `.relic/engines.json` — a committed JSON file that
  records which engines were registered via `relic init --engine` or `relic add-engine`.
  The upgrade command reads this file to know which engines to refresh. It does NOT rely
  on the presence of `.github/copilot-instructions.md`, `.codex/instructions.md`, or any
  other file outside `.relic/` — those files may exist for non-Relic reasons.

- **FR-13:** `relic init --engine <name>` and `relic add-engine <name>` must write or
  update `.relic/engines.json` after successfully writing engine hook files. Schema:
  a JSON array of engine name strings (e.g. `["claude", "copilot"]`). Adding the same
  engine twice must be idempotent (no duplicates). The file is committed — it is
  team-shared state, not personal session state.

- **FR-14:** If `.relic/engines.json` is absent (existing projects that predate this
  spec), `relic upgrade --prompts` and the hook-refresh step of `relic upgrade` must
  warn the user and skip the refresh:
  ```
  Warning: .relic/engines.json not found. Run `relic add-engine <engine>` to
  register your engines, then re-run upgrade.
  ```
  `relic upgrade --check` and the binary upgrade step are unaffected by this absence.

**Engine hook refresh:**

- **FR-8:** For each engine listed in `.relic/engines.json`, re-run the engine write
  function (same logic as `relic add-engine`) to overwrite the hook files with the
  versions embedded in the new binary. Permission config files (`.claude/settings.json`,
  `.codex/config.toml`) are written with the same idempotent merge logic as `add-engine`
  — never overwritten destructively.

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

- **FR-12:** Version check endpoints are channel-specific, because npm and PyPI can be
  published independently and may be at different versions:
  - `"npm"` channel: `GET https://registry.npmjs.org/relic-cli/latest` → response field `version`
  - `"pypi"` channel: `GET https://pypi.org/pypi/relic-cli/json` → response field `info.version`
  Using the wrong registry for a channel risks reporting a false "up to date" or triggering
  an upgrade to a version not yet available on the user's channel.

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
- `.relic/engines.json` — new committed registry file written by `init` and `add-engine`
- `packages/core/src/commands/upgrade.ts` — new command
- `packages/core/src/commands/init.ts` — write `engines.json` on engine init
- `packages/core/src/commands/add-engine.ts` — write/update `engines.json` on add
- `packages/cli-node/src/bin.ts` and `bin.debug.ts` — register upgrade command
- `INSTALL_CHANNEL` embedded via `bun build --define` in per-channel build scripts
- `packages/cli-node/package.json` — add `--define INSTALL_CHANNEL='"npm"'` to `build:npm`
- `.github/workflows/publish-pypi.yml` — add `--define INSTALL_CHANNEL='"pypi"'` to bun build step
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

## Decisions

- **INSTALL_CHANNEL embedding via `bun build --define`:** The `--define` flag injects a
  compile-time constant without requiring separate entry point files or a code-generation
  step. `packages/cli-node/package.json` adds `--define INSTALL_CHANNEL='"npm"'` to its
  `build:npm` script; `.github/workflows/publish-pypi.yml` adds
  `--define INSTALL_CHANNEL='"pypi"'` to the `bun build --compile` step. Local dev builds
  do not set the flag — `upgrade.ts` treats a missing or `"dev"` value as FR-4 (warn +
  manual instructions).

- **No separate `pypi-uv` / `pypi-pip` channels:** The same PyPI wheel is installed by
  either `uv` or `pip` — it is impossible to know at build time which tool the user will
  use. At runtime, `uv tool upgrade relic-cli` is tried first; uv exits non-zero when it
  did not install the package (pip-managed installation), causing the fallback to
  `pip install --upgrade relic-cli`. This correctly handles all PyPI scenarios without
  additional build-time complexity.

- **Per-channel version registries:** npm and PyPI are published independently and can be
  at different versions. Using the wrong registry endpoint risks a false "up to date"
  report or an upgrade attempt to a version not yet available on the user's channel.
  Each channel queries its own authoritative registry (FR-12).

## Open Questions

- **OQ-2 (spawn):** `child_process.spawnSync` works in both the Node.js npm bundle and
  the Bun PyPI binary (Bun polyfills Node.js builtins). Non-blocking — noting for plan.

- **OQ-3 (fetch):** Two HTTP GETs are needed (channel-specific registry endpoint). `fetch`
  is available globally in Bun and Node.js 18+. No new dependency. Non-blocking.

- **OQ-4 (init.ts/add-engine.ts intersections):** `init.ts` was last touched by spec 003;
  `add-engine.ts` by spec 002. Both released — no live conflict. Plan must confirm no
  concurrent spec modifies those files.
