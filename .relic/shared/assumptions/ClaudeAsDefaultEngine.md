# ClaudeAsDefaultEngine

**Type:** assumption
**Inferred from:** packages/core/src/commands/init.ts, packages/core/src/commands/add-engine.ts
**Confidence:** medium

## Description
`relic init` defaults to the `claude` engine when no `--engine` flag is provided. The Claude engine writes 10 slash command files to `.claude/commands/relic.*.md`. This assumes the primary user of Relic is a Claude Code user.

## Risk if wrong
- If a project uses Copilot or Codex exclusively, the default engine produces irrelevant files that need to be manually removed
- The `add-engine` command can retroactively fix this, but it's additional friction

## Staleness signal
- If usage data shows that Copilot or another engine is more common among adopters
- If a new engine (e.g. Gemini) is added and becomes dominant

## Owned by
(unowned — assign when a spec takes responsibility)
