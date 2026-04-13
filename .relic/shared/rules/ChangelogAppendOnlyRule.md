# ChangelogAppendOnlyRule

**Type:** rule
**Inferred from:** packages/core/src/core/changelog.ts, CLAUDE.md
**Confidence:** high

## Description
The `.relic/changelog.md` file is append-only. Every plan mutation and fix event writes a timestamped block. Existing entries must never be modified or deleted.

## Enforcement
- `appendChangelog()` in `changelog.ts`: reads existing content and appends a new block with ISO timestamp; never overwrites
- Format: `## [<ISO-timestamp>] <command> — <specId>\n\n<message>`
- `filterChangelog()` filters by spec ID when building context — does not mutate the file

## Exceptions
- There are no exceptions — the changelog is the audit trail and must remain complete

## Owned by
(unowned — assign when a spec takes responsibility)
