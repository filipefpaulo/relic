# TemplateDomain

**Type:** domain
**Inferred from:** packages/core/src/commands/init.ts, packages/core/src/commands/scaffold.ts, packages/core/src/commands/add-engine.ts, scripts/embed-templates.ts
**Confidence:** medium

## Description
The template embedding and distribution domain. All Markdown and shell templates are baked into `generated/templates.ts` at build time by `scripts/embed-templates.ts`. At runtime, templates are accessed via the `TEMPLATES` map with path-like keys.

## Key Entities
- **`TEMPLATES` map**: Key = relative path under `templates/` (e.g. `spec.md`, `prompts/fix.md`); value = file content string
- **Template variables**: `{{SPEC_ID}}`, `{{TITLE}}`, `{{DATE}}` — interpolated by `applyTemplate` in `scaffold.ts`
- **Prompt templates** (`templates/prompts/`): 10 AI slash command definitions (one per Relic command)
- **Engine templates** (`templates/engines/`): Copilot instructions, Codex instructions
- **`relic init` templates**: `preamble.md`, `constitution.md` — copied verbatim to `.relic/` on init

## Relationships
- Consumed by InitDomain — `runInit` writes `preamble.md` and `constitution.md` from templates
- Consumed by ScaffoldDomain — `runScaffold` writes `spec.md`, `plan.md`, `tasks.md` with interpolated vars
- Consumed by AddEngineDomain — `runAddEngine` writes engine-specific files from templates

## Owned by
(unowned — assign when a spec takes responsibility)
