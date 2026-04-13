# ArtifactsJsonContract

**Type:** contract
**Inferred from:** packages/core/src/types.ts, packages/core/src/core/artifact-registry.ts, packages/core/src/commands/validate.ts
**Confidence:** high

## Description
The `artifacts.json` file in each spec directory. Declares the spec's relationship to shared artifacts. This is the foundational contract that enables intersection detection and context assembly.

## Shape
```json
{
  "owns": ["shared/domains/UserAuth.md", "shared/contracts/AuthAPI.md"],
  "reads": ["shared/rules/SessionRules.md"],
  "touches_files": ["src/auth/", "src/middleware/auth.ts"]
}
```

**Rules:**
- All paths in `owns` and `reads` must start with `shared/`
- A given artifact path can only appear in one spec's `owns` (ownership conflict otherwise)
- `reads` is unrestricted — any spec can read any artifact
- `touches_files` overlap generates a warning (not a hard error) at `plan` time

## Consumers
- `relic validate` — checks path validity, file existence, and ownership conflicts
- `relic context` — reports which shared artifacts are referenced and whether they exist
- `context-builder.ts` — loads all `owns` + `reads` artifacts into the LLM context for `fix`, `plan`, etc.
- `artifact-registry.ts` — builds the global ownership map from all specs' `artifacts.json`

## Owned by
(unowned — assign when a spec takes responsibility)
