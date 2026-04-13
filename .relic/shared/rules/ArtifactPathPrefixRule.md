# ArtifactPathPrefixRule

**Type:** rule
**Inferred from:** packages/core/src/commands/validate.ts, packages/core/src/core/context-builder.ts
**Confidence:** high

## Description
All artifact references in `artifacts.json` (`owns` and `reads` arrays) must use paths that start with `shared/`. Absolute paths or paths outside `shared/` are invalid.

## Enforcement
- `runValidate()`: checks each path in `owns` and `reads`; reports `invalid_paths` for any that don't start with `shared/`
- `buildContext()`: skips any artifact reference that doesn't start with `shared/` when assembling LLM context

## Exceptions
- `touches_files` is exempt — these reference user codebase paths, not Relic artifacts, so they don't need the `shared/` prefix

## Owned by
(unowned — assign when a spec takes responsibility)
