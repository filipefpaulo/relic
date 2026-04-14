# Plan: Toon Manifest Format

**Spec ID:** 005-toon-manifest-format
**Status:** ready

---

## Architecture Overview

The implementation is strictly layered. Each layer depends only on the one below it:

```
templates/          ← preamble.md + 11 prompt files updated last
packages/cli-node/  ← bin.ts / bin.debug.ts rewired in the final step
packages/core/      ← commands rewritten to use toon; no new dependencies
packages/utility/   ← toon.ts added here first; ManifestEntry + SearchResultEntry land here
```

**Key architectural decisions:**

1. **`toon.ts` lives in `@relic/utility`** — pure encode/decode, zero filesystem access. The canonical `ManifestEntry` and `SearchResultEntry` types live here. `packages/core/src/types.ts` re-exports `ManifestEntry` from `@relic/utility` for backward compatibility; the old `SearchResult` type (with `score`) is kept as an internal type.

2. **`toon-migrate.ts` is the orchestration hub** — it exports `buildSpecIndex`, `buildFixIndex`, `runToonMigrate`, and the shared toon read helper `readManifestToon`. All consumers that need to read a manifest go through `readManifestToon`, which transparently falls back from `.toon` → `.json` and auto-writes `.toon` on first access.

3. **`relic deep-search` is deleted** — `runDeepSearch` and its bin.ts command are removed entirely. The `--deep` flag on `relic search` covers all use cases.

4. **Init writes empty files; migrate/upgrade writes content** — `runInit` writes six header-only `.toon` files with no logic dependency on migration. `runUpgrade` calls `runToonMigrate` + `buildSpecIndex` + `buildFixIndex` to populate. These are independent paths.

5. **Toon output is default for `relic search`; `--json` is opt-in** — the output format is 5-field toon lines, not JSON. The `--json` flag returns a flat array of `SearchResultEntry` objects.

---

## Implementation Phases

### Phase 1 — `@relic/utility`: toon library + canonical types

**Files:** `packages/utility/src/toon.ts`, `packages/utility/src/index.ts`

1. Create `packages/utility/src/toon.ts` — **codec only, no business types**:
   - Export `ManifestEntry = { name: string; file: string; tags: string[]; tldr: string }` type.
     This is the codec's input/output shape. It lives here because the codec cannot function
     without it. It is not a search type. Do not add any other types to this file.
   - Export `encodeToon(entries: ManifestEntry[], header?: string): string`
     - First line: `# <header>` (default: `# manifest`)
     - Each entry: `name | file | tags.join(" ") | tldr`
     - Sanitise: replace ` | ` in any field with ` - ` before encoding
   - Export `decodeToon(content: string): ManifestEntry[]`
     - Skip blank lines and `#` lines
     - Split on ` | ` — expect exactly 4 fields; skip malformed lines with `console.warn`
     - `tags` field: `field.split(/\s+/).filter(Boolean)` → `string[]`
     - Trim leading/trailing whitespace on each field
2. Add exports to `packages/utility/src/index.ts`:
   ```ts
   export type { ManifestEntry } from "./toon.ts";
   export { encodeToon, decodeToon } from "./toon.ts";
   ```
   `SearchResultEntry` is NOT exported from utility — it lives in `@relic/core`.

### Phase 2 — `@relic/utility`: toon tests

**File:** `packages/utility/src/__tests__/toon.test.ts`

1. Test `encodeToon`:
   - Empty array → string with comment header only
   - Single entry → correct pipe-delimited line
   - Tags array → space-joined string in output
   - Field containing ` | ` → sanitised to ` - `
2. Test `decodeToon`:
   - Round-trip: `decodeToon(encodeToon(entries))` equals `entries`
   - Blank lines ignored
   - `#` comment lines ignored
   - `\r\n` line endings tolerated
   - Long `tldr` preserved without truncation
   - Empty tags field → `tags: []`
   - Malformed line (wrong field count) → skipped, no throw

### Phase 3 — `@relic/core`: `toon-migrate.ts`

**File:** `packages/core/src/commands/toon-migrate.ts`

