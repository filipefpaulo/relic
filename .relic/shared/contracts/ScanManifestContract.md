# ScanManifestContract

**Type:** contract
**Inferred from:** packages/core/src/commands/scan.ts
**Confidence:** high

## Description
The JSON manifest produced by `relic scan --json`. This is the contract between the CLI scan command and the `/relic.scan` AI workflow. The AI uses this manifest to navigate the codebase efficiently without manual filesystem exploration.

## Shape
```json
{
  "project_dir": "<absolute path>",
  "relic_dir": "<absolute path>",
  "tech_stack": ["node", "typescript"],
  "key_files": [
    { "path": "<relative path>", "role": "entry_point|types|schema|config|routes|middleware|..." }
  ],
  "file_tree": "<string — depth-4 tree, max 200 entries>",
  "existing_artifacts": {
    "domains": ["shared/domains/Foo.md"],
    "contracts": [],
    "rules": [],
    "assumptions": []
  },
  "stats": {
    "total_files": 88,
    "excluded": ["node_modules", ".git", ...]
  }
}
```

## Consumers
- `/relic.scan` AI workflow (Step 0) — reads this before exploring any files
- Any future tooling that needs a project overview without walking the filesystem

## Owned by
(unowned — assign when a spec takes responsibility)
