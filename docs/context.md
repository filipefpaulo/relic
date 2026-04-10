# Relic — Full Conversation Context

> This document captures the full ideation conversation that led to the Relic architecture. It serves as the design history and rationale document. Read CLAUDE.md for the distilled decisions.

---

## Origin: The Problem with Spec-Kit

The conversation started from a frustration with **GitHub's spec-kit**:

> "The first spec you create is perfect, the system runs, the prompt is perfect, but when you start other specs — like I have 4 on my project — they don't talk to each other. The spec touches the code of another spec and it doesn't update the first spec."

The root cause: spec-kit (and all similar tools) treat each spec as an isolated document. There is no awareness of cross-spec dependencies, no shared contract layer, and no mechanism to propagate changes when one spec affects another.

The proposed solution: **a tool that serves like a brain**, where features are interconnected, artifacts are shared, and there is a living history for both the project and the LLM being used to code.

---

## Market Research Findings

A web search was conducted to determine if anything like this already exists.

### What exists today

| Tool | Approach | Cross-Spec Awareness |
|---|---|---|
| **spec-kit** (GitHub) | Markdown prompts + CLI scaffolding | ❌ None |
| **Kiro** (AWS) | Steering files + per-spec workflows | ❌ None |
| **OpenSpec** | Propose → Apply → Archive per feature | ❌ None |
| **Cline memory-bank** | Community pattern, structured markdown | ❌ Manual only |
| **Augment Code** | Cross-service dependency tracking | Partial (code-level only) |

### Academic parallel

A February 2026 paper from arXiv independently arrived at a similar architecture — a **three-tier codified context infrastructure**: hot memory (constitution, always loaded), domain specialists (invoked per task), and cold memory (knowledge base, retrieved on demand). It described treating "documentation as infrastructure — load-bearing artifacts that AI agents depend on." This is a research paper with no implementation.

### The gap

No tool has:
1. A shared artifact layer (domains, contracts, rules) owned independently of any single spec
2. Explicit intersection detection between specs at plan time
3. A governed lifecycle with traceability and changelogs
4. Constitution-level governance with approval flow for amendments

---

## The Lifecycle Design

The lifecycle was designed inspired by spec-kit but with explicit cross-spec awareness at the right stages:

### `constitution`
- Hard rules that must be respected in every interaction
- Can be appended if needed, but **requires client approval**
- Should be versioned — amendments appended, never overwritten

### `specify`
- Creation of the spec itself
- Receives a PRD or User Story as input
- **Does not need to check for intersections** at this stage

### `clarify`
- Used to append details to the spec, change contracts, add behaviors
- **Must check if there are intersections between specs**

### `plan`
- Creates a plan based on the current spec
- **The principal point where intersections are discovered**
- Changes details on previous specs if applicable
- **Writes a changelog** to make everything traceable

### `analyse`
- Non-destructive — checks for consistency of the plan
- Can check consistency between specs
- Can check if everything is up to date
- **Never mutates anything**

### `tasks`
- Creates tasks for the current plan
- **Must evaluate if there are overlaps between two specs**

### `implement`
- Builds the plan

---

## The Two-Layer Architecture

The key architectural insight that emerged from the design discussion:

> "Specs don't depend on each other directly — they both depend on shared artifacts."

This is cleaner than a graph of spec-to-spec edges because:
- It avoids circular dependencies
- It makes the intersection point explicit
- The shared artifact layer can be reasoned about independently

### Layer 1 — Intent Layer
Specs describe what features should do. Per-feature documents.

### Layer 2 — Knowledge Layer (The Brain)
Domains, contracts, rules, and assumptions that exist independently of any single spec. This is the innovation — treating the **knowledge layer as the atomic unit**, not the spec.

---

## The Shared Artifact Folder

The `.relic/shared/` folder is the core innovation. Most tools (including spec-kit) treat specs as the atomic unit. Relic treats **artifacts** as the atomic unit, with specs as consumers.

This means:
- A `UserAuthContract` artifact can be owned by one spec but referenced by three others
- When that contract changes, the system knows exactly which specs are affected
- The LLM context for any operation is assembled from: constitution + target spec + referenced artifacts

### Artifact types

| Type | Purpose | Example |
|---|---|---|
| `domain` | Bounded context, entity definitions, ubiquitous language | `UserAuth.md` |
| `contract` | API shape, event schema, data interface | `AuthAPI.md` |
| `rule` | Business logic that spans features | `SessionRules.md` |
| `assumption` | Things true today, explicitly flagged as potentially stale | `ThirdPartyLimits.md` |

---

## The `artifacts.json` Schema

Every spec declares its relationship to shared artifacts:

```json
{
  "owns": ["shared/domains/UserAuth.md", "shared/contracts/AuthAPI.md"],
  "reads": ["shared/rules/SessionRules.md"],
  "touches_files": ["src/auth/", "src/middleware/auth.ts"]
}
```

