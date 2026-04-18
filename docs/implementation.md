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
- `.relic/templates/` — blank spec/plan/tasks templates for `scaffold-spec.sh`

All content is embedded at build time via `scripts/embed-templates.ts` into
`packages/core/src/generated/templates.ts`. The binary ships no loose files.

### Phase 2 — AI engine hooks (`relic add-engine`)

The `add-engine` command writes engine-specific instruction files based on which AI
agent the developer uses:

| Engine | Files written | How AI picks them up |
|---|---|---|
| `claude` | `.claude/commands/relic.*.md` (11 slash commands) | Claude Code `/relic.*` |
| `copilot` | `.github/prompts/relic.*.prompt.md` (11 files, YAML frontmatter) | Copilot Chat `/relic.*` |
| `codex` | `.codex/commands/relic.*.md` (11 slash commands) | Codex `/relic.*` |

**Design decision:** All three engines use the same per-command file pattern — one file per
slash command. Claude writes to `.claude/commands/`, Copilot to `.github/prompts/` (with YAML
frontmatter), and Codex to `.codex/commands/`. This was corrected post-0.4.0; the initial
implementation incorrectly used single consolidated files for Copilot and Codex.

`relic init` defaults to `--engine claude`. Multiple engines can be specified:
`relic init --engine claude,copilot`.

### Phase 3 — Native CLI commands for AI agents

> **Updated in Phase 8.** The original implementation shipped bash scripts
> (`check-context.sh`, `scaffold-spec.sh`, `validate-artifacts.sh`, `common.sh`) copied
> into `.relic/scripts/`. These have been replaced with native TypeScript CLI commands.
> See Phase 8 for the current approach.

~~Four bash scripts are copied to `.relic/scripts/` at init time.~~

The commands below now live in `packages/core/src/commands/` and are exposed via the
production binary. No bash, Python, jq, or sed dependency in user projects.

### Phase 4 — Production vs debug CLI split (updated in Phase 8)

A key architectural decision made during implementation: **workflow commands (`specify`, `plan`, `fix`, etc.) are AI-only — they should not appear in the user-facing binary**.

The user types `relic init`, `relic scan`, `relic use 001-auth`. They never type
`relic plan` — that's a prompt the AI agent invokes internally.

Result:

| Binary | Commands | Used by |
|---|---|---|
| `bin.ts` (production) | `init`, `add-engine`, `use`, `scan`, `context`, `scaffold`, `validate` | End users + AI agents |
| `bin.debug.ts` (debug) | All of the above + 5 workflow stubs | Development / testing |

The workflow command stubs (`specify`, `fix`, etc.) exist in the debug binary for
testing context assembly but are not exported to production.

### Phase 5 — Active spec tracking (`.relic/current-spec` → `session.json`)

**Problem:** Spec ID resolution previously relied on git branch naming (`001-auth-feature` → spec `001-auth`). Most developers don't create branches per spec, so resolution failed in the common case.

**Original solution:** A single-line file `.relic/current-spec`.

**Updated in Phase 11:** `.relic/current-spec` was replaced by `.relic/session.json` — a structured JSON file that holds all personal session state in one place.

Resolution order (TypeScript):
1. `--spec <id>` CLI arg
2. `RELIC_SPEC` env var
3. `.relic/session.json` (`session.spec` field) ← written by `relic use` and `relic scaffold`
4. Git branch inference
5. Error (lists available specs)

Three ways to set `session.spec`:
- `relic use 001-auth` — writes `session.spec`
- `/relic.use` — AI slash command (calls `relic scaffold --spec <id>`)
- `relic scaffold` — automatically on every spec creation or resolution

`session.json` is gitignored so different team members can work on different specs simultaneously.

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

### Phase 8 — Native CLI commands replacing bash scripts

**Problem:** The bash scripts in `.relic/scripts/` had real portability and reliability issues:
- Not portable to Windows or minimal CI environments
- Required Python 3 for JSON encoding (not always present)
- Template substitution via `sed` — past injection bugs with special characters in titles
- `shift` inside `for..in` loop was a no-op (arg parsing bug)
- Duplicated logic already in TypeScript (`findRelicDir`, `loadRegistry`, spec ID utilities)
- Added weight to `.relic/` that was hard to explain to new users

**Solution:** Migrate all three functional scripts to native TypeScript CLI commands in
`packages/core/src/commands/`, exposed in the production binary.

