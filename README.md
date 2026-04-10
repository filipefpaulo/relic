# Relic

> Spec-driven development with a shared artifact layer.

Relic connects all your specs through a shared "brain" — domains, contracts, rules, and assumptions that live independently of any single feature. When two specs touch the same contract, Relic detects it. When a bug appears months later, the original spec constrains the fix.

---

## The problem with existing SDD tools

Tools like spec-kit, Kiro, and OpenSpec treat specs as isolated silos. There is no shared context between them — the LLM implementing spec B has no idea spec A already owns the auth contract. Specs also die the moment implementation finishes: when a bug appears in production, the original intent, decisions, and contracts are completely abandoned.

Relic fixes both.

---

## How it works

```
.relic/
  shared/              ← THE BRAIN — shared across all specs
    domains/           ← bounded context definitions, entity models
    contracts/         ← API shapes, event schemas, data interfaces
    rules/             ← cross-cutting business rules
    assumptions/       ← declared assumptions about the environment
  specs/
    001-auth/
      spec.md
      plan.md
      tasks.md
      artifacts.json   ← declares owns/reads/touches — never stores artifacts
  preamble.md          ← Relic's immutable structural rules
  constitution.md      ← project governance (amendable)
  changelog.md         ← full audit trail of every plan mutation
```

**Specs do not depend on each other.** They both depend on shared artifacts. This makes intersections explicit and detectable.

---

## Commands

| Command | Purpose |
|---|---|
| `relic init` | Scaffold `.relic/` in your project |
| `relic specify` | Create a new spec from a PRD or user story |
| `relic clarify` | Append details or change contracts (checks intersections) |
| `relic plan` | Create an implementation plan (principal intersection discovery point) |
| `relic analyse` | Non-destructive consistency check (read-only) |
| `relic tasks` | Generate tasks from the current plan |
| `relic implement` | Build the plan |
| `relic fix` | Fix a bug using the spec as a living constraint |
| `relic add-engine` | Add AI engine hooks to an existing project |

---

## AI engine support

Relic writes hook files for your AI coding assistant automatically:

```bash
relic init --engine claude        # default
relic init --engine claude,copilot,codex

# Add an engine to an existing project
relic add-engine copilot
```

| Engine | Location | Format |
|---|---|---|
| Claude Code | `.claude/commands/relic.*.md` | 7 slash commands (`/relic.fix`, `/relic.plan`, …) |
| GitHub Copilot | `.github/copilot-instructions.md` | Consolidated workspace instructions |
| Codex CLI | `.codex/instructions.md` | Agent instructions |

---

## The `fix` command

Every other tool abandons the spec after `implement`. Relic doesn't.

```bash
relic fix --spec 001-auth
```

Before the LLM sees the error, Relic assembles full context from the spec, plan, shared artifacts, and changelog. The fix is constrained by the original intent and contracts — not just the surrounding code. If the fix changes a contract, it triggers `clarify` and propagates the change to every spec that reads the affected artifact.

---

## Getting started

```bash
# Install (npm)
npm install -g relic-cli

# Initialise in your project
cd my-project
relic init

# Create your first spec
relic specify --title "User Authentication"
```

---

## Status

Early MVP. Core scaffolding, bash context scripts, intersection detection, and AI engine hooks are working. Full command implementations (`clarify`, `plan`, `analyse`, `tasks`, `implement`) are in progress.

---

## Distribution

| Channel | Package | Status |
|---|---|---|
| npm | `relic-cli` | planned |
| Homebrew | `relic` | planned |
| PyPI | `relic` | planned |