**Intersection rules:**
- Two specs with the same file in `owns` → ownership conflict, blocked
- Two specs with overlapping `touches_files` → warning at `plan` time
- `reads` is unrestricted

---

## The Changelog

Making `plan` write a changelog means a full audit trail of *why* specs changed, not just *what* changed. This is important for LLM-based workflows: the model can be given the changelog as context and understand the **evolution of decisions**, not just the current state.

---

## Folder Structure (scaffolded into user project)

```
.relic/
  constitution.md           ← Hot memory. Always loaded. Governs all interactions.
  changelog.md              ← Append-only audit trail. Every plan writes here.
  shared/                   ← The brain. Shared across all specs.
    domains/
    contracts/
    rules/
    assumptions/
  specs/
    001-feature-name/
      spec.md
      plan.md
      tasks.md
      artifacts.json        ← Ownership and dependency declarations
    002-another-feature/
      spec.md
      plan.md
      tasks.md
      artifacts.json
```

---

## Technology Decision: Language and Distribution

### The question
Should the CLI be JavaScript/TypeScript, Python, or Go? The goal is to publish to both **npm** and **PyPI (uv)**, with a thin code layer.

### Options considered

| Option | Core | npm | PyPI | Notes |
|---|---|---|---|---|
| A | TypeScript | Native | Python shim → shells out to JS | One source of truth, JS-native |
| B | Go | Binary in npm package | Binary in PyPI package | Best distribution story, different language |
| C | Python | npm shim → shells out | Native | What spec-kit does, but npm is secondary |

### Decision: TypeScript + Bun compile

Given:
- The code layer is genuinely thin (file I/O, JSON parsing, template scaffolding)
- Target users are primarily in npm-based toolchains (Cursor, Claude Code, Copilot)
- The project is already in a Bun monorepo context

**Chosen approach:** TypeScript core, compiled to a single self-contained binary using `bun build --compile`. Both the npm package and the PyPI package ship this binary. No Node.js required on the user's machine.

The Python PyPI package is a thin shim that ships or invokes the Bun-compiled binary.

---

## Monorepo Structure (the Relic package itself)

```
packages/
  core/                     ← TypeScript, all business logic
    src/
      commands/
        init.ts
        specify.ts
        clarify.ts
        plan.ts
        analyse.ts
        tasks.ts
        implement.ts
      core/
        artifact-registry.ts
        intersection.ts
        changelog.ts
        context-builder.ts
  cli-node/                 ← npm package, thin bin wrapper
  cli-python/               ← PyPI package, ships binary, thin shim
templates/
  constitution.md
  spec.md
  plan.md
  tasks.md
  prompts/                  ← AI slash command prompt files
    specify.md
    clarify.md
    plan.md
    analyse.md
    tasks.md
    implement.md
docs/
  architecture.md
  context.md                ← this file
CLAUDE.md                   ← distilled context for Claude Code sessions
```

---

## Key Design Principles (emerged from discussion)

1. **Artifacts over specs** — shared artifacts are the atomic unit; specs are consumers
2. **Plan is the linchpin** — this is the "compilation step" where cross-spec reality is assembled, conflicts surface, and changelogs are written
3. **Changelog is non-negotiable** — every plan mutation writes to `changelog.md`
4. **Constitution is versioned** — amendments are appended, never overwritten; old versions preserved for audit
5. **Analyse is always non-destructive** — read-only, zero mutations
6. **LLM context is assembled explicitly** — before any command, the system builds context from: constitution + target spec + referenced shared artifacts
7. **Ownership is explicit** — every shared artifact has exactly one owning spec; transfer requires an explicit process

---

## The `fix` Command — The Sweet Spot

This was identified as the insight that closes the loop and differentiates Relic from every other SDD tool.

### The problem it solves

In spec-kit and every comparable tool, the spec becomes **dead documentation** the moment `implement` finishes. When a bug appears weeks or months later, the developer and LLM only have the error and the code. The original intent, the contracts, the architectural decisions, the assumptions — all of it is abandoned.

### The concept

`fix` uses the spec as the **lens through which the bug is understood and resolved**. Instead of fixing a bug in isolation, you fix it constrained by:
- The original intent (what this code was supposed to do)
- The contracts the code is supposed to honour
- The architectural decisions that led to this implementation
- The changelog of decisions that explain why things are the way they are

### Invocation

```bash
# Infer spec from current git branch
relic fix

# Explicit spec
relic fix --spec 001-auth

# Override when on main or a hotfix branch (no need to checkout the feature branch)
RELIC_SPEC=001-auth relic fix
```

Or from the AI agent slash command:
```
/relic.fix TypeError: Cannot read property 'session' of undefined at auth.middleware.ts:42
```

### Context assembled before the LLM sees the error

