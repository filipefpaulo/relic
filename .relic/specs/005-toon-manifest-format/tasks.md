# Tasks: Toon Manifest Format

**Spec ID:** 005-toon-manifest-format
**Generated from plan:** 2026-04-14

---

## Phase 1 — `@relic/utility`: toon codec

- [ ] **T-01** Create `packages/utility/src/toon.ts`
  - Export `type ToonField = string | number | boolean | string[]` — format constraint, not a domain type
  - Export `encodeToon<T extends ToonField[]>(rows: T[], header?: string): string`
    - First line: `# <header>` (default: `# manifest`)
    - Per-field serialisation: `string` → verbatim + sanitise; `number|boolean` → `.toString()`;
      `string[]` → `.join(" ")` + sanitise result
    - Sanitise: any string value containing ` | ` → replace with ` - `
    - Empty input → header-only string
  - Export `decodeToon(content: string): string[][]`
    - Skip blank lines and lines starting with `#`
    - Split on ` | ` — expect exactly 4 fields; skip malformed lines with `console.warn`
    - Trim leading/trailing whitespace on each field; tolerate `\r\n` line endings
    - Returns raw `string[][]` — caller maps to domain types
  - **`ToonField` is the only exported type** — no domain types (`ManifestEntry`, `SearchResultEntry`)

- [ ] **T-02** Update `packages/utility/src/index.ts`
  - Add: `export type { ToonField } from "./toon.ts";`
  - Add: `export { encodeToon, decodeToon } from "./toon.ts";`
  - No domain type exports from utility

---

## Phase 2 — `@relic/utility`: toon tests

- [ ] **T-03** Create `packages/utility/src/__tests__/toon.test.ts`
  - `encodeToon`: empty rows array → header-only string
  - `encodeToon`: `string` field → verbatim; field containing ` | ` → sanitised to ` - `
  - `encodeToon`: `number` field → `.toString()` in output
  - `encodeToon`: `string[]` field → space-joined in output; ` | ` in joined result → sanitised
  - `encodeToon`: custom `header` arg → used as first comment line
  - `decodeToon`: round-trip with all-string rows — `decodeToon(encodeToon(rows))` deep-equals `rows`
  - `decodeToon`: blank lines ignored
  - `decodeToon`: `#` comment lines ignored
  - `decodeToon`: `\r\n` line endings tolerated
  - `decodeToon`: long field preserved without truncation
  - `decodeToon`: malformed line (wrong field count) → skipped, no throw, `console.warn` called

---

## Phase 3 — `@relic/core`: `toon-migrate.ts`

- [ ] **T-04** Create `packages/core/src/commands/toon-migrate.ts`

  **Define and export `ManifestEntry`** — lives here, not in `@relic/utility`:
  ```ts
  export interface ManifestEntry { name: string; file: string; tags: string[]; tldr: string }
  ```

  **`readManifestToon(subdirPath, header)`** — single read entry point for all manifest consumers:
  - If `manifest.toon` exists → `readText` + `decodeToon` → map `string[][]` → `ManifestEntry[]`, return
  - Else if `manifest.json` exists → `readJson`, map to `string[][]`, `encodeToon(rows, header)`, `writeText` the
    `.toon` file, emit `console.warn("Auto-migrating <path>/manifest.json → manifest.toon")`, return entries
  - Else return `[]`

  **`buildSpecIndex(relicDir)`**:
  - List all directories under `specs/` matching `NNN-*` pattern
  - For each: read `spec.md`, extract title from first line matching `/^# Spec:\s*(.+)/`
    (fallback: folder name)
  - Return `ManifestEntry[]` with `file = folderName + "/"`, `tags = []`, `tldr = ""`

  **`buildFixIndex(relicDir)`**:
  - List all `*.md` files in `fixes/` (skip `manifest.toon` and `manifest.json`)
  - For each: read file, extract title from first line matching `/^# Fix:\s*(.+)/`
    (fallback: file stem)
  - Return `ManifestEntry[]` with `file = filename`, `tags = []`, `tldr = ""`

  **`runToonMigrate(relicDir)`**:
  - For each of `SHARED_SUBDIRS`: if `shared/<subdir>/manifest.json` exists but `manifest.toon`
    does not — read JSON, `encodeToon`, write `manifest.toon`, validate round-trip entry count
  - Call `buildSpecIndex` → write `specs/manifest.toon`
  - Call `buildFixIndex` → write `fixes/manifest.toon`
  - If any entry has `tags.length === 0` or `tldr === ""`, emit:
    `console.warn("Warning: some entries have empty tags/tldr — ask your LLM to populate them.")`
  - Output JSON: `{ converted: [{ dir, entries }], spec_entries: N, fix_entries: N }`
  - Export `MigrateResult` type

---

## Phase 4 — `@relic/core`: rewrite `search.ts`

