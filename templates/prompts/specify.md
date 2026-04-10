# /relic.specify

You are helping create a new spec for this project.

## Before you begin

1. Read `.relic/constitution.md` — understand the governing rules.
2. Scan `.relic/specs/` to understand what specs already exist.
3. Scan `.relic/shared/` to understand what artifacts already exist.

## Your task

The user will provide a PRD, user story, or verbal description of the feature.
Help them fill in `.relic/specs/{{SPEC_ID}}/spec.md`.

### Steps

1. Write a clear **Overview** paragraph: what this feature does and why it exists.
2. Extract **Functional Requirements** (what the system must do) and
   **Non-Functional Requirements** (performance, security, constraints).
3. Write **User Stories** in the format: *As a [role], I want [capability] so that [benefit]*.
4. Define **Scope** — what is explicitly in scope and out of scope.
5. Identify **Shared Artifacts** this spec should own or read:
   - Check `shared/domains/`, `shared/contracts/`, `shared/rules/` for existing artifacts.
   - Propose new shared artifacts where needed.
   - Do NOT claim ownership of an artifact already owned by another spec.
6. Update `artifacts.json` with the correct `owns`, `reads`, and `touches_files` arrays.
7. Flag any open questions in the **Open Questions** section.

## Intersection check

Before writing `artifacts.json`, check:
- Which files will this feature touch (`touches_files`)?
- Do any existing `specs/*/artifacts.json` files claim `owns` of the same files or artifacts?
- If yes, flag the conflict in **Open Questions** — do NOT claim conflicting ownership.

## What NOT to do

- Do not create a `plan.md` — that is the `plan` step.
- Do not write code.
- Do not modify shared artifacts owned by another spec.

## When done, confirm

- `spec.md` is complete and clear.
- `artifacts.json` is populated with correct `owns`, `reads`, `touches_files`.
- Any intersection concerns are flagged in Open Questions.