| Old call | New call |
|---|---|
| `bash .relic/scripts/check-context.sh [--spec id]` | `relic context [--spec id] [--text]` |
| `bash .relic/scripts/scaffold-spec.sh [--title t\|--spec id]` | `relic scaffold [--title t\|--spec id]` |
| `bash .relic/scripts/validate-artifacts.sh` | `relic validate [--text]` |

All three default to JSON output (`--text` for human-readable), matching the old script behaviour.

**`relic context`** — resolves the active spec via the 4-priority chain, then reports:
- Which core files exist (`preamble`, `constitution`, `spec`, `plan`, `tasks`, `artifacts_json`, `changelog`)
- All shared artifacts referenced in `artifacts.json`, with their existence status and role (`owns`/`reads`)
- Errors with a `relic scaffold --spec <id>` hint if the spec directory does not exist

**`relic scaffold`** — ensures the spec folder and its files exist:
- `--title "User Auth"` → generates next spec ID (e.g. `002-user-auth`), creates folder + files
- `--spec 001-auth` → resolves existing spec, creates only missing files
- Passing both `--title` and `--spec` is an error (mutually exclusive)
- Uses `TEMPLATES` (embedded at build time) for `spec.md`/`plan.md`/`tasks.md` — no `sed`, no injection risk
- Always writes `.relic/current-spec` on success

