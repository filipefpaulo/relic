# SpecIdNamingRules

**Type:** rule
**Inferred from:** packages/core/src/utils/spec-id.ts, packages/core/src/commands/scaffold.ts
**Confidence:** high

## Description
Rules governing spec ID format and generation. Spec IDs must be `NNN-slug` where `NNN` is a zero-padded three-digit number and `slug` is a lowercase hyphenated string derived from the spec title.

## Enforcement
- `slugify()`: converts title to lowercase, replaces non-alphanumeric runs with `-`, strips leading/trailing hyphens
- `nextSpecId()`: scans existing spec directories, finds the highest numeric prefix, increments by 1, zero-pads to 3 digits, appends the slug
- `inferSpecFromBranch()`: extracts a spec ID from a git branch name using regex `(\d{3}-[a-z0-9-]+)`
- `availableSpecs()`: filters spec directories to only those matching `^\d{3}-`

## Exceptions
- Branch inference is best-effort — if the branch name doesn't match `NNN-slug`, inference returns null and the next resolution priority is tried

## Owned by
(unowned — assign when a spec takes responsibility)
