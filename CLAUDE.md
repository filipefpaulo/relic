# Relic — Claude Code Project Context

> Read this file before every session. It contains the full architectural context, key decisions, and project philosophy for the Relic project.

---

## What We're Building

**Relic** is a spec-driven development tool that extends the concept of tools like GitHub's spec-kit with a **shared artifact layer** — a "brain" that connects all specs in a project, enabling cross-spec awareness, intersection detection, and a traceable change history.

The core insight: existing SDD tools (spec-kit, Kiro, OpenSpec) treat specs as isolated silos. Relic treats **shared artifacts** as the atomic unit, with specs as consumers of those artifacts. This makes intersections between features explicit and detectable.

The second core insight: **specs should not die after implementation**. The `fix` command keeps the spec alive as the lens through which bugs are understood and resolved — using the original intent, contracts, and decisions as constraints on every fix. This closes the loop between the knowledge layer and the living codebase.

The third core insight: **most developers adopt Relic on existing codebases**. The `scan` command bootstraps the shared artifact layer from existing code in one pass — expensive upfront, but makes every subsequent spec dramatically cheaper.

---

## The Problems Being Solved

**Problem 1 — Specs don't talk to each other:**
When using spec-kit (or similar tools) on a project with multiple specs:
- Spec A and Spec B may both touch the same file, domain, or contract
- Neither spec knows about the other
- The LLM has no cross-spec context, so it breaks the first spec when implementing the second
- There is no shared "brain" — no domains, contracts, or rules that live independently of any single feature

**Problem 2 — Specs die after implementation:**
In every existing SDD tool, the spec becomes dead documentation the moment `implement` finishes. When a bug appears in production, the LLM only sees the error and the code — not the original intent, the contracts the code was supposed to honour, or the decisions that led to the architecture. The spec's knowledge is completely abandoned at the moment it is most needed.

**Problem 3 — Cold start on existing codebases:**
Most developers don't start greenfield. Without a pre-populated shared brain, the first spec has no domains or contracts to reference — the LLM must infer everything from scratch on every command.

---

## Lifecycle Commands

| Command | Purpose | Notes |
|---|---|---|
| `scan` | Bootstrap shared artifacts from existing codebase | Run **once** on adoption; populates `.relic/shared/` |
| `specify` | Create a new spec from a PRD or User Story | No intersection check needed at this stage |
| `clarify` | Append details, change contracts, add behaviors | **Must check for intersections** |
| `plan` | Create implementation plan | **Principal intersection discovery point**; writes changelog |
| `analyse` | Non-destructive consistency check | Read-only; checks spec coherence and artifact freshness |
| `tasks` | Generate tasks from the current plan | **Must check for task overlap between specs** |
| `implement` | Build the plan | Executes tasks |
| `fix` | Debug and fix issues using the spec as context | **Keeps the spec alive post-implementation**; may trigger `clarify` if contracts change |
| `use` | Set the active spec for the session | Writes `.relic/current-spec`; enables session switching in AI agents |

### The Three Lifecycles

**Bootstrap lifecycle** (adopting Relic on existing code):
```
relic init → /relic.scan → [shared brain populated] → /relic.specify
```

**Forward lifecycle** (greenfield / feature development):
```
specify → clarify → plan → analyse → tasks → implement
```

**Feedback lifecycle** (post-implementation, keeps knowledge layer alive):
```
implement → [bug appears] → fix → [contract changed?] → clarify → plan (update) → changelog
```

---

## The `fix` Command — Closing the Loop

### How it works

The user invokes `fix` with a spec reference and an error/issue description:

```bash
# Infer spec from .relic/current-spec (or git branch)
relic fix

# Explicit spec reference
relic fix --spec 001-auth

# Override via env (useful when on main or a hotfix branch)
RELIC_SPEC=001-auth relic fix
```

Or from inside the AI agent:
```
/relic.fix TypeError: Cannot read property 'session' of undefined at auth.middleware.ts:42
```

### Context assembled by `fix`

Before the LLM sees the error, the system builds full context from:

