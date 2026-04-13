# Relic

> Spec-driven development with a shared artifact layer.

Relic connects all your specs through a shared "brain" — domains, contracts, rules, and assumptions that live independently of any single feature. When two specs touch the same contract, Relic detects it. When a bug appears months later, the original spec constrains the fix.

---

## The problem with existing SDD tools

Tools like spec-kit, Kiro, and OpenSpec treat specs as isolated silos. There is no shared context between them — the LLM implementing spec B has no idea spec A already owns the auth contract. Specs also die the moment implementation finishes: when a bug appears in production, the original intent, decisions, and contracts are completely abandoned.

Relic fixes both.

---

## Install

**npm (Node.js 18+):**
```bash
npm install -g relic-cli
```

**uv (no runtime required):**
```bash
uv tool install relic-cli
```

**pip:**
```bash
pip install relic-cli
```

---

## Getting started

```bash
cd my-project
relic init

# Open your AI agent (Claude Code, Copilot, Codex) and run:
# Existing codebase:  /relic.scan  then  /relic.constitution
# New project:        /relic.constitution  then  /relic.specify
```

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
  constitution.md      ← project-specific governance, extracted from your codebase
  changelog.md         ← full audit trail of every plan mutation
```

**Specs do not depend on each other.** They both depend on shared artifacts. This makes intersections explicit and detectable.

---

## CLI commands

| Command | Purpose |
|---|---|
| `relic init [--engine claude\|copilot\|codex]` | Scaffold `.relic/` in your project |
| `relic add-engine <engine>` | Add AI engine hooks to an existing project |
| `relic use <spec-id>` | Set the active spec for this session |
| `relic scan [--json]` | Output a project manifest for `/relic.scan` |
| `relic context [--spec id] [--text]` | Resolve active spec and report file/artifact status |
| `relic scaffold [--title t\|--spec id]` | Ensure spec folder exists; create from templates if new |
| `relic validate [--text]` | Check artifact integrity and ownership conflicts |
| `relic search <keywords...>` | Search shared artifact manifests by keyword tags |
| `relic deep-search` | Return all manifest entries consolidated (tldr-first triage) |

---

## AI slash commands

The workflow lives inside your AI agent. After `relic init`, these slash commands are written to your agent's hooks directory:

| Slash command | Purpose |
|---|---|
| `/relic.constitution` | Extract project-specific coding principles from the codebase |
| `/relic.scan` | Bootstrap shared artifacts (domains, contracts, rules, assumptions) |
| `/relic.specify` | Create a new spec from a PRD or user story |
| `/relic.clarify` | Append details or change contracts (checks intersections) |
| `/relic.plan` | Create an implementation plan (principal intersection point) |
| `/relic.analyse` | Non-destructive consistency check |
| `/relic.tasks` | Generate tasks from the current plan |
| `/relic.implement` | Build the plan |
| `/relic.fix` | Fix a bug using the spec as a living constraint |
| `/relic.use` | Switch the active spec from inside the AI session |

---

## AI engine support

```bash
relic init                              # defaults to Claude Code
relic init --engine claude,copilot,codex

relic add-engine copilot                # add to an existing project
```

| Engine | Hook location | Format |
|---|---|---|
| Claude Code | `.claude/commands/relic.*.md` | 10 slash commands |
| GitHub Copilot | `.github/copilot-instructions.md` | Consolidated workspace instructions |
| Codex | `.codex/instructions.md` | Agent instructions |

---

## Three lifecycles

**Bootstrap** (existing codebase):
```
relic init → /relic.scan → /relic.constitution → /relic.specify
```

**Forward** (new feature):
```
/relic.specify → /relic.clarify → /relic.plan → /relic.tasks → /relic.implement
```

**Feedback** (bug fix, keeps the spec alive):
```
/relic.fix → [contract changed?] → /relic.clarify → changelog updated
```

---

## Distribution

| Channel | Package | Status |
|---|---|---|
| npm | `relic-cli` | ✅ Available |
| PyPI / uv | `relic-cli` | ✅ Available |
| Homebrew | `relic` | planned |

---

## Repository

[github.com/filipefpaulo/relic](https://github.com/filipefpaulo/relic)
