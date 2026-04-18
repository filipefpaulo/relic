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

### Setup and navigation

| Command | Purpose |
|---|---|
| `relic init [--engine claude\|copilot\|codex] [--dir] [--force]` | Scaffold `.relic/` in your project |
| `relic add-engine <engine>` | Add AI engine hooks to an existing project |
| `relic use <spec-id>` | Set the active spec for this session |
| `relic use --fix <fix-id>` | Set the active fix (validates fix doc exists) |
| `relic use --clear-fix` | Clear the active fix from session state |
| `relic context [--spec id] [--text]` | Resolve active spec; report file/artifact status and `current_fix` |
| `relic scaffold [--title t\|--spec id]` | Ensure spec folder exists; create from templates if new |
| `relic validate [--text]` | Check artifact integrity and ownership conflicts |
| `relic search <keywords...>` | Search shared artifact manifests by keyword tags |
| `relic deep-search` | Return all manifest entries consolidated (tldr-first triage) |
| `relic upgrade [--check] [--prompts]` | Upgrade relic-cli and refresh engine hook files |

### Workflow commands (direct model invocation)

Requires `.relic/models.json` with `baseUrl` and `model`. Calls any OpenAI-compatible endpoint directly — no IDE required.

| Command | Purpose |
|---|---|
| `relic scan [--manifest] [--no-stream]` | AI scan workflow (default) or raw manifest with `--manifest` |
| `relic specify [--title t] [--no-stream] [--reset-context]` | Create a new spec and run specify workflow |
| `relic clarify [--spec id] [--no-stream] [--reset-context]` | Append details or change contracts |
| `relic plan [--spec id] [--no-stream] [--reset-context]` | Create an implementation plan |
| `relic analyse [--spec id] [--no-stream] [--reset-context]` | Non-destructive consistency check |
| `relic tasks [--spec id] [--no-stream] [--reset-context]` | Generate tasks from the current plan |
| `relic implement [--spec id] [--no-stream] [--reset-context]` | Build the plan |
| `relic fix [--spec id] [--issue desc] [--no-stream] [--reset-context]` | Fix a bug using the spec as context |
| `relic solve [--fix id] [--no-stream]` | Apply the active fix document |
| `relic constitution [--no-stream]` | Regenerate `.relic/constitution.md` from the codebase |
| `relic model --reset-context [--spec id]` | Clear per-spec conversation history |

**Minimum `models.json`:**
```json
{ "baseUrl": "http://localhost:11434", "model": "llama3" }
```

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
| `/relic.fix` | Cross-spec ownership check + diagnosis → writes fix document |
| `/relic.solve` | Apply the active fix document and close the fix |
| `/relic.use` | Switch active spec or fix from inside the AI session |

---

## Also available via uv / pip

```bash
uv tool install relic-cli   # no Node.js required — native binary
pip install relic-cli
```

---

[Full documentation](https://github.com/filipefpaulo/relic) · [Report an issue](https://github.com/filipefpaulo/relic/issues)
