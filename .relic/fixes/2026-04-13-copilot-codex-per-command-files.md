# Fix: 2026-04-13-copilot-codex-per-command-files

**Owning spec:** 002-agent-permission-config
**Classification:** misspecification
**Status:** solved
**Created:** 2026-04-13

## Issue

The commands for copilot and codex are supposed to be individual per-command files, but the current implementation writes all commands into a single file for each engine.

Correct native formats:
- **Copilot**: `.github/prompts/relic.<name>.prompt.md` — one file per command with YAML frontmatter. These appear as slash commands in Copilot Chat (type `/` to pick from the list).
- **Codex**: `.codex/commands/relic.<name>.md` — one file per command. These appear as slash commands inside Codex.

Current (wrong) output:
- Copilot: `.github/copilot-instructions.md` (single file, all commands concatenated)
- Codex: `.codex/instructions.md` (single file, all commands concatenated)

## Root cause

FR-6 in spec 002 explicitly prescribed "runtime composition" of all prompts into a single file for both Copilot and Codex. The implementation correctly followed that spec. The spec was wrong — it assumed Copilot and Codex only support monolithic instruction files, not realising both engines now support individual per-command slash command files (analogous to Claude's `.claude/commands/` pattern).

## Proposed changes

**`packages/engines/src/engines/copilot/index.ts`:**
- Remove the single-file `.github/copilot-instructions.md` write.
- Write individual files to `.github/prompts/relic.<name>.prompt.md` for each prompt name.
- Each file should include a YAML frontmatter block:
  ```yaml
  ---
  description: Relic <name> command
  ---
  ```
  followed by the prompt body from `ENGINE_TEMPLATES[`prompts/<name>.md`]`.
- Update console output to list `.github/prompts/relic.*.prompt.md`.

**`packages/engines/src/engines/codex/index.ts`:**
- Remove the single-file `.codex/instructions.md` write.
- Write individual files to `.codex/commands/relic.<name>.md` for each prompt name.
- No frontmatter required; write the prompt body directly.
- Update console output to list `.codex/commands/relic.*.md`.

**`packages/engines/src/__tests__/add-engine.test.ts`:**
- Update Copilot assertions: `.github/prompts/` created with correct file count; each file contains YAML frontmatter and prompt content. Remove assertion for `.github/copilot-instructions.md`.
- Update Codex assertions: `.codex/commands/` created with correct file count. Remove assertion for `.codex/instructions.md`.

**Plan update (`specs/002-agent-permission-config/plan.md`):**
- Update Phase 2 steps 3 and 4 to reflect per-file output pattern.
- Update the template flow diagram to show `.github/prompts/relic.*.prompt.md` and `.codex/commands/relic.*.md`.
- Update Phase 5 test assertions to match new file structure.

## Contract impact

None. No shared artifacts define the output file structure of the engines. The `TemplateDomain.md` artifact describes the template embedding pipeline, not the output paths — no change required there.

## Changelog draft

**[fix] 002-agent-permission-config — copilot/codex per-command file structure**

Corrected Copilot engine to write individual `.github/prompts/relic.<name>.prompt.md` files (one per command, with YAML frontmatter) instead of a single `.github/copilot-instructions.md`. Corrected Codex engine to write individual `.codex/commands/relic.<name>.md` files instead of a single `.codex/instructions.md`. Both engines now match the Claude pattern of one file per slash command. Classification: misspecification — FR-6 in spec 002 incorrectly prescribed single-file output. No contract changes.
