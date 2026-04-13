# DistributionDomain

**Type:** domain
**Inferred from:** scripts/publish.ts, packages/cli-node/src/bin.ts, packages/cli-python/pyproject.toml, .github/workflows/publish-npm.yml, .github/workflows/publish-pypi.yml
**Confidence:** medium

## Description
The packaging, versioning, and publishing domain. Manages the two distribution channels (npm and PyPI), the unified publish script, and the CI workflows that build and sign platform binaries.

## Key Entities
- **npm package**: `relic-cli` — Node.js bundle (~186 KB); requires Node.js 18+; built via `bun build --target node`
- **PyPI package**: `relic-cli` — platform-specific wheels with pre-compiled Bun binaries; no runtime required
- **publish script** (`scripts/publish.ts`): Bumps 6 version files, creates a `release/vX.Y.Z` branch, commits, tags, and pushes; CI does the rest
- **Version files**: `package.json`, `packages/cli-node/package.json`, `bin.ts`, `bin.debug.ts`, `pyproject.toml`, `__init__.py`
- **Tag conventions**: `vX.Y.Z` triggers both npm and PyPI; `vX.Y.Z-npm` npm only; `vX.Y.Z-pypi` PyPI only

## Relationships
- Depends on BuildDomain — the Node.js bundle and Bun binaries must be built before publishing
- Governed by the release workflow: `bun run publish <version>` is the single entry point

## Owned by
(unowned — assign when a spec takes responsibility)
