# SessionStateContract

**Type:** contract
**Owned by:** 003-fix-solve-workflow
**Confidence:** high

## Description

Schema for `.relic/session.json` — the single gitignored file that holds all personal
session state for a Relic workspace. Both fields are always present; null when not set.
File is created by `relic init`.

## Shape

```json
{
  "spec": "001-auth",
  "fix": "2026-04-13-null-session-crash"
}
```

| Field | Type | Set by | Cleared by |
|---|---|---|---|
| `spec` | `string \| null` | `relic use <spec-id>` | `relic use --clear` (future) |
| `fix` | `string \| null` | `relic use --fix <fix-id>` | `/relic.solve` on completion |

## Write Rules

- Writes are always read-merge: load existing `session.json` (or default `{spec:null,fix:null}`),
  update only the relevant field, write back.
- Never overwrite the entire file in a single write — preserve unrelated fields.
- File is initialised by `relic init`. All reads may assume it exists.

## Gitignore

`.relic/session.json` is listed in `.relic/.gitignore`. It is personal session state —
each team member's active spec and fix are their own.
