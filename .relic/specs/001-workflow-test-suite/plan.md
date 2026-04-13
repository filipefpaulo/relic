# Plan: Workflow Test Suite

**Spec ID:** 001-workflow-test-suite
**Status:** ready

---

## Architecture Overview

All test files live in a single `packages/core/src/__tests__/` directory, named after the module under test. Tests import directly from source files (TypeScript path imports, resolved by Bun). No build step is required to run tests — Bun executes TypeScript natively.

Two test categories:
- **Unit tests** — pure functions with no I/O (`spec-id`, `intersection`, `changelog` append/filter logic). No temp directory needed.
- **Integration tests** — any function that reads or writes the filesystem. Uses `mkdtempSync` to create a real isolated directory per test, cleaned up in `afterEach`. No `fs` mocking.

One special case:
- **Scan smoke test** — `runScan` runs against the real project directory (not a temp dir), asserting only that the output has the expected JSON shape. `scan.ts` uses `readdirSync` directly which makes temp-dir isolation impractical.

`process.exit` constraint: several commands call `process.exit(1)` on error. Since the constitution forbids mocking, error paths that call `process.exit` are **not tested**. Only success paths and outputs are asserted.

The CI workflow mirrors the pattern of the existing `publish-npm.yml`: `actions/checkout` + `oven-sh/setup-bun` + `bun install` + test command. No Node.js setup is needed (tests run under Bun, not Node).

---

## Implementation Phases

### Phase 1 — Infrastructure
1. Add `"test": "bun test src/__tests__"` to the `scripts` section of `packages/core/package.json`. The path is relative to the package root, scoping Bun's discovery to the test directory only.
2. Add `"test": "bun run --filter '*' test"` to the `scripts` section of the root `package.json`. This uses Bun's workspace filter to delegate to every workspace package that defines a `test` script. New packages with tests automatically participate without changing the root script.

### Phase 2 — Pure unit tests (no I/O)
2. Create `__tests__/spec-id.test.ts` — tests for `slugify`, `nextSpecId`, `inferSpecFromBranch`, `availableSpecs`. `nextSpecId` and `availableSpecs` require a directory, so use a temp dir for those two functions.
3. Create `__tests__/intersection.test.ts` — tests for `detectIntersections` and `formatIntersectionReport` using in-memory `SpecMeta` objects.

### Phase 3 — Integration tests for core utilities (temp dir)
4. Create `__tests__/fs.test.ts` — tests for `fileExists`, `dirExists`, `findRelicDir`. All operate on a real temp directory.
5. Create `__tests__/changelog.test.ts` — tests for `appendChangelog` (creates file, appends on repeat) and `filterChangelog` (spec-scoped filtering, missing file returns `""`).
6. Create `__tests__/context-builder.test.ts` — tests for `buildContext` (minimal `.relic/`, with spec, with artifacts) and `renderContext` (section headings present, correct order).

### Phase 4 — Integration tests for simple commands (temp dir)
7. Create `__tests__/init.test.ts` — success path: expected dirs and files created. Repeat without `--force` must not overwrite. Repeat with `--force` must succeed.
8. Create `__tests__/use.test.ts` — writes spec ID to `current-spec`; second call overwrites.
9. Create `__tests__/scaffold.test.ts` — `--title` path creates spec with correct `NNN-slug` ID; `--spec` path on existing spec skips file creation; both paths write `current-spec`.

### Phase 5 — Integration tests for complex commands (temp dir)
10. Create `__tests__/validate.test.ts` — one passing scenario (valid setup), then one failing scenario per validation category: missing manifest, unregistered file, ownership conflict, missing owned artifact, illegal spec-dir file.
11. Create `__tests__/context.test.ts` — spec resolved from `--spec` arg; spec resolved from `current-spec` file; file existence flags reported correctly in JSON output.
12. Create `__tests__/search.test.ts` — `runSearch` returns scored matches; returns `[]` on no match; `runDeepSearch` returns all entries across all subdirs.

### Phase 6 — Scan smoke test
13. Create `__tests__/scan.test.ts` — call `runScan` against the real project directory with `json: true` and capture stdout. Parse and assert: output is valid JSON; top-level keys `project_dir`, `tech_stack`, `key_files`, `file_tree`, `existing_artifacts`, `stats` all present; `tech_stack` is non-empty.

### Phase 7 — CI workflow
14. Create `.github/workflows/test.yml` — triggers on `pull_request` (all target branches). Single job on `ubuntu-latest`: checkout → setup-bun (latest) → `bun install` → `bun run test`. No Node.js setup required. Minimal permissions (`contents: read`).

---

## File Changes

| File | Action | Notes |
|------|--------|-------|
| `packages/core/package.json` | modify | Add `"test": "bun test src/__tests__"` to `scripts` |
| `package.json` | modify | Add `"test": "bun run --filter '*' test"` workspace dispatcher to `scripts` |
| `packages/core/src/__tests__/spec-id.test.ts` | create | Unit + minimal temp dir for `nextSpecId`/`availableSpecs` |
| `packages/core/src/__tests__/intersection.test.ts` | create | Pure unit — in-memory fixtures |
| `packages/core/src/__tests__/fs.test.ts` | create | Integration — temp dir |
| `packages/core/src/__tests__/changelog.test.ts` | create | Integration — temp dir |
| `packages/core/src/__tests__/context-builder.test.ts` | create | Integration — temp dir, minimal `.relic/` scaffold |
| `packages/core/src/__tests__/init.test.ts` | create | Integration — temp dir |
| `packages/core/src/__tests__/use.test.ts` | create | Integration — temp dir |
| `packages/core/src/__tests__/scaffold.test.ts` | create | Integration — temp dir |
| `packages/core/src/__tests__/validate.test.ts` | create | Integration — temp dir, multiple fixture scenarios |
| `packages/core/src/__tests__/context.test.ts` | create | Integration — temp dir |
| `packages/core/src/__tests__/search.test.ts` | create | Integration — temp dir with manifest fixtures |
| `packages/core/src/__tests__/scan.test.ts` | create | Smoke — runs against real project dir |
| `.github/workflows/test.yml` | create | PR trigger, ubuntu-latest, bun test |

---

## Shared Artifact Changes

| Artifact | Action | Notes |
|----------|--------|-------|
| `shared/rules/TestingRules.md` | none | Already reflects all decisions from specify + clarify |

---

## Intersection Notes

No other specs exist. No conflicts. `.github/workflows/test.yml` is a new file not touched by any other spec.

---

## Changelog Reference

See entry dated `2026-04-12T00:02:00.000Z` below.
