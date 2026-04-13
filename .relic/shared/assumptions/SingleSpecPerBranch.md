# SingleSpecPerBranch

**Type:** assumption
**Inferred from:** packages/core/src/utils/spec-id.ts, packages/core/src/commands/fix.ts
**Confidence:** medium

## Description
The branch-based spec inference assumes that a git branch name embeds at most one spec ID, and that the branch is named after the spec being worked on (e.g. `001-auth`). This is the basis for the lowest-priority spec resolution step.

## Risk if wrong
- If a developer names branches differently (e.g. `feature/auth` or `jira-AUTH-123`), branch inference silently returns null and falls back to requiring `--spec` or `RELIC_SPEC`
- If multiple specs are worked on in one branch, the wrong spec may be inferred

## Staleness signal
- If the team adopts a different branch naming convention that doesn't include `NNN-slug` patterns
- If `inferSpecFromBranch` is updated to handle more patterns

## Owned by
(unowned — assign when a spec takes responsibility)
