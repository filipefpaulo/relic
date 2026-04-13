# UpgradeDomain

**Type:** domain
**Owned by:** 004-cli-self-upgrade
**Confidence:** high

## Description

The self-upgrade lifecycle for the Relic CLI. Covers install channel detection, version
checking, binary upgrade, and engine hook refresh — including the invariant that project
knowledge is never modified during an upgrade.

## Key Entities

- **`INSTALL_CHANNEL`** — build-time constant embedded in each distribution target.
  Values: `"npm"` | `"pypi"` | `"dev"` (local builds). Determines which package manager
  to invoke during upgrade.

- **Binary upgrade** — invokes the appropriate package manager as a child process:
  - `npm`: `npm install -g relic-cli@<latest>`
  - `pypi`: `uv tool upgrade relic-cli` (fallback: `pip install --upgrade relic-cli`)

- **Engine hook refresh** — re-writes AI agent hook files using the new binary's embedded
  templates. Engines are read from `.relic/engines.json` (see below). Reuses `@relic/engines`
  write logic exactly as `relic add-engine` does.

- **`.relic/engines.json`** — a committed JSON array recording which engines were
  registered via `relic init --engine` or `relic add-engine`. Written/updated by both
  commands. Schema: `["claude", "copilot", "codex"]` (array of engine name strings,
  no duplicates). Must not be confused with personal session state — it is committed
  so the whole team knows which engines are configured.
  Example: `["claude", "copilot"]`
  Absent in projects predating this spec — upgrade warns and skips hook refresh.

- **Version check** — fetches `https://registry.npmjs.org/relic-cli/latest` for the
  latest version. Both npm and PyPI use this endpoint (same version tag).

## Protected Files (MUST NOT be modified by upgrade)

The following are immutable from the upgrade command's perspective:

| Path | Reason |
|---|---|
| `.relic/shared/` | The brain — owned by project, not by Relic |
| `.relic/specs/` | Spec documents — project work, not Relic infrastructure |
| `.relic/fixes/` | Fix audit trail — project work |
| `.relic/changelog.md` | Append-only project audit trail |
| `.relic/constitution.md` | Project governance — user-authored |
| `.relic/session.json` | Personal session state — gitignored |

## Refreshable Files (safe to overwrite)

| Path | Reason |
|---|---|
| `.relic/preamble.md` | Relic-owned architectural invariants; may change between versions |
| `.claude/commands/relic.*.md` | Engine hooks — versioned with the binary |
| `.github/copilot-instructions.md` | Engine hooks — versioned with the binary |
| `.codex/instructions.md` | Engine hooks — versioned with the binary |
| `.claude/settings.json` | Permission config — idempotent merge, never destructive |
| `.codex/config.toml` | Permission config — idempotent merge (string check), never destructive |

## Engine Registry

`.relic/engines.json` is the source of truth for which engines are active in a project.

| Rule | Detail |
|---|---|
| Written by | `relic init --engine <name>` and `relic add-engine <name>` |
| Format | JSON array of strings: `["claude", "copilot"]` |
| Committed | Yes — team-shared state, not gitignored |
| Idempotent | Adding the same engine twice must not produce duplicates |
| Missing | Upgrade warns and skips hook refresh; `--check` and binary upgrade unaffected |

## Upgrade Flags

| Flag | Behaviour |
|---|---|
| _(none)_ | Check version; upgrade binary if behind; refresh engine hooks + preamble |
| `--check` | Check version only; report whether update is available; no writes |
| `--prompts` | Refresh engine hooks + preamble only; no binary upgrade or version check |
| `--text` | Human-readable output instead of JSON |