- [ ] **T-05** Rewrite `packages/core/src/commands/search.ts`

  **Define and export `SearchResultEntry`** in this file (business type, not utility):
  ```ts
  export interface SearchResultEntry {
    source: "knowledge" | "spec" | "fix";
    name: string;
    path: string;
    tags: string[];
    tldr: string;
    score: number;  // 0 = unscored (--deep with no keywords)
  }
  ```

  **New `SearchOptions`**: `{ keywords, deep, knowledge, spec, fix, json, relicDir? }`

  **Scope resolution**: none of `knowledge`/`spec`/`fix` set → all three active.

  **Load entries** via `readManifestToon` from `toon-migrate.ts`:
  - Knowledge: for each `SHARED_SUBDIR`, `readManifestToon(subdirPath, "# <subdir> manifest")`
    → `source: "knowledge"`, `path: "shared/<subdir>/<entry.file>"`
  - Spec: `readManifestToon(specsDir, "# specs index")` → `source: "spec"`, `path: "specs/<entry.file>"`
  - Fix: `readManifestToon(fixesDir, "# fixes index")` → `source: "fix"`, `path: "fixes/<entry.file>"`

  **Scoring** (when `keywords.length > 0`):
  - `knowledge`: `score = entry.tags.filter(t => keywords.some(kw => t.includes(kw))).length`
  - `spec`/`fix`: `score = keywords.filter(kw => (entry.name + " " + entry.tldr).toLowerCase().includes(kw)).length`
  - Filter to `score > 0`; sort descending

  **`--deep` with no keywords**: return all, `score = 0`, sorted by source then name.
  **`--deep` with keywords**: apply scoring, filter to `score > 0`.
  **Error**: no keywords AND `deep: false` → error + `process.exit(1)`.

  **Output**:
  - Default (toon): comment header `# relic search [--deep] [--flags]: <keywords>`,
    then 6-field lines: `source | name | path | tags.join(" ") | tldr | score`
  - `--json`: `JSON.stringify(results, null, 2)`

  **Delete `runDeepSearch`** — removed entirely.

---

## Phase 5 — `@relic/core`: update `validate.ts`

- [ ] **T-06** Modify `packages/core/src/commands/validate.ts`
  - Add `warnings: string[]` to `ValidateResult` interface
  - In the shared subdir loop, prefer `manifest.toon` over `manifest.json`:
    - If `manifest.toon` exists → `decodeToon(readText(...))` → use as registered entry set
    - Else if `manifest.json` exists → `readJson` as before; push to `warnings`:
      `"shared/<subdir>: manifest.json found without manifest.toon — run: relic toon-migrate"`
    - `missing_manifests` error only fires if NEITHER format exists (and `.md` files are present)
  - `warnings` do not affect `valid`
  - Add `warnings` to JSON output; print in `--text` output after errors

---

## Phase 6 — `@relic/core`: update `init.ts`

- [ ] **T-07** Modify `packages/core/src/commands/init.ts`
  - After creating all dirs, write 6 empty toon index files:
    - `shared/domains/manifest.toon` → `"# domains manifest\n"`
    - `shared/contracts/manifest.toon` → `"# contracts manifest\n"`
    - `shared/rules/manifest.toon` → `"# rules manifest\n"`
    - `shared/assumptions/manifest.toon` → `"# assumptions manifest\n"`
    - `specs/manifest.toon` → `"# specs index\n"`
    - `fixes/manifest.toon` → `"# fixes index\n"`
  - Keep existing `fixes/manifest.json` write (coexistence — both formats on init)
  - Update console output to list the 6 new toon files

---

## Phase 7 — `@relic/core`: update `upgrade.ts`

- [ ] **T-08** Modify `packages/core/src/commands/upgrade.ts`
  - Add `toon_migrated: boolean` and `toon_warnings: string[]` to `UpgradeResult`
  - Inside the existing `if (relicDir)` block (after `refreshHooks`), call:
    1. `const migrateResult = await runToonMigrate(relicDir)`
    2. `result.toon_migrated = true`
    3. Propagate any migration warnings to `result.toon_warnings`
  - Include both fields in JSON and `--text` output

---

## Phase 8 — `@relic/core`: toon-migrate tests

- [ ] **T-09** Create `packages/core/src/__tests__/toon-migrate.test.ts` (temp dirs)
  - `readManifestToon`: returns entries from `.toon` when it exists
  - `readManifestToon`: falls back to `.json` when `.toon` absent; writes `.toon`; warns
  - `readManifestToon`: returns `[]` when neither format exists
  - `buildSpecIndex`: 2 spec dirs with `spec.md` files → correct `ManifestEntry[]`
  - `buildSpecIndex`: dir with no title line → falls back to folder name
  - `buildFixIndex`: 2 fix files with `# Fix:` title lines → correct entries
  - `buildFixIndex`: skips `manifest.toon`, `manifest.json`, and non-`.md` files
  - `runToonMigrate`: converts `manifest.json` → writes `manifest.toon`, validates round-trip count
  - `runToonMigrate`: skips subdirs that already have `manifest.toon`
  - `runToonMigrate`: writes `specs/manifest.toon` and `fixes/manifest.toon`

---

## Phase 9 — `@relic/core`: search tests

