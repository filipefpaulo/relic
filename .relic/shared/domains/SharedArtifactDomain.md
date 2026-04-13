# SharedArtifactDomain

**Type:** domain
**Inferred from:** packages/core/src/types.ts, packages/core/src/commands/validate.ts, packages/core/src/commands/search.ts
**Confidence:** high

## Description
The shared knowledge layer — the "brain" of Relic. Artifacts (domains, contracts, rules, assumptions) that exist independently of any single spec and are discovered via `scan` or created during `specify`/`clarify`. Every spec declares its relationship to these artifacts via `artifacts.json`.

## Key Entities
- **SharedSubdir**: One of four categories — `domains`, `contracts`, `rules`, `assumptions`
- **ManifestEntry**: An index entry in `manifest.json` — `name`, `file`, `tldr`, `tags[]`
- **SearchResult**: A `ManifestEntry` augmented with a `path` and `score` for keyword search results
- **ArtifactsJson**: The per-spec declaration of `owns[]`, `reads[]`, and `touches_files[]`

## Relationships
- Owned/read by SpecDomain — specs declare `owns` (exclusive) and `reads` (unrestricted) over artifacts
- Governed by IntersectionDomain — ownership conflicts between specs are detected here
- Indexed by SearchDomain — `manifest.json` files drive keyword and deep-search

## Owned by
(unowned — assign when a spec takes responsibility)
