# SpecFilesAllowlistRule

**Type:** rule
**Inferred from:** packages/core/src/commands/validate.ts
**Confidence:** high
**Owned by:** 007-remote-ollama-engine

## Description

A spec directory contains exactly two categories of files:

**Committed artifact files (4):** `spec.md`, `plan.md`, `tasks.md`, `artifacts.json`
These define intent, decisions, tasks, and artifact relationships. They are committed to git and are visible across the team.

**Session-local runtime files (1):** `history.json`
Stores conversation history for direct model invocation. This file is gitignored via the pattern `specs/**/history.json` in `.relic/.gitignore`. It is never committed, never read by any Relic utility command, and is invisible to cross-spec tooling. It exists only to give the model reasoning continuity across sequential workflow calls within a local session.

Any file other than these five is flagged as an illegal file by `relic validate`.

## Enforcement

- `runValidate()` checks each spec directory against `ALLOWED_SPEC_FILES = {"spec.md", "plan.md", "tasks.md", "artifacts.json", "history.json"}`
- Illegal files are reported as validation failures
- `history.json` is exempted from any cross-spec analysis — it is never read by `relic context`, `relic search`, `relic validate` content checks, or any other utility command

## Gitignore

`.relic/.gitignore` must contain the glob pattern `specs/**/history.json` to ensure all per-spec history files are excluded from version control regardless of spec ID.

## Why this extension is safe

The original rule's purpose was to prevent artifact content (domains, contracts, rules, assumptions) from being siloed inside spec folders, breaking cross-spec awareness. `history.json` does not contain artifact content — it contains transient session state. Allowing it here does not weaken the shared artifact layer.
