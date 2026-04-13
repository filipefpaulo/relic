# ArtifactOwnershipRules

**Type:** rule
**Inferred from:** packages/core/src/core/intersection.ts, packages/core/src/commands/validate.ts, packages/core/src/types.ts
**Confidence:** high

## Description
The invariants governing artifact ownership across specs. Ownership is exclusive — only one spec can own a given shared artifact at a time. These rules are enforced by `relic validate` and checked at `plan` time.

## Enforcement
- `intersection.ts` → `detectIntersections()`: compares all specs' `owns` arrays; any path claimed by two specs is flagged as an `OwnershipConflict`
- `validate.ts` → `runValidate()`: builds a full ownership map and reports conflicts as blocking errors
- Validated at `plan` time (principal intersection discovery) and on demand via `relic validate`

## Exceptions
- `reads` is unrestricted — any spec can read any artifact without conflict
- File overlap in `touches_files` generates a warning but is not a blocking error (two specs can touch the same file, though it's a code smell)

## Owned by
(unowned — assign when a spec takes responsibility)