| Source | Purpose |
|---|---|
| `constitution.md` | Always loaded — governs what the fix may and may not do |
| `specs/001-auth/spec.md` | Original intent — what this code was supposed to do |
| `specs/001-auth/plan.md` | Architecture decisions — why it was built this way |
| `specs/001-auth/artifacts.json` | Which contracts and domains are relevant |
| All referenced `shared/` artifacts | The contracts the fix must respect |
| `changelog.md` (filtered to this spec) | Why things are the way they are |

### The fix decision tree

```
bug appears
    ↓
/relic.fix
    ↓
LLM fixes the bug constrained by spec context
    ↓
Did the fix change a contract or domain?
    ↙                        ↘
  No                         Yes
   ↓                          ↓
write brief entry         trigger /relic.clarify
to changelog.md           update shared artifact
("Fixed X, no contract    write to changelog
 changes required")       flag all specs that read
                          the changed artifact
```

### Spec resolution order

`fix` (and all commands that need a spec) resolve the spec ID in this order:

| Priority | Source | Who sets it |
|---|---|---|
| 1 | `--spec <id>` CLI arg | caller explicitly |
| 2 | `RELIC_SPEC` env var | CI / power user |
| 3 | `.relic/current-spec` file | `relic use` or `/relic.use` or `relic scaffold` |
| 4 | Git branch inference | branch named `NNN-slug` |
| 5 | Error | lists available specs |

---

## The `scan` Command — Bootstrapping the Brain

```bash
relic scan          # human-readable output
relic scan --json   # JSON manifest for AI consumption
```

The CLI walks the project and outputs a structured manifest:
- **Tech stack** — detected from marker files (package.json → node, tsconfig.json → typescript, go.mod → go, etc.)
- **Key files** — entry points, type files, route dirs, schemas, config files, etc.
- **File tree** — depth 4, excludes node_modules/dist/build, truncated at 200 entries
- **Existing artifacts** — what's already in `.relic/shared/`

The AI prompt `/relic.scan` uses this manifest to read files selectively and write artifacts to `.relic/shared/{domains,contracts,rules,assumptions}/`. Each artifact gets an `Inferred from` source and `Confidence` field (high/medium/low) — prompting human review before a spec claims ownership.

---

## Active Spec Tracking — `.relic/current-spec`

A single-line file at `.relic/current-spec` tracks which spec is active for the session.

- Written by `relic use <spec-id>`, `/relic.use`, and `scaffold-spec.sh`
- Read by all TypeScript commands and bash scripts as priority 3 in the resolution chain
- Gitignored (via `.relic/.gitignore`) — each team member can work on a different spec
- Enables remote session spec switching without terminal access

---

## The Two-Layer Architecture

### Layer 1 — Intent Layer (Specs)
Each spec describes what a feature should do. Lives in `.relic/specs/<id>/`.

### Layer 2 — Knowledge Layer (Shared Artifacts)
The brain. Domains, contracts, rules, and assumptions that exist independently of any single spec. Lives in `.relic/shared/`.

**Specs do not depend on each other directly — they both depend on shared artifacts.** This avoids circular dependencies and makes intersection points explicit.

---

## Project Folder Structure (scaffolded into user's project)

```
.relic/
  preamble.md               ← Relic architectural invariants — NEVER edit this file
  constitution.md           ← Project-specific governance. Always loaded.
  changelog.md              ← Append-only audit trail. Every plan writes here.
  .gitignore                ← Ignores current-spec (session-local state)
  current-spec              ← Active spec ID (gitignored, written by relic use)
  shared/                   ← THE BRAIN — shared across all specs
    domains/                ← Bounded contexts, entity definitions (e.g. UserAuth.md)
      manifest.json         ← Index of all domain artifacts (name, file, tldr, tags)
    contracts/              ← API shapes, event schemas (e.g. AuthAPI.md)
      manifest.json         ← Index of all contract artifacts
    rules/                  ← Cross-cutting business rules (e.g. SessionRules.md)
      manifest.json         ← Index of all rule artifacts
    assumptions/            ← Things true today but flagged as potentially stale
      manifest.json         ← Index of all assumption artifacts
  specs/
    001-auth/
      spec.md
      plan.md
      tasks.md
      artifacts.json        ← Declares which shared/ files this spec owns and reads
    002-payments/
      spec.md
      plan.md
      tasks.md
      artifacts.json
```

