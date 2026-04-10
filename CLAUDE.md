# Relic — Claude Code Project Context

> Read this file before every session. It contains the full architectural context, key decisions, and project philosophy for the Relic project.

---

## What We're Building

**Relic** is a spec-driven development tool that extends the concept of tools like GitHub's spec-kit with a **shared artifact layer** — a "brain" that connects all specs in a project, enabling cross-spec awareness, intersection detection, and a traceable change history.

The core insight: existing SDD tools (spec-kit, Kiro, OpenSpec) treat specs as isolated silos. Relic treats **shared artifacts** as the atomic unit, with specs as consumers of those artifacts. This makes intersections between features explicit and detectable.

The second core insight: **specs should not die after implementation**. The `fix` command keeps the spec alive as the lens through which bugs are understood and resolved — using the original intent, contracts, and decisions as constraints on every fix. This closes the loop between the knowledge layer and the living codebase.

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

---

## Lifecycle Commands

| Command | Purpose | Notes |
|---|---|---|
| `constitution` | Hard rules that govern every interaction | Can be amended with client approval only |
| `specify` | Create a new spec from a PRD or User Story | No intersection check needed at this stage |
| `clarify` | Append details, change contracts, add behaviors | **Must check for intersections** |
| `plan` | Create implementation plan | **Principal intersection discovery point**; writes changelog |
| `analyse` | Non-destructive consistency check | Read-only; checks spec coherence and artifact freshness |
| `tasks` | Generate tasks from the current plan | **Must check for task overlap between specs** |
| `implement` | Build the plan | Executes tasks |
| `fix` | Debug and fix issues using the spec as context | **Keeps the spec alive post-implementation**; may trigger `clarify` if contracts change |

### The Two Lifecycles

**Forward lifecycle** (greenfield / feature development):
```
constitution → specify → clarify → plan → analyse → tasks → implement
```

**Feedback lifecycle** (post-implementation, keeps knowledge layer alive):
```
implement → [bug appears] → fix → [contract changed?] → clarify → plan (update) → changelog
```

## The `fix` Command — Closing the Loop

### How it works

The user invokes `fix` with a spec reference and an error/issue description:

```bash
# Infer spec from current git branch name
relic fix

# Explicit spec reference
relic fix --spec 001-auth

# Override via .env (useful when on main or a hotfix branch)
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

### The branch/env override

- Normally `fix` infers the spec from the current git branch (e.g. branch `001-auth` → loads spec `001-auth`)
- For hotfixes on `main` or unrelated branches, set `RELIC_SPEC=001-auth` in `.env`
- This solves "we merged 3 months ago but the bug is in auth code" — the spec context is always accessible regardless of branch

### Why this is the sweet spot

No existing tool does this. When using Cursor or Claude Code to fix a bug today, the model sees only the error and the surrounding code. With `fix`, the model sees all of that **plus** the original intent, the contracts the code is supposed to honour, the assumptions that were made, and the changelog of decisions. It can tell you not just *how* to fix it but *whether the fix is consistent with the spec* — or flag that the fix actually requires a `clarify` or `plan` update first.

**The spec stops being dead documentation and becomes a living constraint on every future change.**

---

### Layer 1 — Intent Layer (Specs)
Each spec describes what a feature should do. Lives in `.relic/specs/<branch-id>/`.

### Layer 2 — Knowledge Layer (Shared Artifacts)
The brain. Domains, contracts, rules, and assumptions that exist independently of any single spec. Lives in `.relic/shared/`.

**Specs do not depend on each other directly — they both depend on shared artifacts.** This avoids circular dependencies and makes intersection points explicit.

---

## Project Folder Structure (scaffolded into user's project)

```
.relic/
  constitution.md           ← Always loaded (hot memory). Governs all interactions.
  changelog.md              ← Every plan step writes here. Full audit trail.
  shared/                   ← THE BRAIN — shared across all specs
    domains/                ← Bounded contexts, entity definitions (e.g. UserAuth.md)
    contracts/              ← API shapes, event schemas (e.g. AuthAPI.md)
    rules/                  ← Cross-cutting business rules (e.g. SessionRules.md)
    assumptions/            ← Things true today but flagged as potentially stale
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
  core/          ← TypeScript, all business logic
  cli-node/      ← npm package, thin bin wrapper around core
  cli-python/    ← PyPI package for uv/pip, shells out to compiled binary
