# Spec: Workflow Test Suite

**Spec ID:** 001-workflow-test-suite
**Created:** 2026-04-12
**Status:** draft

---

## Overview

Relic currently has no test suite. This spec introduces unit and integration tests for all workflow commands and core utilities in `packages/core/src/`, using Bun's built-in test runner. The goal is to make the business logic verifiable without requiring an AI agent to run it, to catch regressions during development, and to establish a test pattern that future specs can follow when adding new commands. All test files live in `packages/core/src/__tests__/`.

---

## Requirements

### Functional Requirements

- FR-1: Every pure function in `packages/core/src/utils/` and `packages/core/src/core/` must have unit tests covering the happy path and key edge cases.
- FR-2: Every `run*` command in `packages/core/src/commands/` must have integration tests that operate on a real temporary directory — no mocking of file I/O.
- FR-3: `bun test` must pass with zero failures before any spec's implementation is considered complete.
- FR-4: A `test` script must be added to `packages/core/package.json` that runs the suite for that package (`bun test src/__tests__`). The root `package.json` must have a `test` script that delegates to all workspace packages that define one (`bun run --filter '*' test`), so `bun run test` at the monorepo root works as a single entry point.
- FR-5: Tests that create files must use a temporary directory (e.g. via `mkdtemp`) and clean up after themselves.
- FR-6: A GitHub Actions workflow (`.github/workflows/test.yml`) must run `bun run test` on every pull request targeting any branch, and block merging if any test fails.

### Non-Functional Requirements

- NFR-1: Tests must not depend on the state of the real `.relic/` directory in this repository.
- NFR-2: Tests must run in CI without any additional setup beyond `bun install`.
- NFR-3: No mocking of the `fs` module — integration tests hit a real (temp) filesystem per the constitution's testing approach.

---

## User Stories

- As a contributor, I want to run `bun test` and see all tests pass so that I can verify my changes haven't broken existing behaviour before opening a PR.
- As a contributor adding a new command, I want a clear test pattern to follow so that I know where to put my tests and how to structure them.
- As a future spec, I want an established `TestingRules` shared artifact I can read so that I know the project's test conventions without re-deriving them.

---

## Scope

### In Scope

- `packages/core/src/__tests__/` directory as the single home for all test files
- Unit tests for `packages/core/src/utils/spec-id.ts` — `slugify`, `nextSpecId`, `inferSpecFromBranch`, `availableSpecs`
- Unit tests for `packages/core/src/utils/fs.ts` — `fileExists`, `dirExists`, `findRelicDir`
- Unit tests for `packages/core/src/core/intersection.ts` — `detectIntersections`, `formatIntersectionReport`
- Unit tests for `packages/core/src/core/changelog.ts` — `appendChangelog`, `filterChangelog`
- Unit tests for `packages/core/src/core/context-builder.ts` — `buildContext`, `renderContext`
- Integration tests for `packages/core/src/commands/init.ts` — `runInit`
- Integration tests for `packages/core/src/commands/scaffold.ts` — `runScaffold`
- Integration tests for `packages/core/src/commands/context.ts` — `runContext`
- Integration tests for `packages/core/src/commands/validate.ts` — `runValidate`
- Integration tests for `packages/core/src/commands/search.ts` — `runSearch`, `runDeepSearch`
- Integration tests for `packages/core/src/commands/use.ts` — `runUse`
- A stub smoke test for `packages/core/src/commands/scan.ts` — verifies the manifest shape is valid JSON with the expected top-level keys, using a real project directory; does not attempt to isolate `readdirSync`
- A `shared/rules/TestingRules.md` artifact documenting test file location, structure, and temp-dir patterns for future specs
- `"test": "bun test src/__tests__"` script in `packages/core/package.json`
- `"test": "bun run --filter '*' test"` script in root `package.json` (workspace dispatcher)
- `.github/workflows/test.yml` — CI workflow that runs `bun run test` on every PR and blocks on failure

### Out of Scope

- Tests for `packages/cli-node/src/bin.ts` or `bin.debug.ts` (CLI entry points — tested indirectly via `run*` functions)
- Tests for `packages/cli-python/` (Python shim — no business logic)
- Tests for AI prompt templates (`templates/prompts/`)
- Tests for `commands/fix.ts` — will be rebuilt from scratch; excluded until that work is specified separately
- Tests for `commands/specify.ts`, `commands/clarify.ts`, `commands/plan.ts`, `commands/analyse.ts`, `commands/tasks.ts`, `commands/implement.ts` — debug-only stubs; real logic is in AI prompts
- Coverage thresholds (not established in the constitution yet)
- `scripts/embed-templates.ts` and build scripts

---

## Shared Artifacts

**Owns:**
- `shared/rules/TestingRules.md` — documents test file location conventions, temp-dir pattern, and the "no mock fs" rule for all future specs to read

**Reads:**
- `shared/assumptions/BunRuntimeAvailability.md` — tests depend on Bun being available in the dev and CI environment

---

## Open Questions

*(none)*

---

## Decisions

- **Test file location**: `packages/core/src/__tests__/` — single directory, not colocated. Keeps source tree clean given the volume of test files.
- **Test script location**: `packages/core/package.json` owns the actual test command. Root `package.json` uses `bun run --filter '*' test` to delegate to any workspace package that defines a `test` script — making the monorepo root the universal entry point without hardcoding package paths.
- **`scan.ts` coverage**: stub smoke test only — assert that `runScan` returns valid JSON with expected top-level keys when run against the real project directory. Full isolation not required.
- **`fix.ts`**: excluded from this spec. The command will be rebuilt from scratch under a separate spec; testing it now would be wasted work.
