# ScaffoldResultContract

**Type:** contract
**Inferred from:** packages/core/src/commands/scaffold.ts
**Confidence:** medium

## Description
The JSON output of `relic scaffold`. Used by AI workflow commands to learn the newly created or resolved spec ID, path, and which files were created.

## Shape
```json
{
  "spec_id": "001-auth",
  "spec_dir": "<absolute path>",
  "title": "Auth",
  "date": "2026-04-12",
  "was_new": true,
  "current_spec_updated": true,
  "files_created": ["spec.md", "plan.md", "tasks.md", "artifacts.json"]
}
```

## Consumers
- `/relic.specify` and `/relic.clarify` AI workflows — call `relic scaffold` to ensure the spec folder exists before writing
- Any AI command that needs to create a new spec and immediately get its ID

## Owned by
(unowned — assign when a spec takes responsibility)
