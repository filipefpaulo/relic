# ChangelogAppendOnlyRule

**Type:** rule
**Owned by:** 006-structured-write-command
**Amended by:** 006-structured-write-command (2026-04-15)

## Description
The `.relic/changelog.md` file is append-only and exists solely as an audit trail for **cross-artifact mutations** — events where one command amends an artifact that was created or owned by a different command. Existing entries must never be modified or deleted.

## When to write a changelog entry

Write a changelog entry **only** when a cross-artifact mutation has occurred:

| Triggering event | Example |
|---|---|
| `fix` amends a spec | A fix reveals the spec's stated behaviour was wrong; spec.md is updated |
| `clarify` changes a contract | Clarification alters an API shape or rule owned by this spec |
| `specify` amends the constitution | New spec requires a constitutional amendment |
| `fix` changes a shared contract | The fix cannot be applied without altering a cross-spec contract |

**Must not** write a changelog entry for:
- Creating new artifacts (spec, contract, domain, rule) for the first time
- Updating a toon index or manifest file
- Completing or progressing through a workflow step
- Running `analyse`, `tasks`, or `implement` without a contract change

## Enforcement
- All writes to changelog.md must go through `relic write --changelog --payload '...'`
- Direct edits to changelog.md by the LLM are prohibited
- `filterChangelog()` in `changelog.ts` remains read-only — it never mutates the file

## Entry format

```
## [<ISO-date>] <slash-command> — <name>

<description body>
```

- `ISO-date`: full ISO 8601 timestamp, e.g. `2026-04-15T14:32:00.000Z`
- `slash-command`: the command that triggered the mutation, e.g. `/relic.fix`, `/relic.clarify`. Defaults to `/relic.write` if omitted.
- `name`: short label identifying what was changed
- `description body`: one or more paragraphs explaining what changed and why

## Example

```markdown
## [2026-04-15T14:32:00.000Z] /relic.fix — AuthAPI contract: session expiry field added

Fix for null-session crash required adding `expiresAt` to the AuthAPI response shape.
AuthAPI.md updated; all specs reading this contract flagged for review.
```

## Migration note
Entries written before 2026-04-15 (prior to spec 006) use the legacy format
`## [<ISO>] <command> — <specId>`. These are left untouched; both formats
coexist in the file. New entries always use the format above.
