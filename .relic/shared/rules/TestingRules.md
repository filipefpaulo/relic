# TestingRules

**Type:** rule
**Inferred from:** `.relic/constitution.md`, `packages/core/src/` structure
**Confidence:** high

## Description
Project-wide conventions for writing tests in Relic. Established by spec `001-workflow-test-suite`. All future specs that add test files must follow these patterns.

## Enforcement

**Runner:** Bun's built-in test runner (`bun test`). No Jest, Vitest, or other framework.

**Script location:** Each package that has tests owns its own `"test"` script in its `package.json` (e.g. `packages/core/package.json`: `"test": "bun test src/__tests__"`). The root `package.json` uses `"test": "bun run --filter '*' test"` to delegate to all workspace packages that define the script. When adding tests to a new package, add the `test` script to that package's `package.json` — the root dispatcher picks it up automatically.

**File location:** All test files live in `packages/core/src/__tests__/`, named after the module under test.
- `packages/core/src/utils/spec-id.ts` → `packages/core/src/__tests__/spec-id.test.ts`
- `packages/core/src/commands/init.ts` → `packages/core/src/__tests__/init.test.ts`

**Unit vs integration:**
- **Unit tests** — for pure functions (no I/O): test directly, no temp directory needed.
- **Integration tests** — for `run*` commands and file I/O utilities: use a real temporary directory created with `mkdtemp`. Never mock `fs`.

**Temp directory pattern:**
```typescript
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "relic-test-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });
```

**What to test:** The `run*` functions exported from `@relic/core`, not the CLI entry points (`bin.ts`, `bin.debug.ts`).

**What not to test:** AI prompt commands (`fix`, `specify`, `clarify`, `plan`, `analyse`, `tasks`, `implement`) — these are debug stubs; their logic lives in prompt templates.

## Exceptions
- `scan.ts` uses `readdirSync` directly rather than `fs.ts` utilities. Use a stub smoke test: run `runScan` against the real project directory and assert the output is valid JSON with the expected top-level keys (`project_dir`, `tech_stack`, `key_files`, `file_tree`, `existing_artifacts`, `stats`). Full isolation is not required.
- Commands that will be rebuilt from scratch (e.g. `fix.ts`) should be excluded from the test suite until the rebuild spec is complete.

## Owned by
`001-workflow-test-suite`