1. Export `readManifestToon(subdirPath: string, header: string): ManifestEntry[]`:
   - Check for `manifest.toon` first — if exists, read and `decodeToon`, return
   - Else check for `manifest.json` — if exists, `readJson`, write `manifest.toon` via `encodeToon` with `header`, emit `console.warn("Auto-migrating ...")`, return entries
   - Else return `[]`
   - This function is the **single read entry point** for all manifest consumers

2. Export `buildSpecIndex(relicDir: string): ManifestEntry[]`:
   - List all `specs/*/` directories in `relicDir/specs/`
   - For each: read `spec.md`, extract title from `# Spec: <Title>` line (fallback: folder name)
   - Return `ManifestEntry[]` with `file = folderName + "/"`, `tags = []`, `tldr = ""`

3. Export `buildFixIndex(relicDir: string): ManifestEntry[]`:
   - List all `fixes/*.md` files (skip `manifest.toon` and `manifest.json`)
   - For each: extract title from `# Fix: <Title>` line (fallback: file stem)
   - Return `ManifestEntry[]` with `file = filename`, `tags = []`, `tldr = ""`

4. Export `runToonMigrate(relicDir: string): MigrateResult`:
   - For each of `SHARED_SUBDIRS` (domains, contracts, rules, assumptions):
     - Check if `shared/<subdir>/manifest.json` exists without `manifest.toon`
     - If so: read JSON, `encodeToon`, write `manifest.toon`, validate round-trip count
   - Call `buildSpecIndex` → `encodeToon` → write `specs/manifest.toon`
   - Call `buildFixIndex` → `encodeToon` → write `fixes/manifest.toon`
   - If any entry has empty tags or tldr, emit warning
   - Return `{ converted: [{ dir, entries }], spec_entries: N, fix_entries: N }`
   - Output JSON by default

5. Export `MigrateResult` type

### Phase 4 — `@relic/core`: rewrite `search.ts`

**File:** `packages/core/src/commands/search.ts`

This is a full rewrite. The existing `runSearch` and `runDeepSearch` are replaced.

1. Define `SearchResultEntry` in `packages/core/src/commands/search.ts` (or `core/types.ts`):
   ```ts
   interface SearchResultEntry {
     source: "knowledge" | "spec" | "fix";
     name: string;
     path: string;
     tags: string[];
     tldr: string;
     score: number;   // tag-overlap or substring match count; 0 = unscored (--deep no keywords)
   }
   ```
   Export from `packages/core/src/index.ts`. Do NOT define or re-export from `@relic/utility`.

2. New `SearchOptions`:
   ```ts
   interface SearchOptions {
     keywords: string[];     // empty = no keywords (only valid with deep: true)
     deep: boolean;          // --deep flag
     knowledge: boolean;     // --knowledge scope flag
     spec: boolean;          // --spec scope flag
     fix: boolean;           // --fix scope flag
     json: boolean;          // --json output flag
     relicDir?: string;
   }
   ```

2. Scope resolution: if none of `knowledge`/`spec`/`fix` are set → all three active

3. Load knowledge entries (if scope includes knowledge):
   - For each of `SHARED_SUBDIRS`: call `readManifestToon(subdirPath, "# <subdir> manifest")`
   - Map to `SearchResultEntry` with `source: "knowledge"`, `path: "shared/<subdir>/<file>"`

4. Load spec entries (if scope includes spec):
   - Call `readManifestToon(specsDir, "# specs index")`
   - Map to `SearchResultEntry` with `source: "spec"`, `path: "specs/<file>"`

5. Load fix entries (if scope includes fix):
   - Call `readManifestToon(fixesDir, "# fixes index")`
   - Map to `SearchResultEntry` with `source: "fix"`, `path: "fixes/<file>"`

6. Scoring (when keywords present):
   - `knowledge`: count of tags matching any keyword (existing tag-overlap algorithm)
   - `spec` / `fix`: count of keywords that appear as substring in `name + " " + tldr`
   - Filter to `score > 0`; sort by score descending

