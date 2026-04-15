# ManifestJsonContract

**Type:** contract
**Owned by:** 005-toon-manifest-format
**Inferred from:** packages/core/src/commands/search.ts, packages/core/src/commands/validate.ts, packages/core/src/types.ts
**Confidence:** high

## Description
The per-subdirectory index of artifact files in `shared/<subdir>/`. Exists in two formats:
`manifest.toon` (preferred, token-efficient) and `manifest.json` (legacy fallback). Both
encode the same `ManifestEntry` shape. `manifest.toon` takes priority when both exist.
See `ToonFormatContract` for the toon line format.

## ManifestEntry shape

```typescript
type ManifestEntry = {
  name: string;   // artifact name — matches the # Heading in the file
  file: string;   // filename only, no path
  tldr: string;   // one sentence — precise enough to decide relevance without reading the file
  tags: string[]; // lowercase keywords, 4–8 per artifact
}
```

**JSON array form (`manifest.json`):**
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

**Toon form (`manifest.toon`):**
```
# domains manifest
UserAuth | UserAuth.md | auth session token user | Handles user authentication and session tokens.
```

## Rules
- Every `.md` file in the subdirectory must have a corresponding entry (`relic validate` fails otherwise)
- `tags` are lowercase keywords used for scoring in `relic search`
- `tldr` is loaded by `relic deep-search` so the AI can triage artifacts without reading each file
- `manifest.toon` takes priority over `manifest.json` when both are present

## Consumers
- `relic search <keywords>` — scores entries by tag overlap with query keywords
- `relic deep-search` — returns all entries across all subdirs for LLM triage
- `relic validate` — checks that all `.md` files are registered
