# BunRuntimeAvailability

**Type:** assumption
**Inferred from:** package.json, scripts/publish.ts, scripts/embed-templates.ts
**Confidence:** medium

## Description
The development environment assumes Bun is installed and available as the primary runtime for building, testing, and running scripts. The production npm bundle targets Node.js 18+ specifically to avoid this dependency for end users, but all local dev and CI build steps require Bun.

## Risk if wrong
- Build commands (`bun build`, `bun run`) fail in CI or on developer machines without Bun
- The `scripts/publish.ts` shebang (`#!/usr/bin/env bun`) fails if only Node.js is available

## Staleness signal
- If the CI environment removes Bun or switches to a different bundler
- If a `package.json` `scripts` field is changed to use `node` or `npx` instead of `bun`

## Owned by
(unowned — assign when a spec takes responsibility)
