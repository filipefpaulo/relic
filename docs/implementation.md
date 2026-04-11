# Relic — Implementation Notes

> This document records what was built after the ideation phase captured in `context.md`.
> It covers decisions made during implementation, things that changed from the original design,
> and new capabilities added. Read `context.md` for the design rationale; read this for what
> was actually shipped.

---

## What Was Built

### Phase 1 — Core scaffold (`relic init`)

The `init` command scaffolds the full `.relic/` structure into a user's project:

- `.relic/preamble.md` — Relic architectural invariants (never edited by the user)
- `.relic/constitution.md` — project-specific governance
- `.relic/changelog.md` — append-only audit trail
- `.relic/.gitignore` — ignores `current-spec` (session-local state)
- `.relic/shared/{domains,contracts,rules,assumptions}/` — the shared brain
- `.relic/specs/` — per-spec intent documents
- `.relic/scripts/` — bash utilities for AI agents
- `.relic/prompts/` — copies of AI slash command prompts (for reference)
- `.relic/templates/` — blank spec/plan/tasks templates for `scaffold-spec.sh`

All content is embedded at build time via `scripts/embed-templates.ts` into
`packages/core/src/generated/templates.ts`. The binary ships no loose files.

### Phase 2 — AI engine hooks (`relic add-engine`)

The `add-engine` command writes engine-specific instruction files based on which AI
agent the developer uses:

| Engine | Files written | How AI picks them up |
|---|---|---|
| `claude` | `.claude/commands/relic.*.md` (9 slash commands) | Claude Code `/relic.*` |
| `copilot` | `.github/copilot-instructions.md` | GitHub Copilot workspace context |
| `codex` | `.codex/instructions.md` | OpenAI Codex agent context |

**Design decision:** The Copilot and Codex files are single consolidated documents
(one file, all workflow commands), while Claude gets individual per-command files
(one file per slash command). This matches each engine's convention.

`relic init` defaults to `--engine claude`. Multiple engines can be specified:
`relic init --engine claude,copilot`.

### Phase 3 — Bash utilities for AI agents

Four bash scripts are copied to `.relic/scripts/` at init time:

**`common.sh`** — shared utilities sourced by all other scripts:
- `find_relic_dir()` — walks up the directory tree to find `.relic/`
- `resolve_spec_id()` — implements the 4-priority resolution chain
- `json_escape()` — safe JSON string encoding without jq dependency
- `has_jq()` — feature detection for pretty JSON output

**`check-context.sh`** — the AI agent's primary entry point before any command:
```bash
bash .relic/scripts/check-context.sh [--spec <id>] [--json|--text]
```
Outputs a JSON object with the resolved spec, which files exist, and which shared
artifacts are referenced with their existence status. The `active_spec_source` field
tells the agent how the spec was resolved (`"arg"` | `"env"` | `"current-spec"` | `"git-branch"`).

**`scaffold-spec.sh`** — ensures a spec folder exists before the AI acts on it:
```bash
bash .relic/scripts/scaffold-spec.sh --title "User Authentication"   # new spec
bash .relic/scripts/scaffold-spec.sh --spec 001-auth                 # existing spec
```
Creates `spec.md`, `plan.md`, `tasks.md`, and `artifacts.json` from templates if missing.
Always writes `.relic/current-spec` after resolution so subsequent commands know the
active spec. Returns JSON with `spec_id`, `was_new`, `files_created`, `title`.

**`validate-artifacts.sh`** — integrity check (used by plan/clarify/analyse):
Verifies every path in every `artifacts.json` exists in `shared/`. Reports
ownership conflicts (two specs claiming the same artifact).

### Phase 4 — Production vs debug CLI split

A key architectural decision made during implementation: **workflow commands (`specify`, `plan`, `fix`, etc.) are AI-only — they should not appear in the user-facing binary**.

The user types `relic init`, `relic scan`, `relic use 001-auth`. They never type
`relic plan` — that's a prompt the AI agent invokes internally.

Result:

| Binary | Commands | Used by |
|---|---|---|
| `bin.ts` (production) | `init`, `add-engine`, `use`, `scan` | End users |
| `bin.debug.ts` (debug) | All of the above + 5 workflow stubs | Development / testing |

The workflow command stubs (`specify`, `fix`, etc.) exist in the debug binary for
testing context assembly but are not exported to production.

### Phase 5 — Active spec tracking (`.relic/current-spec`)

**Problem:** Spec ID resolution previously relied on git branch naming (`001-auth-feature` → spec `001-auth`). Most developers don't create branches per spec, so resolution failed in the common case.

**Solution:** A single-line file `.relic/current-spec` that persists the active spec across
commands and sessions.

Resolution order (implemented in both TypeScript and bash):
1. `--spec <id>` CLI arg
2. `RELIC_SPEC` env var
3. `.relic/current-spec` ← **new**
4. Git branch inference
5. Error (lists available specs)

Three ways to set `current-spec`:
- `relic use 001-auth` — TypeScript CLI command
- `/relic.use` — AI slash command (calls `scaffold-spec.sh --spec <id>`)
- `scaffold-spec.sh` — automatically on every spec creation or resolution

The file is gitignored so different team members can work on different specs simultaneously.
Remote AI sessions (with no terminal access) can switch specs via `/relic.use` without
needing shell access.