templates/
  constitution.md
  spec.md
  plan.md
  tasks.md
  prompts/       ← AI slash command prompt files (markdown)
    specify.md
    clarify.md
    plan.md
    analyse.md
    tasks.md
    implement.md
    fix.md
docs/
  architecture.md
  context.md
```

---

## Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Thin code layer, npm is primary target, existing Bun monorepo experience |
| Build | Bun `--compile` | Single self-contained binary, no Node required on user machine |
| Distribution | npm (primary) + PyPI (secondary) | Both point at the same compiled binary |
| PyPI packaging | Python shim that ships/invokes the Bun binary | One source of truth, no duplicated logic |
| Storage format | Markdown + JSON | Human-readable, AI-native, git-friendly |

---

## Design Principles

1. **Artifacts over specs** — shared artifacts are the atomic unit; specs are consumers
2. **Plan is the linchpin** — the `plan` step is where cross-spec reality is assembled
3. **Changelog is non-negotiable** — every plan mutation writes to `changelog.md` for full auditability
4. **Constitution is versioned** — amendments are appended, never overwritten
5. **Analyse is always non-destructive** — read-only, never mutates anything
6. **LLM context is assembled, not assumed** — before any command, context is built from: constitution + target spec + referenced shared artifacts
7. **Specs never die** — `fix` keeps the spec alive as a living constraint on every bug fix, not just during greenfield development
8. **Fixes that change contracts must propagate** — if `fix` alters a contract, it must trigger `clarify` and update the shared artifact, preventing knowledge drift

---

## Open Questions (to resolve during build)

- [ ] Who owns an artifact when two specs claim the same one? Need explicit ownership transfer flow.
- [ ] How granular are contracts? Full OpenAPI schema vs. light shape definition?
- [ ] Is the constitution versioned with diffs, or append-only?
- [ ] ~~Does `implement` write back to shared artifacts when it diverges from the plan?~~ **Resolved: `fix` is the feedback mechanism. It detects contract drift and triggers `clarify` when needed.**
- [ ] What is the LLM's role in `plan` (semantic conflict detection) vs `tasks` (more mechanical)?
- [ ] If `fix` determines the bug requires changing a contract, does it automatically trigger `clarify`, or prompt the user to do so manually?
- [ ] If `fix` reveals a `shared/assumptions/` entry is now stale, does it flag that proactively?
- [ ] Should `fix` always write to `changelog.md`, or only when a contract changes?

---

## Market Context

- **spec-kit** (GitHub): Constitution → Specify → Clarify → Plan → Tasks → Implement. No shared artifact layer. Specs are isolated. This is the tool that inspired Relic.
- **Kiro** (AWS): Steering files + per-spec workflows. No cross-spec intersection detection.
- **OpenSpec**: Propose → Apply → Archive. Per-feature, no shared brain.
- **Gap**: No tool has a shared artifact layer with governed lifecycle, intersection detection, and a traceable changelog. This is the Relic opportunity.

---

## Naming

Working name: **Relic** *(confirmed working name, subject to change)*

The name reflects the core philosophy — preserved artifacts that carry knowledge across time. Specs that don't die after implementation. A shared knowledge layer that outlives any single feature.

### Distribution targets

| Channel | Package name | Status |
|---|---|---|
| Homebrew | `relic` | ✅ Free |
| PyPI | `relic` | ✅ Free |
| npm | `relic-cli` | ✅ Free (`relic` is squatted but 10yr abandoned — claim via npm support later) |

### CLI command

The user always types `relic` regardless of install channel:

```bash
brew install relic        # Homebrew (primary)
uv tool install relic     # PyPI
npm install -g relic-cli  # npm (same binary)

relic init
relic fix --spec 001-auth
```

### Slash commands inside AI agents

```
/relic.constitution
/relic.specify
/relic.clarify
/relic.plan
/relic.analyse
/relic.tasks
/relic.implement
/relic.fix
```