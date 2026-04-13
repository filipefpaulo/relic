# relic-cli

> Spec-driven development with a shared artifact layer — npm distribution.

Relic connects all your specs through a shared "brain" of domains, contracts, rules, and assumptions. Intersection detection between specs. Specs that stay alive through bug fixes.

---

## Install

```bash
npm install -g relic-cli
```

Requires **Node.js 18+**. One-off usage without installing:

```bash
npx relic-cli init
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

## CLI commands

| Command | Purpose |
|---|---|
| `relic init [--engine claude\|copilot\|codex] [--dir] [--force]` | Scaffold `.relic/` in your project |
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

Written to your agent's hooks directory by `relic init`:

| Slash command | Purpose |
|---|---|
| `/relic.constitution` | Extract project-specific principles from the codebase |
| `/relic.scan` | Bootstrap shared artifacts from existing code |
| `/relic.specify` | Create a new spec |
| `/relic.clarify` | Append details or change contracts |
| `/relic.plan` | Create an implementation plan |
| `/relic.analyse` | Non-destructive consistency check |
| `/relic.tasks` | Generate tasks from the plan |
| `/relic.implement` | Build the plan |
| `/relic.fix` | Fix a bug constrained by the original spec |
| `/relic.use` | Switch active spec from inside the AI session |

---

## Also available via uv / pip

```bash
uv tool install relic-cli   # no Node.js required — native binary
pip install relic-cli
```

---

[Full documentation](https://github.com/filipefpaulo/relic) · [Report an issue](https://github.com/filipefpaulo/relic/issues)