---

## The Key File: `artifacts.json`

Every spec must declare its relationship to shared artifacts. This is what enables intersection detection.

```json
{
  "owns": ["shared/domains/UserAuth.md", "shared/contracts/AuthAPI.md"],
  "reads": ["shared/rules/SessionRules.md"],
  "touches_files": ["src/auth/", "src/middleware/auth.ts"]
}
```

**Intersection rules:**
- Two specs cannot both `own` the same artifact (ownership conflict)
- Two specs `touching_files` that overlap triggers a warning at `plan` time
- `reads` is unrestricted — any spec can read any shared artifact

---

## Artifact Types

| Type | Description | Example |
|---|---|---|
| `domain` | Bounded context, entity definitions, ubiquitous language | `UserAuth.md`, `Payment.md` |
| `contract` | API shape, event schema, data interface | `AuthAPI.md`, `OrderCreatedEvent.md` |
| `rule` | Cross-cutting business logic | `SessionRules.md`, `PricingRules.md` |
| `assumption` | Facts that are true today but may change | `ThirdPartyLimits.md` |

---

## Monorepo Structure (the package itself)

```
packages/
  utility/                  ← Shared utility package (@relic/utility) — dependency floor
    src/
      fs.ts                 ← File I/O utilities (moved from core/src/utils/)
      spec-id.ts            ← Spec ID generation and inference (moved from core/src/utils/)
      index.ts              ← Re-exports fs + spec-id
  engines/                  ← Engine write logic (@relic/engines) — depends on @relic/utility
    src/
      engines/
        claude/index.ts     ← Write .claude/commands/ + .claude/settings.json
        copilot/index.ts    ← Write .github/copilot-instructions.md (runtime composition)
        codex/index.ts      ← Write .codex/instructions.md + .codex/config.toml
      generated/
        engine-templates.ts ← ENGINE_TEMPLATES map embedded at build time (gitignored)
      index.ts              ← runAddEngine, SUPPORTED_ENGINES, Engine type
  core/                     ← TypeScript, all business logic (@relic/core)
    src/
      commands/
        init.ts             ← Scaffold .relic/ into user's project
        use.ts              ← Write .relic/current-spec
        scan.ts             ← Walk project and output manifest JSON
        specify.ts          ← Create new spec folder
        fix.ts              ← Assemble spec context for bug fixing
        clarify.ts
        plan.ts
        analyse.ts
        tasks.ts
        implement.ts
      core/
        artifact-registry.ts
        intersection.ts
        changelog.ts
        context-builder.ts  ← Assembles and renders spec context for LLM
      generated/
        templates.ts        ← 5 scaffold templates embedded at build time (gitignored)
  cli-node/                 ← npm package (relic-cli)
    src/
      bin.ts                ← Production binary: init, add-engine, use, scan
      bin.debug.ts          ← Debug binary: all 9 workflow commands
    bin/
      relic.js              ← npm bin entrypoint — imports dist/relic.js
    dist/
      relic.js              ← Node.js bundle (gitignored, produced by build:npm)
templates/
  preamble.md               ← Architectural invariants copied verbatim to .relic/
  constitution.md
  spec.md
  plan.md
  tasks.md
  prompts/                  ← AI slash command prompt files (10 commands) — sole source of truth
    specify.md
    clarify.md
    plan.md
    analyse.md
    tasks.md
    implement.md
    fix.md
    use.md
    scan.md
    constitution.md
scripts/
  embed-templates.ts        ← Bakes 5 scaffold templates into core/generated/templates.ts
  embed-engine-templates.ts ← Bakes prompts/ into engines/generated/engine-templates.ts
  fix-shebang.mjs           ← Post-build: replaces Bun shebang with #!/usr/bin/env node
  publish.ts                ← Unified publish script (bumps versions, tags, pushes)
.github/
  workflows/
    publish-npm.yml         ← CI: builds Node.js bundle, publishes to npm on v* tags
    publish-pypi.yml        ← CI: builds platform binaries, signs (macOS), publishes to PyPI on v* tags
docs/
  context.md                ← Ideation history and design rationale
  implementation.md         ← What was built in the initial MVP session
  distribution.md           ← How npm + PyPI publishing works (added post-MVP)
```

