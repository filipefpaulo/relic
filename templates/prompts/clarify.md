# /relic.clarify

> **Before proceeding:** Read `.relic/preamble.md`. It defines where artifacts belong.
> Violating those rules cannot be undone by a changelog entry.

## Before you begin — run these first

```bash
# 1. Resolve paths and check what exists
bash .relic/scripts/check-context.sh --spec <your-spec-id> --json

# 2. Validate shared brain integrity
bash .relic/scripts/validate-artifacts.sh --json
```

Do not proceed if `validate-artifacts.sh` reports `"valid": false`.

You are appending details, changing contracts, or adding behaviors to an existing spec.

## Before you begin

1. Read `.relic/constitution.md`.
2. Read `specs/{{SPEC_ID}}/spec.md` fully.
3. Read `specs/{{SPEC_ID}}/artifacts.json`.
4. Load all referenced shared artifacts.

## Intersection check (mandatory)

Before making any changes, check all other specs' `artifacts.json` files:
- Does the change you're about to make affect an artifact owned by another spec?
- Does it add files to `touches_files` that another spec already owns?

If yes, flag the intersection explicitly and do not proceed until resolved.

## Your task

Apply the user's clarification to `spec.md`:
- Update requirements, user stories, scope, or decisions as needed.
- If a shared artifact changes, update it and write a changelog entry.
- Update `artifacts.json` if ownership or file touches change.

## After changes

Write a changelog entry to `.relic/changelog.md`:
```
[clarify] {{SPEC_ID}}: [description of what changed and why]
```