- [ ] **T-10** Create `packages/core/src/__tests__/search.test.ts` (temp dirs)
  - No keywords + no `--deep` → exits with error
  - `--deep` no keywords → all entries returned, `score: 0` on every entry
  - `--knowledge` → knowledge entries only
  - `--spec` → spec entries only
  - `--fix` → fix entries only
  - Keywords → scored, filtered `score > 0`, sorted descending
  - Keywords + `--deep` → still filtered to `score > 0`
  - Default output: lines are 6-field `source | name | path | tags | tldr | score`
  - `--json` output: valid JSON array; every element has all 6 `SearchResultEntry` fields
  - Auto-migration: JSON-only manifest is converted transparently during search

---

## Phase 10 — `@relic/core`: update `core/index.ts`

- [ ] **T-11** Modify `packages/core/src/index.ts`
  - Add:
    ```ts
    export { runToonMigrate, buildSpecIndex, buildFixIndex, readManifestToon } from "./commands/toon-migrate.ts";
    export type { MigrateResult, ManifestEntry } from "./commands/toon-migrate.ts";
    export type { SearchResultEntry } from "./commands/search.ts";
    ```
  - Remove `runDeepSearch` from exports
  - Remove old `SearchResult` type from public exports in `types.ts` (superseded by `SearchResultEntry`)
  - **Do NOT re-export `ManifestEntry` from `@relic/utility`** — it is no longer defined there

---

## Phase 11 — `packages/cli-node`: rewrite bin files

- [ ] **T-12** Modify `packages/cli-node/src/bin.ts`
  - Add `runToonMigrate` to imports from `@relic/core`; remove `runDeepSearch`
  - **Rewrite `search` command** with all new flags:
    `[keywords...]`, `--deep`, `--knowledge`, `--spec`, `--fix`, `--json`
  - **Delete** the `deep-search` command block entirely
  - **Add `toon-migrate` command**: calls `runToonMigrate({ relicDir })`

- [ ] **T-13** Modify `packages/cli-node/src/bin.debug.ts`
  - Mirror T-12 exactly

---

## Phase 12 — `templates/preamble.md`

- [ ] **T-14** Modify `templates/preamble.md`
  - Add `## relic search — Mandatory Context Entry Point` section after `## Relic Operational Rules`
  - Include: command reference table (9 invocation forms), 6-field output format reminder,
    6 numbered enforcement rules (see plan FR-11 for full content)

---

## Phase 13 — `templates/prompts/*.md` audit

- [ ] **T-15** Modify `templates/prompts/plan.md`
  - Replace `relic deep-search` (Step B fallback) with `relic search --deep`

- [ ] **T-16** Modify `templates/prompts/specify.md`
  - Replace `relic deep-search` fallback with `relic search --deep`
  - Add post-creation step: run `relic search --deep --spec`, then append the new spec's
    entry (with `tags` and `tldr` populated from the spec's Overview) to `specs/manifest.toon`

- [ ] **T-17** Modify `templates/prompts/fix.md`
  - Replace Step 6 (`fixes/manifest.json` read/write) with toon equivalent:
    read `fixes/manifest.toon` via `decodeToon`, append new fix entry, write back via
    `encodeToon("# fixes index")`
  - Replace any `relic deep-search` references with `relic search --deep`

- [ ] **T-18** Modify `templates/prompts/scan.md`
  - Replace all four `shared/*/manifest.json` write instructions with toon append instructions:
    read existing `manifest.toon` via `decodeToon` (or start from `[]`), append new entry,
    write back via `encodeToon("# <subdir> manifest")`

- [ ] **T-19** Audit remaining 7 prompt files:
  `clarify.md`, `analyse.md`, `tasks.md`, `implement.md`, `solve.md`, `use.md`, `constitution.md`
  - Replace any `relic deep-search` occurrences with `relic search --deep`
  - Replace any direct `manifest.json` read/write instructions with toon equivalents
  - Most likely need no change — confirm by searching each file

---

## Notes

**Dependency order:**
- T-01, T-02 must be first — toon codec must exist before anything imports it
- T-04 (`toon-migrate.ts`) must precede T-05, T-06, T-07, T-08 — all use `readManifestToon`
- T-03, T-09, T-10 are test tasks — run after their respective implementation tasks pass
- T-11 must precede T-12, T-13 — core exports must exist before bin wires them
- T-14 through T-19 (templates) are independent of TypeScript tasks — can be done in any order
- After T-14 through T-19: **run `bun run build:templates`** to re-embed templates into
  `packages/core/src/generated/templates.ts` before building the Node.js bundle

**File overlaps with other specs (all additive, no conflict):**
- `init.ts` — spec 003 added session.json write; T-07 adds toon file writes in a separate block
- `upgrade.ts` — spec 004 implemented the full function; T-08 appends inside the `if (relicDir)` block
- `utility/src/index.ts` — specs 002, 003, 004 added exports; T-02 appends new toon exports
- `core/src/index.ts` — spec 002 added engine exports; T-11 appends toon exports, removes `runDeepSearch`
- `bin.ts` / `bin.debug.ts` — specs 002, 003 added commands; T-12/T-13 touch only the `search` block
- `fix.md`, `solve.md`, `use.md` — spec 003 added fix workflow steps; T-17/T-19 edit different sections