---

## Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Thin code layer, npm is primary target, existing Bun monorepo experience |
| Build (development) | Bun `--compile` | Single self-contained binary for local dev/testing |
| Build (npm publishing) | `bun build --target node` | Node.js-compatible JS bundle — works cross-platform without Bun |
| Build (PyPI publishing) | `bun build --compile --target bun-<platform>` | Self-contained native binary per platform; no Node.js required |
| Distribution (npm) | `relic-cli` on npm | 186 KB Node.js bundle; requires Node.js 18+ |
| Distribution (PyPI) | `relic-cli` on PyPI | Platform-specific wheels with pre-compiled binaries; no runtime required |
| macOS binary signing | `codesign --sign -` (ad-hoc) | Unsigned Bun binaries are SIGKILL'd by Gatekeeper; ad-hoc signing satisfies the requirement |
| Template embedding | `scripts/embed-templates.ts` + `scripts/embed-engine-templates.ts` | Scaffold templates baked into `core/generated/templates.ts`; prompt templates baked into `engines/generated/engine-templates.ts` |
| Storage format | Markdown + JSON | Human-readable, AI-native, git-friendly |
| AI engine hooks | Prompt files per engine | Claude → `.claude/commands/`, Copilot → `.github/`, Codex → `.codex/` |

---

## CLI Architecture

### Production binary (`bin.ts`) — what users get via `npm install -g relic-cli`

| Command | Purpose |
|---|---|
| `relic init [--dir] [--engine] [--force]` | Scaffold `.relic/` into a project |
| `relic add-engine <claude\|copilot\|codex>` | Add AI engine hooks to existing project |
| `relic use <spec-id>` | Set active spec (writes `.relic/current-spec`) |
| `relic scan [--json]` | Output project manifest for `/relic.scan` AI workflow |
| `relic context [--spec id] [--text]` | Resolve active spec; report file and artifact status |
| `relic scaffold [--title t\|--spec id]` | Ensure spec folder exists; create from templates if new |
| `relic validate [--text]` | Check artifact integrity, ownership conflicts, and manifest health |
| `relic search <keywords...>` | Search `shared/*/manifest.json` by tag keywords; returns scored JSON |
| `relic deep-search` | Consolidated index of all manifest entries for tldr-first triage |

### Debug binary (`bin.debug.ts`) — all commands including AI workflow stubs

All of the above plus: `specify`, `clarify`, `plan`, `analyse`, `tasks`, `implement`, `fix`

### AI slash commands (written to engine-specific directories by `init` / `add-engine`)

```
/relic.specify    /relic.clarify    /relic.plan       /relic.analyse
/relic.tasks      /relic.implement  /relic.fix        /relic.use
/relic.scan
```

---

## AI Engine Hooks

`relic init --engine <name>` (or `relic add-engine <name>`) writes engine-specific files:

| Engine | Files written | Permission config | How the AI picks it up |
|---|---|---|---|
| Claude | `.claude/commands/relic.*.md` (10 files) | `.claude/settings.json` — `Bash(relic *)` allow rule | Claude Code slash commands |
| Copilot | `.github/copilot-instructions.md` | none (N/A for Copilot) | GitHub Copilot workspace instructions |
| Codex | `.codex/instructions.md` | `.codex/config.toml` — `prefix_rules` allow | OpenAI Codex agent instructions |

Default engine is `claude`. Multiple engines can be specified: `--engine claude,copilot`.

---

## AI Agent Utility Commands

Native TypeScript CLI commands that AI agents call directly during workflows.
No bash, Python, or jq dependency in user projects.

| Command | Purpose |
|---|---|
| `relic context [--spec id]` | Resolve spec; report which files exist and which shared artifacts are referenced |
| `relic scaffold [--title t\|--spec id]` | Ensure spec folder exists; create from templates if new; writes `current-spec` |
| `relic validate` | Check artifact integrity, ownership conflicts, missing manifests, unregistered files |
| `relic search <keywords...>` | Find relevant shared artifacts by tag; returns scored candidates |
| `relic deep-search` | Return all manifest entries; LLM reads `tldr` and loads selectively |

