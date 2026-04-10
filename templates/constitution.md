# Project Constitution

> This document governs every AI-assisted interaction in this project.
> It may only be amended with explicit project owner approval.
> Amendments are appended below — old versions are never deleted.

---

## Core Principles

1. **Respect ownership.** Never modify a shared artifact you do not own.
   Check `artifacts.json` to determine ownership before editing anything in `.relic/shared/`.

2. **Flag intersections.** If your implementation touches a file that another spec
   owns or touches, raise it explicitly before proceeding.

3. **Never bypass the plan.** If you discover the plan is wrong or incomplete,
   update `plan.md` and write a changelog entry — do not silently deviate.

4. **Changelog is mandatory.** Every plan mutation, contract change, or significant
   architectural decision must be written to `.relic/changelog.md`.

5. **Assumptions must be declared.** If you make an assumption not in the spec,
   write it to `.relic/shared/assumptions/` before it influences any code.

6. **The spec is the source of truth.** If code and spec disagree, the spec is right —
   unless a `clarify` has been run that updates the spec.

---

## Amendments

*No amendments yet. Append below with date and approval note.*
