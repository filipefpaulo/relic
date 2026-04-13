# GitAvailability

**Type:** assumption
**Inferred from:** packages/core/src/commands/context.ts, packages/core/src/commands/fix.ts, packages/core/src/commands/scaffold.ts
**Confidence:** medium

## Description
Branch inference (priority 4 in spec resolution) assumes `git` is installed and available in `$PATH`, and that the working directory is inside a git repository. All three command files catch the error silently and fall through to the next priority if git is unavailable.

## Risk if wrong
- In environments without git (containers, some CI setups), branch inference silently fails — not an error, just no inference
- If git is unavailable and no other resolution priority applies, the command errors with a helpful message listing available specs

## Staleness signal
- If the project moves to a different VCS and branch-based inference needs to be replaced

## Owned by
(unowned — assign when a spec takes responsibility)