7. With `--deep` and no keywords: return all entries, sorted by source then name

8. With `--deep` and keywords: apply scoring filter, return all with score > 0

9. Output:
   - Default (toon): print `# relic search [--deep] [flags]: <keywords>` header, then **6-field** lines:
     `source | name | path | tags | tldr | score`
   - `--json`: print `JSON.stringify(results)` where each result is `SearchResultEntry` (with `score`)

10. Error: no keywords AND `deep: false` → `console.error("relic search requires keywords or --deep flag"); process.exit(1)`

11. **Delete `runDeepSearch`** — function no longer exists

### Phase 5 — `@relic/core`: update `validate.ts`

**File:** `packages/core/src/commands/validate.ts`

1. Add `warnings: string[]` to `ValidateResult` interface
2. Change manifest loading in the shared/ subdirs loop:
   - Prefer `manifest.toon` over `manifest.json` as the authoritative index
   - If `manifest.toon` exists: decode with `decodeToon`; use as registered entries
   - If `manifest.json` exists but `manifest.toon` does not: add to `warnings` array: `"shared/<subdir>/manifest.json exists but manifest.toon is missing — run: relic toon-migrate"`
   - Use whichever is available for the `unregistered_files` check
   - `missing_manifests` error only fires if NEITHER `.toon` NOR `.json` exists (and there are .md files)
3. Update `valid` computation: `warnings` do not affect `valid`
4. Update text output to print warnings section

### Phase 6 — `@relic/core`: update `init.ts`

**File:** `packages/core/src/commands/init.ts`

1. After creating all dirs, write 6 empty toon files:
   ```ts
   const TOON_INIT_FILES: [string, string][] = [
     ["shared/domains/manifest.toon",    "# domains manifest\n"],
     ["shared/contracts/manifest.toon",  "# contracts manifest\n"],
     ["shared/rules/manifest.toon",      "# rules manifest\n"],
     ["shared/assumptions/manifest.toon","# assumptions manifest\n"],
     ["specs/manifest.toon",             "# specs index\n"],
     ["fixes/manifest.toon",             "# fixes index\n"],
   ];
   for (const [rel, content] of TOON_INIT_FILES) {
     writeText(join(relicDir, rel), content);
   }
   ```
2. Keep `fixes/manifest.json` write (backward compat) — or decide to drop it. Keep it for now since `manifest.json` coexistence is in scope.
3. Update console output to list the new toon files created.

### Phase 7 — `@relic/core`: update `upgrade.ts`

**File:** `packages/core/src/commands/upgrade.ts`

1. Add `toon_migrated: boolean` and `toon_warnings: string[]` to `UpgradeResult`
2. In `refreshHooks` (or a new `refreshIndexes` helper) — called after hooks refresh:
   - Call `runToonMigrate(relicDir)` — auto-migrates any unconverted `manifest.json`
   - Call `buildSpecIndex(relicDir)` → write `specs/manifest.toon`
   - Call `buildFixIndex(relicDir)` → write `fixes/manifest.toon`
   - Set `toon_migrated: true` and propagate any warnings to `toon_warnings`
3. This only runs when `relicDir` is available (not `--check` only mode)

### Phase 8 — `@relic/core`: `toon-migrate.ts` test

**File:** `packages/core/src/__tests__/toon-migrate.test.ts`

1. `buildSpecIndex`: temp dir with 2 spec folders → returns correct `ManifestEntry[]`
2. `buildFixIndex`: temp dir with 2 fix files → returns correct entries
3. `runToonMigrate`: temp dir with `manifest.json` files → writes `.toon`, validates round-trip
4. `readManifestToon`: prefers `.toon` over `.json`; auto-writes `.toon` from `.json`

### Phase 9 — `@relic/core`: `search.ts` test

**File:** `packages/core/src/__tests__/search.test.ts`

1. No keywords + no `--deep` → exits with error
2. `--deep`: returns all entries across all spaces
3. `--knowledge`: returns knowledge entries only
4. `--spec`: returns spec entries only
5. `--fix`: returns fix entries only
6. Keywords: scored and filtered correctly for each source type
7. Keywords + `--deep`: still filters to score > 0
8. Default output is toon format (check stdout for pipe-delimited lines)
9. `--json` output is valid JSON array of `SearchResultEntry`

