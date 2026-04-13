# ManifestJsonContract

**Type:** contract
**Inferred from:** packages/core/src/commands/search.ts, packages/core/src/commands/validate.ts, packages/core/src/types.ts
**Confidence:** high

## Description
The `manifest.json` file in each `shared/<subdir>/` directory. An index of all artifact files in that subdirectory. Required by `relic validate` for any subdirectory that contains `.md` files.

## Shape
```json
[
  {
    "name": "UserAuth",
    "file": "UserAuth.md",
    "tldr": "Handles user authentication and session tokens.",
    "tags": ["auth", "session", "token", "user"]
  }
]
```

**Rules:**
- Must be a JSON array (not an object)
- Every `.md` file in the subdirectory must have a corresponding entry (or `relic validate` fails)
- `tags` are lowercase keywords used for scoring in `relic search`
- `tldr` is loaded by `relic deep-search` so the AI can triage artifacts without reading each file

## Consumers
- `relic search <keywords>` — scores entries by tag overlap with query keywords
- `relic deep-search` — returns all entries across all subdirs for LLM triage
- `relic validate` — checks that all `.md` files are registered

## Owned by
(unowned — assign when a spec takes responsibility)