**`relic validate`** — checks artifact integrity across all specs:
- Ownership conflicts (two specs `own` the same artifact)
- Missing owned artifacts (path in `owns` doesn't exist on disk)
- Missing read artifacts (path in `reads` doesn't exist on disk)
- Illegal files in spec dirs (anything other than `spec.md`, `plan.md`, `tasks.md`, `artifacts.json`)
- Invalid paths (`owns`/`reads` entries that don't start with `shared/`)

**`relic init` after Phase 8:** No longer writes `.relic/scripts/` or `.relic/templates/`.
Projects that upgraded from an earlier version can safely delete those folders.

**All AI prompt templates and engine instruction files** updated to invoke `relic <command>` directly.

### Phase 10 — Monorepo restructure: `@relic/utility`, `@relic/engines`, permission configs

**Problems solved together:**

1. `fs.ts` and `spec-id.ts` lived in `packages/core/src/utils/` — the only package that
   needed them. When `@relic/engines` was introduced, those utilities would have been
   duplicated or required a circular dependency.
2. All engine write logic (`add-engine.ts`) lived in `@relic/core`, coupling the core
   package to concerns it shouldn't own.
3. Running any `relic *` command in an AI agent workflow triggered an interactive approval
   prompt — there was no committed, team-shared permission config.
4. Copilot and Codex each had a single giant template file under `templates/engines/` that
   duplicated all workflow documentation. Any prompt change required updating three files.

**Solution — dependency graph after this phase:**

```
@relic/utility   (no Relic deps — fs.ts, spec-id.ts)
      ↑
@relic/engines   (depends on @relic/utility only — all engine write logic)
      ↑
@relic/core      (depends on @relic/utility + @relic/engines)
      ↑
packages/cli-node / packages/cli-python   (unchanged)
```

**`@relic/utility`** — the dependency floor. Contains `fs.ts` and `spec-id.ts`, moved
verbatim from `packages/core/src/utils/`. Both `@relic/core` and `@relic/engines` import
from here. New utility functions go in new files in this package — no new package needed.

**`@relic/engines`** — owns all engine write logic. Each engine is an isolated directory
`packages/engines/src/engines/<name>/index.ts`. Adding a new engine requires only creating
that directory and adding the name to `SUPPORTED_ENGINES` — nothing else changes.

**Permission configs written by `relic add-engine`:**

| Engine | File | Mechanism |
|---|---|---|
| Claude | `.claude/settings.json` | `{ "permissions": { "allow": ["Bash(relic *)"] } }` — JSON merge, idempotent |
| Copilot | (none) | No permission mechanism exists for Copilot |
| Codex | `.codex/config.toml` | `prefix_rules = [{ pattern = ["relic"], decision = "allow" }]` — string idempotency check, no TOML parser |

Both permission files are committed (not local) so the whole team gets zero-prompt behaviour
after `git pull` — no manual setup per developer.

**Template flow after this phase:**

```
templates/prompts/  (11 files — sole source of truth for all prompt content)
        ↓  scripts/embed-engine-templates.ts
packages/engines/src/generated/engine-templates.ts  (ENGINE_TEMPLATES, gitignored)
        ↓  runtime, per-engine write function
.claude/commands/relic.*.md  |  .github/prompts/relic.*.prompt.md  |  .codex/commands/relic.*.md
```

`templates/engines/` was deleted. All three engines write one file per prompt command at
runtime from `ENGINE_TEMPLATES` — a change to any prompt in `templates/prompts/` propagates
to all three engines on the next `bun run build:engine-templates`.

`packages/core/src/generated/templates.ts` now contains only the 5 scaffold templates
(`preamble.md`, `constitution.md`, `spec.md`, `plan.md`, `tasks.md`).

### Phase 11 — Two-stage fix pipeline + `session.json` (spec 003)

**Problems solved:**

1. `/relic.fix` was a context-assembly stub that assumed the user already knew which spec
   owned the broken code.
2. Session state lived in two files (`.relic/current-spec` for spec, proposed `current-fix`
   for fix) — inconsistent and hard to extend.
3. There was no way to record a bug diagnosis for human review before applying it.

**Solution:**

**`session.json`** replaces `.relic/current-spec` as the single gitignored session state file:
```json
{ "spec": "001-auth", "fix": "2026-04-13-null-session-crash" }
```
All commands that previously read/wrote `current-spec` now use `readSession`/`writeSession`
from `@relic/utility`. Read-merge semantics prevent partial writes from clobbering unrelated fields.
`relic init` creates the file and the `.relic/fixes/` directory upfront.

**Two-stage fix pipeline:**

| Stage | Command | What it does |
|---|---|---|
| Diagnose | `/relic.fix <issue>` | Cross-spec ownership check; classifies root cause; writes `.relic/fixes/<fix-id>.md`; sets `session.fix` |
| Apply | `/relic.solve` | Reads fix doc; applies code changes; updates knowledge layer; writes changelog; clears `session.fix` |

**Ownership enforcement:** `/relic.fix` scans all `specs/*/artifacts.json` `touches_files`
entries using prefix matching. If no spec owns the affected code area, it stops and instructs
the user to run `/relic.specify`. Every fix attempt either succeeds (spec exists) or produces
a new spec — coverage grows monotonically.

**`relic use` flags added:**
- `relic use --fix <fix-id>` — writes `session.fix` (validates fix doc exists first)
- `relic use --clear-fix` — sets `session.fix` to null

**`relic context` output** gains a `current_fix` field and reports `active_spec_source: "session"`.

**New `@relic/utility` exports:** `SessionState`, `readSession`, `writeSession`.

### Phase 12 — Toon manifest format (spec 005)

**Problem:** `manifest.json` is verbose. An LLM scanning all manifests before loading any
artifact paid significant token overhead just to read entry metadata.

**Solution:** A new pipe-delimited line format called **toon** replaces JSON manifests.

**Toon format** (`shared/<subdir>/manifest.toon`):
```
# domains manifest
source | name | file | tags | tldr | score
knowledge | UserAuth | UserAuth.md | auth,session,token | Handles user auth and session tokens. | 0
```

Each entry is one line. Fields are pipe-delimited. The format is scannable without a JSON
parser, and token cost scales linearly with the number of entries rather than exponentially
with JSON nesting.

**`relic toon-migrate`** — one-time migration command:
- Converts all `shared/*/manifest.json` files to `manifest.toon`
- Rebuilds the spec and fix indexes (`.relic/specs/manifest.toon`, `.relic/fixes/manifest.toon`)
- Safe to run on an already-migrated project (idempotent)

**`relic search` / `relic deep-search`** output updated:
- Default output is now toon lines (Constitution amendment: toon is the enforced default
  for all list-returning LLM-facing commands)
- `--json` flag available for machine consumers

**`relic validate`** now prefers `manifest.toon`; warns and falls back when only `manifest.json`
is present (prints: *"run: relic toon-migrate"*).

**`@relic/utility`** gains `encodeToon`, `decodeToon`, and `ToonField` exports.

---

### Phase 13 — Structured write command (`relic write`) (spec 006)

**Problem:** AI agents writing to `.relic/changelog.md`, `manifest.toon` files, and fix/spec
indexes had to open files directly, parse existing content, and append correctly formatted
entries. This created divergence risk and made it easy to corrupt the toon line format.

**Solution:** A single structured write command that is the only blessed way to mutate
any Relic index or append to the changelog.

**`relic write <target> --payload <json>`** — write one entry to a specific target:

| Flag | Target file |
|---|---|
| `--changelog` | `.relic/changelog.md` |
| `--specs` | `.relic/specs/manifest.toon` |
| `--fixes` | `.relic/fixes/manifest.toon` |
| `--knowledge-domains` | `.relic/shared/domains/manifest.toon` |
| `--knowledge-contracts` | `.relic/shared/contracts/manifest.toon` |
| `--knowledge-rules` | `.relic/shared/rules/manifest.toon` |
| `--knowledge-assumptions` | `.relic/shared/assumptions/manifest.toon` |

Exactly one target flag must be provided. The `--payload` is a compact JSON string matching
the `WritePayload` schema. The command validates, formats, and appends the entry atomically.

All AI prompt templates updated: agents no longer open index files directly — they call
`relic write` for every mutation to a Relic-managed file.

---

### Phase 14 — Direct model invocation (spec 007)

**Problem:** Running Relic workflows required an IDE (Claude Code, Copilot, Codex). Developers
using local or remote Ollama models, headless CI pipelines, or non-supported IDEs had no way
to drive the full Relic workflow from the terminal.

**Solution:** Promote all workflow commands to first-class production CLI commands that call
any OpenAI-compatible API endpoint directly. The IDE slash commands remain intact — terminal
and IDE workflows are now symmetric.

**`models.json`** — gitignored config file at `.relic/models.json`:
```json
{
  "baseUrl": "http://localhost:11434",
  "model": "llama3",
  "apiKey": "",
  "maxHistoryMessages": 20,
  "recentFullMessages": 2,
  "timeoutMs": 300000
}
```
Env var overrides: `RELIC_MODEL_BASE_URL`, `RELIC_MODEL_MODEL`, `RELIC_MODEL_API_KEY`.

**New production binary commands** (all accept `--spec <id>`, `--no-stream`, `--reset-context`
where applicable):
- `relic specify / clarify / plan / analyse / tasks / implement / fix`
- `relic solve [--fix <id>]` — one-shot fix application (no history)
- `relic constitution` — regenerate `.relic/constitution.md`
- `relic scan` — default inverted to AI workflow; `--manifest` flag preserves old manifest output
- `relic model --reset-context [--spec <id>]` — clear per-spec conversation history

**`bin.debug.ts` deleted.** All commands now live in the single production `bin.ts`.

**Pipeline per command invocation:**
```
bin.ts handler
  → assemble spec context (buildContext + renderContext)
  → model-runner.ts
      → load + validate models.json (+ env overrides)
      → getPromptTemplate(commandName) from @relic/engines
      → load history.json for spec
      → apply structural compression to older entries
      → build messages: [system: template, ...history, user: context]
      → model-client.ts → POST /v1/chat/completions → stream stdout
      → append exchange to history.json
```

**Conversation history** — persisted per-spec at `.relic/specs/<spec-id>/history.json`
(gitignored via `specs/**/history.json`). Subsequent calls within a spec retain reasoning
continuity across `specify → clarify → plan → …`.

**History compression** — entries older than `recentFullMessages` (default: 2) are compressed
deterministically before each call:
- Heading lines (`#`) kept verbatim
- Bullet lines (`- `, `* `) kept verbatim
- Fenced code blocks dropped entirely
- Prose lines: only the first sentence retained

No model calls, no extra cost — compression is a pure synchronous function in
`packages/core/src/core/history-compressor.ts`.

**New core modules:**
- `packages/core/src/core/model-client.ts` — streaming POST client; no engine imports
- `packages/core/src/core/model-runner.ts` — pipeline orchestrator; owns `models.json` loading
- `packages/core/src/core/history-compressor.ts` — deterministic structural extract; pure function

**`@relic/engines`** gains `getPromptTemplate(name)` — surfaces `ENGINE_TEMPLATES` for the
model runner without creating a coupling from `model-client.ts` to the engines package.

**`@relic/utility`** `fetchWithTimeout` gains an optional `RequestInit` parameter, enabling
POST requests with headers and body for model calls.

**`relic init` fix:** was only writing `session.json` to `.relic/.gitignore`. Now writes all
three entries: `session.json`, `models.json`, `specs/**/history.json`.

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

What shipped initially: 9 commands. `constitution` was added as a proper slash command. `use` and `scan` were added.

**Updated in Phase 11:** `/relic.solve` added — now 11 commands total.

```
/relic.specify    /relic.clarify    /relic.plan       /relic.analyse
/relic.tasks      /relic.implement  /relic.fix        /relic.solve
/relic.use        /relic.scan       /relic.constitution
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

### Phase 9 — Manifest-based knowledge indexing (`relic search` + `relic deep-search`)

> **Updated in Phase 12.** The manifest format was migrated from JSON to toon in Phase 12.
> `relic search` and `relic deep-search` now read `manifest.toon` by default.
> The details below describe the original design; the current file format is toon.

**Problem:** When an LLM needs to find relevant shared artifacts it reads every file under
`.relic/shared/` — expensive in tokens, especially on cold starts where none of the brain
is in context yet.

**Solution:** Each `shared/<subdir>/` holds a `manifest.json` index. The LLM discovers
candidates programmatically before reading any full files, using a two-step cascade.

**Manifest schema** (`shared/<subdir>/manifest.json`):
```json
[
  {
    "name": "UserAuth",
    "file": "UserAuth.md",
    "tldr": "Handles user authentication, session tokens, and login flows.",
    "tags": ["auth", "session", "token", "login", "user"]
  }
]
```

**`relic search <keywords...>`** — targeted lookup:
- Loads all `manifest.json` files from the four known subdirs; skips missing ones silently
- Score per entry = number of distinct tags where any keyword is a case-insensitive substring
- Filters score === 0, sorts descending by score
- Returns `[]` on no match (not an error); errors if no keywords passed

**`relic deep-search`** — full index dump:
- Returns all entries across all manifests with `path`, `name`, `tldr`, `tags` — no score
- LLM is instructed to read only `tldr` fields and load full files selectively

**Discovery cascade in `specify` and `plan` prompts:**
1. Extract up to 10 keywords from the user's input or active spec
2. Run `relic search <keywords>` — read full files for high-score hits
3. If results are insufficient, fall back to `relic deep-search` — read `tldr` only, load selectively

**`relic validate` extended** with two new checks:
- `missing_manifests` — subdir has `.md` files but no `manifest.json`
- `unregistered_files` — `.md` file not listed in its manifest

**`preamble.md`** updated with a `## Manifest Registration` section that makes manifest
maintenance a hard invariant alongside the existing artifact placement rules.

**`/relic.scan`** gets a new Step 8 to register every produced artifact in its manifest
before the changelog step.

---

## Implementation Gaps / Known Limitations

- **Workflow commands are thin orchestrators** — `clarify.ts`, `plan.ts`, etc. assemble context
  and call the model. They do not duplicate or replace the business logic in the prompt templates.
  Per Constitution Principle II, the authoritative reasoning lives in `templates/prompts/`.

- **`scan` confidence calibration** — the `Confidence: medium` default for all inferred artifacts
  is a safe starting point but could be smarter. Entry points with explicit type exports probably
  warrant `high` confidence.

- **Ownership transfer flow** — still unresolved (from original open questions). When two specs
  want to own the same artifact, there is no formal transfer mechanism yet.

- **`model-client.ts` is not unit-tested** — streaming SSE requires a live server; covered
  by manual smoke test against a real Ollama or OpenAI-compatible endpoint.

- **PyPI package** — implemented. See `docs/distribution.md`. Homebrew formula not yet written.

---

## Build Commands Reference

```bash
# Embed engine prompt templates into engines/generated/engine-templates.ts
bun run build:engine-templates

# Embed scaffold templates into core/generated/templates.ts
# (also runs build:engine-templates first — required before any other build step)
bun run build:templates

# Build cross-platform npm bundle (what gets published)
bun run build:npm

# Build Bun native binary for local testing
bun run build:binary

# Run production CLI from source (no build step)
bun run dev <command>

# Run all tests
bun run test

# Type check
bun run typecheck
```

Note: `dev:debug` was removed in Phase 14 — there is no longer a separate debug binary.
All commands are in the production `bin.ts`.

---

*Document created: April 10, 2026.*
*Updated: April 13, 2026 — Phase 10: @relic/utility, @relic/engines, permission configs.*
*Updated: April 13, 2026 — Phase 11: session.json, two-stage fix pipeline, /relic.solve.*
*Updated: April 18, 2026 — Phase 12: toon manifest format. Phase 13: relic write. Phase 14: direct model invocation.*
*Covers: Phase 1–14.*