### Phase 10 — `@relic/core`: update `core/index.ts`

**File:** `packages/core/src/index.ts`

1. Add exports:
   ```ts
   export { runToonMigrate, buildSpecIndex, buildFixIndex, readManifestToon } from "./commands/toon-migrate.ts";
   export type { MigrateResult } from "./commands/toon-migrate.ts";
   export type { SearchResultEntry } from "./commands/search.ts";  // business type lives in core
   ```
2. Change `runSearch` export — same name, new signature
3. Remove `runDeepSearch` export
4. Re-export `ManifestEntry` from `@relic/utility` (codec type, available to all core consumers)
5. Keep old `SearchResult` (with score) as internal in `types.ts` or remove it — it is
   superseded by `SearchResultEntry`; no public consumers rely on it from outside core

### Phase 11 — `packages/cli-node`: rewrite `bin.ts` and `bin.debug.ts`

**Files:** `packages/cli-node/src/bin.ts`, `packages/cli-node/src/bin.debug.ts`

1. Import `runToonMigrate` (add to import from `@relic/core`)
2. Remove import of `runDeepSearch`
3. Rewrite `search` command:
   ```
   relic search [keywords...]
     --deep           Return all entries, no filtering required
     --knowledge      Scope: shared artifacts only
     --spec           Scope: specs index only
     --fix            Scope: fixes index only
     --json           JSON output instead of toon
   ```
4. Delete `deep-search` command block
5. Add `toon-migrate` command:
   ```
   relic toon-migrate   Convert shared/*/manifest.json → manifest.toon; regenerate spec/fix indexes
   ```

### Phase 12 — `templates/preamble.md`

**File:** `templates/preamble.md`

Add a new `## relic search — Mandatory Context Entry Point` section after the existing `## Relic Operational Rules` section (or as a subsection of it). Content per FR-11:
- Command reference table (all 9 invocation forms)
- Output format reminder (5-field toon line, use `path` to open)
- 6 enforcement rules as numbered list

### Phase 13 — `templates/prompts/*.md` audit

**Files:** all 11 prompt files

Targeted changes per FR-13:

| File | Change needed |
|---|---|
| `specify.md` | Replace `relic deep-search` fallback with `relic search --deep`; add post-creation step: run `relic search --deep --spec`, append new spec's entry with populated tags+tldr to `specs/manifest.toon` |
| `plan.md` | Replace `relic deep-search` with `relic search --deep`; already uses `relic search` for Step A |
| `fix.md` | Replace `manifest.json` registration steps with `manifest.toon` append via toon format; replace any deep-search refs |
| `scan.md` | Replace `shared/*/manifest.json` write instructions with `manifest.toon` append instructions |
| `clarify.md`, `analyse.md`, `tasks.md`, `implement.md`, `solve.md`, `use.md`, `constitution.md` | Audit for any `deep-search` or `manifest.json` direct-read references; replace with `relic search --deep` |

---

## File Changes