`relic context` JSON output:
```json
{
  "relic_dir": "...", "spec_id": "001-auth",
  "active_spec_source": "current-spec",
  "spec_dir": "...",
  "files": { "preamble": true, "spec": true, "plan": false, ... },
  "shared_artifacts": [{ "path": "shared/domains/UserAuth.md", "role": "owns", "exists": true }]
}
```

`relic search auth session` JSON output:
```json
[
  { "path": "shared/domains/UserAuth.md", "name": "UserAuth",
    "tldr": "Handles user authentication and session tokens.",
    "tags": ["auth", "session", "token"], "score": 2 }
]
```

---

## Design Principles

1. **Artifacts over specs** — shared artifacts are the atomic unit; specs are consumers
2. **Plan is the linchpin** — the `plan` step is where cross-spec reality is assembled
3. **Changelog is non-negotiable** — every plan mutation writes to `changelog.md` for full auditability
4. **Constitution is versioned** — amendments are appended, never overwritten
5. **Analyse is always non-destructive** — read-only, never mutates anything
6. **LLM context is assembled, not assumed** — before any command, context is built from: constitution + target spec + referenced shared artifacts
7. **Specs never die** — `fix` keeps the spec alive as a living constraint on every bug fix
8. **Fixes that change contracts must propagate** — if `fix` alters a contract, it must trigger `clarify` and update the shared artifact, preventing knowledge drift
9. **One upfront scan pays dividends forever** — `scan` is expensive once; it saves tokens on every subsequent spec command
10. **Session state is personal** — `.relic/current-spec` is gitignored; each team member tracks their own active spec

---

## Open Questions (to resolve during build)

- [ ] Who owns an artifact when two specs claim the same one? Need explicit ownership transfer flow.
- [ ] How granular are contracts? Full OpenAPI schema vs. light shape definition?
- [ ] Is the constitution versioned with diffs, or append-only?
- [ ] What is the LLM's role in `plan` (semantic conflict detection) vs `tasks` (more mechanical)?
- [ ] If `fix` determines the bug requires changing a contract, does it automatically trigger `clarify`, or prompt the user to do so manually?
- [ ] If `fix` reveals a `shared/assumptions/` entry is now stale, does it flag that proactively?
- [ ] Should `fix` always write to `changelog.md`, or only when a contract changes?
- [ ] Should `scan` artifacts with `confidence: low` be quarantined (e.g. `shared/draft/`) rather than written directly to `shared/`?

---

## Market Context

- **spec-kit** (GitHub): Constitution → Specify → Clarify → Plan → Tasks → Implement. No shared artifact layer. Specs are isolated. This is the tool that inspired Relic.
- **Kiro** (AWS): Steering files + per-spec workflows. No cross-spec intersection detection.
- **OpenSpec**: Propose → Apply → Archive. Per-feature, no shared brain.
- **Gap**: No tool has a shared artifact layer with governed lifecycle, intersection detection, a traceable changelog, and a bootstrap path for existing codebases. This is the Relic opportunity.

---

## Naming

Working name: **Relic** *(confirmed working name, subject to change)*

The name reflects the core philosophy — preserved artifacts that carry knowledge across time. Specs that don't die after implementation. A shared knowledge layer that outlives any single feature.

### Distribution targets

| Channel | Package name | Status |
|---|---|---|
| npm | `relic-cli` | ✅ Published |
| PyPI / uv | `relic-cli` | ✅ Published |
| Homebrew | `relic` | planned |

### CLI command

The user always types `relic` regardless of install channel:

```bash
npm install -g relic-cli      # npm — Node.js bundle, requires Node.js 18+
uv tool install relic-cli     # PyPI — native binary, no Node.js required
pip install relic-cli         # pip — same as above
brew install relic            # Homebrew (planned)

relic init
relic scan
relic use 001-auth
```

### Slash commands inside AI agents

```
/relic.specify    /relic.clarify    /relic.plan       /relic.analyse
/relic.tasks      /relic.implement  /relic.fix        /relic.use
/relic.scan
```
