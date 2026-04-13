# SpecFilesAllowlistRule

**Type:** rule
**Inferred from:** packages/core/src/commands/validate.ts
**Confidence:** high

## Description
Only four files are permitted in a spec directory: `spec.md`, `plan.md`, `tasks.md`, and `artifacts.json`. Any other file is flagged as an illegal file by `relic validate`.

## Enforcement
- `runValidate()` reads each spec directory and checks every file against `ALLOWED_SPEC_FILES = {"spec.md", "plan.md", "tasks.md", "artifacts.json"}`
- Illegal files are reported as validation failures

## Exceptions
- None — this is a hard constraint to keep spec directories clean and predictable

## Owned by
(unowned — assign when a spec takes responsibility)
