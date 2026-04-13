# SpecResolutionDomain

**Type:** domain
**Inferred from:** packages/core/src/commands/context.ts, packages/core/src/commands/fix.ts, packages/core/src/commands/scaffold.ts, packages/core/src/utils/spec-id.ts
**Confidence:** high

## Description
The logic for determining which spec is "active" for any given command. Implements a four-level priority chain: explicit arg > env var > `.relic/current-spec` file > git branch inference.

## Key Entities
- **Active spec source**: One of `arg`, `env`, `current-spec`, or `git-branch`
- **`RELIC_SPEC` env var**: Priority 2 override; useful in CI and scripted workflows
- **`.relic/current-spec`**: A gitignored single-line file written by `relic use`; priority 3
- **Branch inference**: Extracts `NNN-slug` from the current git branch name; priority 4
- **`inferSpecFromBranch`**: Regex `(\d{3}-[a-z0-9-]+)` extracts spec ID from branch name

## Relationships
- Used by SpecDomain — all commands that need an active spec delegate to this domain
- Written by `relic use` / `runUse` — sets `.relic/current-spec`
- Read by `context`, `scaffold`, `fix`, `clarify`, `plan`, `analyse`, `tasks`, `implement`

## Owned by
(unowned — assign when a spec takes responsibility)