| Source | Purpose |
|---|---|
| `constitution.md` | Always loaded — governs what the fix may and may not do |
| `specs/001-auth/spec.md` | Original intent |
| `specs/001-auth/plan.md` | Architecture decisions |
| `specs/001-auth/artifacts.json` | Which contracts and domains are relevant |
| All referenced `shared/` artifacts | Contracts the fix must respect |
| `changelog.md` (filtered to this spec) | Why things are the way they are |

### The feedback loop

```
implement → [bug appears] → fix
                              ↓
                    Did the fix change a contract?
                         ↙              ↘
                       No               Yes
                        ↓                ↓
               write brief entry    trigger clarify
               to changelog         update shared artifact
                                    flag affected specs
                                    write to changelog
```

### The branch/env override

The `.env` override (`RELIC_SPEC=001-auth`) solves a real problem: bugs often appear long after the feature branch was merged. You shouldn't need to checkout a 6-month-old branch to get access to its spec context. The override makes the knowledge layer accessible from any branch.

### Why this is the sweet spot

This is what no existing tool does. Cursor, Claude Code, Kiro — when fixing a bug, the LLM sees the error and the code. With `fix`, it sees the error, the code, AND the original intent, contracts, and decision history. It can tell you:
- How to fix it
- Whether the fix is consistent with the spec
- Whether the fix requires a contract update (which then triggers `clarify` and propagates to other specs)

**The spec stops being an artifact of the past and becomes a living constraint on every future change to that code.**

---

## Open Questions (unresolved at time of writing)

These were identified as important to resolve before or during implementation:

1. **Artifact ownership conflicts**: If two specs claim to own `UserSession`, who wins? Need an explicit ownership transfer flow.
2. **Contract granularity**: Full OpenAPI-style schema per endpoint, or lighter shape definitions?
3. **Constitution versioning**: Is it versioned with diffs, or append-only? Old versions must be preserved.
4. **Implement feedback loop**: ~~When implementation diverges from the plan, does it write back to shared artifacts?~~ **Resolved: `fix` is the feedback mechanism.**
5. **LLM role in Plan vs Tasks**: Plan needs LLM reasoning to detect semantic conflicts (not just filename overlaps). Tasks could be more mechanical. These two modes should be separated explicitly.
6. **fix → clarify trigger**: If `fix` determines the bug requires changing a contract, does it automatically trigger `clarify`, or prompt the user manually?
7. **Stale assumption detection**: If `fix` reveals a `shared/assumptions/` entry is now stale, does it flag that proactively?
8. **fix changelog policy**: Should `fix` always write to `changelog.md`, or only when a contract changes?

---

## Naming

**Working name: Relic** *(confirmed working name, subject to change)*

The name was chosen after an extensive search across Homebrew, npm, and PyPI. Many strong candidates were blocked:

| Name | Blocked by |
|---|---|
| `cortex` | Homebrew (Prometheus tool), npm, PyPI |
| `vortex` | npm (abandoned), PyPI, Homebrew |
| `helix` | Homebrew (text editor), PyPI, npm |
| `spectra` | Homebrew (C++ lib), PyPI |
| `quasar` | npm (major Vue framework, 462 dependents), PyPI |
| `nexus` | Homebrew, npm (active GraphQL tool) |
| `codex` | Homebrew (OpenAI CLI), npm (`@openai/codex`), PyPI |
| `zeno` | PyPI |

`relic` fits the project philosophy perfectly — preserved artifacts that carry knowledge across time, specs that don't die after implementation, a shared knowledge layer that outlives any single feature.

### Distribution availability

| Channel | Package name | Status |
|---|---|---|
| Homebrew | `relic` | ✅ Free |
| PyPI | `relic` | ✅ Free |
| npm | `relic-cli` | ✅ Free (`relic` squatted but 10yr abandoned — claim via npm support later) |

### CLI command

Always `relic` regardless of install channel:

```bash
brew install relic        # Homebrew (primary)
uv tool install relic     # PyPI
npm install -g relic-cli  # npm (same binary)
```

### Slash commands

```
/relic.constitution  /relic.specify  /relic.clarify
/relic.plan          /relic.analyse  /relic.tasks
/relic.implement     /relic.fix
```

---

## Spec-Kit Reference: How It Works Internally

Spec-kit was reviewed in detail. Key findings:

- The CLI (`specify`) is a **Python tool** that scaffolds a folder structure and markdown templates into the user's project
- The "intelligence" lives entirely in the **markdown prompt files** — these are what instruct the AI agent via slash commands
- Each spec lives in its own folder: `contracts/` is inside the spec folder, not shared
- There is no mechanism for cross-spec awareness
- The Python source is at `src/specify_cli/`
- Supports 20+ AI agents via agent-specific command file generation
- Extensions and presets system allows community customization

This confirms the gap Relic is designed to fill: spec-kit has the right lifecycle structure but no shared knowledge layer.

---

*Document generated from ideation conversation on April 9, 2026.*
*Updated to include the `fix` command — the feedback lifecycle that keeps specs alive post-implementation.*
*Read CLAUDE.md for the distilled, session-ready version.*