| File | Action | Notes |
|---|---|---|
| `packages/utility/src/toon.ts` | **create** | `encodeToon`, `decodeToon`, `ManifestEntry` only — no search types |
| `packages/utility/src/index.ts` | **modify** | Export `ManifestEntry`, `encodeToon`, `decodeToon` from toon.ts |
| `packages/utility/src/__tests__/toon.test.ts` | **create** | Full encode/decode test suite |
| `packages/core/src/commands/toon-migrate.ts` | **create** | `readManifestToon`, `buildSpecIndex`, `buildFixIndex`, `runToonMigrate` |
| `packages/core/src/commands/search.ts` | **rewrite** | New flags; remove `runDeepSearch`; 6-field toon output with score; 3-space scope; `SearchResultEntry` defined here |
| `packages/core/src/commands/validate.ts` | **modify** | Prefer `.toon`; `warnings` field; no-manifest error only if neither exists |
| `packages/core/src/commands/init.ts` | **modify** | Write 6 empty `.toon` files on scaffold |
| `packages/core/src/commands/upgrade.ts` | **modify** | Call `runToonMigrate` + index builders after hook refresh |
| `packages/core/src/index.ts` | **modify** | Add `runToonMigrate` exports; remove `runDeepSearch` |
| `packages/core/src/__tests__/toon-migrate.test.ts` | **create** | Tests for migration functions |
| `packages/core/src/__tests__/search.test.ts` | **create** | Tests for new search modes |
| `packages/cli-node/src/bin.ts` | **modify** | Add `toon-migrate`; rewrite `search`; delete `deep-search` |
| `packages/cli-node/src/bin.debug.ts` | **modify** | Same as bin.ts |
| `templates/preamble.md` | **modify** | Add `relic search` command reference section |
| `templates/prompts/specify.md` | **modify** | `--deep` fallback; post-creation toon entry step |
| `templates/prompts/plan.md` | **modify** | Replace `relic deep-search` with `relic search --deep` |
| `templates/prompts/fix.md` | **modify** | Replace `manifest.json` steps with toon; replace deep-search refs |
| `templates/prompts/scan.md` | **modify** | Replace `manifest.json` write instructions with toon |
| `templates/prompts/clarify.md` | **modify** | Audit and replace any deep-search refs |
| `templates/prompts/analyse.md` | **modify** | Audit and replace any deep-search refs |
| `templates/prompts/tasks.md` | **modify** | Audit and replace any deep-search refs |
| `templates/prompts/implement.md` | **modify** | Audit and replace any deep-search refs |
| `templates/prompts/solve.md` | **modify** | Audit and replace any deep-search refs |
| `templates/prompts/use.md` | **modify** | Audit and replace any deep-search refs |
| `templates/prompts/constitution.md` | **modify** | Audit and replace any deep-search refs |

---

## Shared Artifact Changes

All shared artifacts were updated during the clarify sessions. No further changes needed at plan time.

| Artifact | Status |
|---|---|
| `shared/contracts/ToonFormatContract.md` | Finalised in clarify |
| `shared/contracts/ManifestJsonContract.md` | Finalised in clarify |
| `shared/contracts/SpecIndexContract.md` | Finalised in clarify |
| `shared/contracts/FixIndexContract.md` | Finalised in clarify |

---

## Intersection Notes

All intersections are source file overlaps (`touches_files`) — no shared artifact ownership conflicts.

| File | Also touched by | Nature | Resolution |
|---|---|---|---|
| `packages/core/src/commands/init.ts` | spec 003 | 003 added session.json write; 005 adds toon file writes | Additive — different code sections |
| `packages/core/src/commands/upgrade.ts` | spec 004 (owns UpgradeDomain) | 005 adds toon migration call after hook refresh | Additive — append to `refreshHooks` or new helper; coordinate with 004 at implementation |
| `packages/utility/src/index.ts` | specs 002, 003 | Both added exports; 005 adds toon exports | Additive — append exports |
| `packages/core/src/index.ts` | spec 002 | 002 added engine exports; 005 adds toon-migrate exports | Additive — append exports |
| `packages/cli-node/src/bin.ts` / `bin.debug.ts` | specs 002, 003 | Both added commands; 005 rewrites search + adds toon-migrate + removes deep-search | Additive for toon-migrate; search rewrite replaces entire search command block |
| `templates/prompts/fix.md`, `solve.md`, `use.md` | spec 003 | 003 added fix workflow steps; 005 replaces manifest.json refs | Different sections; no content conflict |

**Upgrade.ts coordination note:** Spec 004 implemented `runUpgrade`. The spec 005 change is a single call to `runToonMigrate(relicDir)` + two `buildXxxIndex` calls appended at the end of the non-`--check` upgrade path (inside the `if (relicDir)` block where hooks are refreshed). This is a clean append and does not touch any logic 004 wrote.

---

## Changelog Reference

Plan entry to be written to `.relic/changelog.md` below.