### Phase 6 — npm publishing (cross-platform Node.js bundle)

**Original design:** Ship a platform-specific Bun binary (`bun build --compile`).

**Problem:** The Bun binary is an ARM64 Mach-O executable (~61 MB). It cannot be installed
via `npm install -g relic-cli` on Linux or Windows.

**Solution:** Use `bun build --target node` to produce a cross-platform Node.js bundle.

```bash
bun run build:npm
# → packages/cli-node/dist/relic.js (175 KB, pure JS, no Bun runtime required)
```

The npm bin entrypoint (`bin/relic.js`) is a 2-line shim:
```javascript
#!/usr/bin/env node
import "../dist/relic.js";
```

When published, `npm pack` includes only 3 files: `bin/relic.js`, `dist/relic.js`, `package.json`.
The Bun-compiled binary (`dist/relic`) remains available for local development but is excluded
from the published package via the `files` field.

The `relic-cli` npm package has `"engines": { "node": ">=18" }` and no runtime dependencies —
everything (including `@relic/core` and `commander`) is bundled inline.

### Phase 7 — `relic scan` (bootstrap from existing codebase)

**Problem:** Relic is designed around a shared artifact brain, but the brain starts empty.
For greenfield projects this is fine. For existing codebases, every spec starts cold — the
LLM has no domains, contracts, or rules to check against.

**Solution:** A `scan` command that reads the project once and populates `.relic/shared/`.

**CLI side (`relic scan --json`)** — generates a project manifest:
- Tech stack detection (marker files: `package.json`, `tsconfig.json`, `go.mod`, `Cargo.toml`, etc.)
- Key file detection by role (entry_point, types, routes, schema, config, middleware, migrations)
- File tree (depth 4, excludes node_modules/dist/build, truncated at 200 entries)
- List of existing shared artifacts

**AI prompt side (`/relic.scan`)** — 8-step workflow:
1. Run `relic scan --json` to get the manifest
2. Read entry points and type files (reveal domain language fastest)
3. Read route/service/middleware files (reveal API surface)
4. Sample business logic files (reveal rules and assumptions)
5–7. Write artifacts to `.relic/shared/{domains,contracts,rules,assumptions}/`
8. Write changelog entry

Each artifact carries `Inferred from`, `Confidence` (high/medium/low), and `Owned by: (unowned)`
fields. Specs claim ownership when they're created — the scan just establishes the vocabulary.

---

## What Changed from the Original Design

### Template embedding (not in original design)

`docs/context.md` assumed templates would be loose files installed alongside the binary.
In practice, all templates are embedded at build time into a generated TypeScript file.
This makes the binary self-contained — no install step, no path resolution issues.

### Preamble vs Constitution

The original design had a single `constitution.md`. During implementation, a distinction emerged:

- **`preamble.md`** — Relic's own architectural rules (never touch a spec folder for artifacts,
  `artifacts.json` is a pointer file, etc.). Copied verbatim from `templates/preamble.md`.
  Users should never edit this.
- **`constitution.md`** — project-specific governance (code style, team decisions, etc.).
  Users are expected to customise this.

This split makes it clear which rules come from Relic and which come from the team.

### Slash command count increased

Original design: 8 slash commands (specify, clarify, plan, analyse, tasks, implement, fix, constitution).

What shipped: 9 commands. `constitution` was not implemented as a slash command (it's a file, not a workflow). `use` and `scan` were added.

```
/relic.specify    /relic.clarify    /relic.plan       /relic.analyse
/relic.tasks      /relic.implement  /relic.fix        /relic.use
/relic.scan
```

### npm distribution (changed from Bun binary)

Original design: ship the Bun-compiled binary via npm.

What shipped: a Node.js bundle produced by `bun build --target node`. Same source code,
cross-platform, 175 KB instead of 61 MB.

The Bun binary is still used for local development (`bun run dev`, `bun run build:binary`)
but is not what gets published to npm.

### PyPI distribution

See `docs/distribution.md` for the full implementation. Platform-specific wheels with
pre-compiled Bun binaries — no Node.js required. Published via `pypa/gh-action-pypi-publish`
with OIDC trusted publisher.

---

## Implementation Gaps / Known Limitations

- **`fix.ts`, `plan.ts`, `specify.ts` etc.** are stub commands in the debug binary.
  They print context or a placeholder message. The actual workflow lives in the AI prompts.
  Full TypeScript implementations are not planned — the AI prompt approach is the intended design.

- **`scan` confidence calibration** — the `Confidence: medium` default for all inferred artifacts
  is a safe starting point but could be smarter. Entry points with explicit type exports probably
  warrant `high` confidence.

- **Ownership transfer flow** — still unresolved (from original open questions). When two specs
  want to own the same artifact, there is no formal transfer mechanism yet.

- **PyPI package** — now implemented. See `docs/distribution.md`. Homebrew formula not yet written.

---

## Build Commands Reference

```bash
# Embed templates into generated/templates.ts
bun run build:templates

# Build cross-platform npm bundle (what gets published)
bun run build:npm

# Build Bun native binary for local testing
bun run build:binary

# Run production CLI from source (no build step)
bun run dev <command>

# Run debug CLI from source (all commands)
bun run dev:debug <command>

# Type check
bun run typecheck
```

---

*Document created: April 10, 2026.*
*Covers: Phase 1–7 of initial MVP implementation.*
