# FixDomain

**Type:** domain
**Owned by:** 003-fix-solve-workflow
**Confidence:** high

## Description

The bounded context governing the two-stage fix-and-solve pipeline. A fix is a diagnosed
issue tied to an owning spec, stored as a document pending human review before application.

## Key Entities

- **Fix**: A diagnosed issue. Has an ID, an owning spec, a root cause classification,
  a proposed set of changes, and a status (`pending-approval` | `approved` | `solved`).
- **Fix ID**: Format `YYYY-MM-DD-<slug>` (e.g. `2026-04-13-null-session-crash`). Slug is
  derived from the issue description, lowercase, hyphenated, max 6 words.
- **Fix document**: A markdown file at `.relic/fixes/<fix-id>.md`. Committed to version
  control — it is audit trail. Schema defined in `FixDocumentContract`.
- **`current-fix`**: A gitignored single-line file at `.relic/current-fix` holding the
  active fix ID. Session state — personal, not shared. Parallel to `current-spec`.
- **Root cause classification**: One of `code-bug`, `misspecification`, `misunderstanding`,
  `wrong-spec`.

## Session State Precedence

When `.relic/current-fix` exists, it takes precedence over `current-spec` for:
- `/relic.clarify` — operates on the owning spec of the fix
- `/relic.analyse` — operates on the owning spec of the fix
- `/relic.fix` — uses active fix context
- `/relic.solve` — applies the active fix

`current-spec` is unaffected and retains its own value. Clearing `current-fix` (done by
`/relic.solve` on completion) returns all commands to the `current-spec` context.

## Fix Lifecycle

```
/relic.fix <issue>
    ↓
Ownership check (touches_files prefix scan)
    ↓ no owner found → stop; advise /relic.specify
    ↓ owner found
Diagnosis (classify root cause)
    ↓
Write .relic/fixes/<fix-id>.md  (status: pending-approval)
Write .relic/current-fix
    ↓  [human review: read fix doc, optionally /relic.clarify]
Set status: approved in fix doc
    ↓
/relic.solve
    ↓
Apply code changes + spec amendments + changelog
Set status: solved in fix doc
Delete .relic/current-fix
```

## Relationships

- Extends `SpecResolutionDomain` — fix session state sits above spec session state in precedence
- Operates within `SpecDomain` — every fix is tied to exactly one owning spec
- Governed by `ChangelogAppendOnlyRule` — `/relic.solve` always writes a changelog entry
