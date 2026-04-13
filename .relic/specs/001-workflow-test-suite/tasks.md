# Tasks: Workflow Test Suite

**Spec ID:** 001-workflow-test-suite
**Generated from plan:** 2026-04-12

---

## Phase 1 — Infrastructure

- [x] **T-01a** Add `"test": "bun test src/__tests__"` to the `scripts` section of `packages/core/package.json`
- [x] **T-01b** Add `"test": "bun run --filter '*' test"` to the `scripts` section of root `package.json`

---

## Phase 2 — Pure unit tests

- [x] **T-02** Create `packages/core/src/__tests__/spec-id.test.ts`
  - `slugify`: basic, spaces, special chars, leading/trailing hyphens stripped
  - `inferSpecFromBranch`: matching `NNN-slug` → returns id; non-matching → null
  - `nextSpecId`: empty dir → `001-slug`; dir with `001-foo` → `002-slug` (uses temp dir)
  - `availableSpecs`: returns only `NNN-*` entries, ignores others (uses temp dir)

- [x] **T-03** Create `packages/core/src/__tests__/intersection.test.ts`
  - Empty registry → no conflicts, no warnings
  - Two specs with distinct owned artifacts → no conflicts
  - Two specs owning the same artifact → conflict reported
  - Two specs with overlapping `touches_files` → warning reported
  - `formatIntersectionReport`: both sections rendered; empty report renders nothing

---

## Phase 3 — Core integration tests (temp dir)

- [x] **T-04** Create `packages/core/src/__tests__/fs.test.ts`
  - `fileExists`: true for file, false for dir, false for nonexistent
  - `dirExists`: true for dir, false for file, false for nonexistent
  - `findRelicDir`: finds `.relic/` when called from a nested subdir; returns null when not in a relic project

- [x] **T-05** Create `packages/core/src/__tests__/changelog.test.ts`
  - `appendChangelog`: creates file on first call; appends (does not overwrite) on second call
  - `filterChangelog`: returns only blocks matching specId; returns `""` for missing file; does not return blocks for other specIds

- [x] **T-06** Create `packages/core/src/__tests__/context-builder.test.ts`
  - `buildContext` with minimal `.relic/` (preamble + constitution only, no spec): preamble and constitution fields populated, spec/plan/artifacts null
  - `buildContext` with spec dir (spec.md + plan.md): spec and plan fields populated
  - `buildContext` with `artifacts.json` referencing existing shared artifacts: artifacts map populated
  - `buildContext` with `artifacts.json` referencing missing artifact: missing artifact silently skipped
  - `renderContext`: output contains `# Preamble`, `# Constitution`, `# Spec`, `# Plan` headings in order; `# Shared Artifact:` prefix used for artifact sections

---

## Phase 4 — Simple command integration tests (temp dir)

- [x] **T-07** Create `packages/core/src/__tests__/init.test.ts`
  - Success: all expected dirs created (`shared/domains/`, `shared/contracts/`, `shared/rules/`, `shared/assumptions/`, `specs/`)
  - Success: `preamble.md`, `constitution.md`, `changelog.md`, `.gitignore` written
  - Repeat without `--force`: exits (use try/catch around `runInit` — note: calls `process.exit`; test only the file-existence side-effects of the success path)
  - Repeat with `--force`: succeeds and overwrites

- [x] **T-08** Create `packages/core/src/__tests__/use.test.ts`
  - Writes specId to `.relic/current-spec`
  - Second call with different specId overwrites the first

- [x] **T-09** Create `packages/core/src/__tests__/scaffold.test.ts`
  - `--title` path: creates spec dir with correct `001-slug` ID; creates `spec.md`, `plan.md`, `tasks.md`, `artifacts.json`; writes `current-spec`
  - `--title` on second call: increments to `002-slug`
  - `--spec` on existing spec: dir already exists, no files recreated, `current-spec` still updated
  - Output is valid JSON matching `ScaffoldResultContract` shape

---

## Phase 5 — Complex command integration tests (temp dir)

- [ ] **T-10** Create `packages/core/src/__tests__/validate.test.ts`
  - Valid setup (spec with `artifacts.json`, owned artifact exists, manifest registered): `valid: true`
  - Missing `manifest.json` when `.md` file exists: `missing_manifests` populated
  - Unregistered `.md` file (manifest exists but entry missing): `unregistered_files` populated
  - Ownership conflict (two specs own same artifact): `conflicts` populated
  - Missing owned artifact (path in `owns` doesn't exist on disk): `missing_owned` populated
  - Illegal file in spec dir (file other than the 4 allowed): `illegal_files` populated

- [x] **T-11** Create `packages/core/src/__tests__/context.test.ts`
  - Spec resolved from `--spec` arg: `spec_id` and `active_spec_source: "arg"` in output
  - Spec resolved from `current-spec` file: `active_spec_source: "current-spec"` in output
  - File existence flags: `spec: true` when `spec.md` exists, `spec: false` when it doesn't
  - Shared artifact refs: `owns` and `reads` entries appear in `shared_artifacts` with correct `exists` flags

- [x] **T-12** Create `packages/core/src/__tests__/search.test.ts`
  - `runSearch`: returns entries whose tags match the keyword; score reflects number of tag hits; sorted descending by score
  - `runSearch`: returns `[]` when no tags match
  - `runDeepSearch`: returns all entries across all manifest subdirs (`name`, `tldr`, `tags`, `path`)
  - Missing manifest for a subdir is silently skipped (no error)

---

## Phase 6 — Scan smoke test

- [x] **T-13** Create `packages/core/src/__tests__/scan.test.ts`
  - Call `runScan` with `json: true` against the real project directory; capture stdout
  - Assert output parses as valid JSON
  - Assert top-level keys present: `project_dir`, `tech_stack`, `key_files`, `file_tree`, `existing_artifacts`, `stats`
  - Assert `tech_stack` is a non-empty array
  - Assert `key_files` contains at least one entry

---

## Phase 7 — CI workflow

- [x] **T-14** Create `.github/workflows/test.yml`
  - Trigger: `on: pull_request` (no branch filter — all PRs)
  - Job: `ubuntu-latest`, permissions `contents: read`
  - Steps: `actions/checkout@v4` → `oven-sh/setup-bun@v2` (bun-version: latest) → `bun install` → `bun run test`
  - No Node.js setup step (tests run under Bun)

---

## Notes

- **`process.exit` constraint**: `runInit`, `runContext`, `runValidate`, `runSearch`, `runScaffold` all call `process.exit(1)` on error paths. Per the constitution (no mocking), these paths are not tested. Tests cover only success paths and JSON output shape.
- **Task ordering**: T-01a and T-01b must be done first (establish the test command). T-02 through T-13 are independent of each other and can be done in any order within their phase. T-14 is independent of all test files.
- **Scan test (T-13)**: reads the real project directory — will reflect `.relic/` artifacts created in this session. This is acceptable for a smoke test.
- **No task overlap**: only one spec in the repository.
