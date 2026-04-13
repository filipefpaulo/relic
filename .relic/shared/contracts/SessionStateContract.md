# SessionStateContract

**Type:** contract
**Owned by:** 003-fix-solve-workflow
**Confidence:** high

## Description

Schema for `.relic/session.json` — the single gitignored file that holds all personal
session state for a Relic workspace. Supersedes `.relic/current-spec` (plain text).
Both fields are always present; null when not set.

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
- File is created on first write if it does not exist.

## Backwards Compatibility

If `session.json` does not exist, `relic context` falls back to reading `.relic/current-spec`
(plain text, spec ID only) for the `spec` field. New writes always go to `session.json`.
`current-spec` remains gitignored for users upgrading from older Relic versions.

## Gitignore

`.relic/session.json` is listed in `.relic/.gitignore`. It is personal session state —
each team member's active spec and fix are their own.
