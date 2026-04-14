# Spec: Toon Manifest Format

**Spec ID:** 005-toon-manifest-format
**Created:** 2026-04-13
**Status:** draft

---

## Overview

Every Relic command that assembles LLM context reads `manifest.json` files from
`shared/*/`. These files are JSON arrays — verbose by nature. Every token spent on
brackets, quotes, and commas is wasted. At scale (many artifacts, many shared dirs),
the manifests become a significant fraction of every prompt's token budget.

This spec introduces **Toon** — a compact, line-oriented text format for all Relic
index files. One artifact per line. Pipe-delimited. No punctuation overhead. The LLM
reads the same information in roughly 40–50% fewer tokens. The format is also more
scannable: the LLM can reject irrelevant lines faster than parsing JSON objects.

The spec also adds two new index files — `specs/manifest.toon` and
`fixes/manifest.toon` — giving the LLM a single place to discover available specs and
fix documents without traversing directories.

Finally, the preamble is updated to enforce search-first context assembly: the LLM
must never read artifact files by traversing the filesystem. It must use `relic search`
(targeted) or `relic deep-search` (full triage) as the entry point to all artifact
context.

---

## Toon Format Definition

A `.toon` file is a UTF-8 plain text file. Each non-blank, non-comment line represents
one record. Fields are separated by ` | ` (space-pipe-space). Lines starting with `#`
are comments and are ignored by all parsers.

**All three index spaces — knowledge, specs, fixes — use the same 4-field schema:**
```
<name> | <file> | <tags> | <tldr>
```
- `name` — display name (artifact name, spec title, or fix title)
- `file` — filename or folder that locates the content (no leading path prefix)
  - knowledge: `UserAuth.md`
  - spec: `001-auth/` (the spec folder, trailing slash)
  - fix: `2026-04-13-crash.md`
- `tags` — space-separated lowercase keywords; empty string if not yet populated
- `tldr` — one-sentence description; empty string if not yet populated

Empty fields are written as empty strings between pipes: `Name | file | | ` (still 4 fields).

**Example `shared/domains/manifest.toon`:**
```
# domains manifest
UserAuth | UserAuth.md | auth session token user | Handles user authentication and session state.
Payment | Payment.md | payment billing order | Manages payment processing and order billing.
```

**Example `specs/manifest.toon`:**
```
# specs index
Workflow Test Suite | 001-workflow-test-suite/ | test suite typescript commands | Test suite for all core TypeScript commands.
Agent Permission Config | 002-agent-permission-config/ | engines permission copilot codex claude | Per-command files and permission configs.
# newly-created spec with empty fields (LLM should be asked to fill these):
Toon Manifest Format | 005-toon-manifest-format/ | |
```

**Example `fixes/manifest.toon`:**
```
# fixes index
Copilot Codex Per-Command Files | 2026-04-13-copilot-codex-per-command-files.md | copilot codex engines misspecification | Copilot and Codex engines wrote single files instead of per-command files.
```

**CLI output (what the LLM sees from `relic search` / `relic deep-search`) adds a `path` field:**
```
<source> | <name> | <path> | <tags> | <tldr>
```
The `path` is derived at query time — it is not stored in the `.toon` file:
- knowledge: `shared/<subdir>/<file>` (e.g. `shared/domains/UserAuth.md`)
- spec: `specs/<file>` (e.g. `specs/001-auth/`)
- fix: `fixes/<file>` (e.g. `fixes/2026-04-13-crash.md`)

---

## Requirements

### Functional Requirements

**Toon library:**

- **FR-1:** Create `packages/utility/src/toon.ts`. Exports **pure format functions and the field primitive type — no domain types**:
  - `type ToonField = string | number | boolean | string[]` — the union of types that can appear
    as a field in a toon row. Exported from `@relic/utility`. This is a format infrastructure
    type, not a domain type.
  - `encodeToon<T extends ToonField[]>(rows: T[], header?: string): string` — serialise a table
    of typed rows to toon format. First line: `# <header>` (default: `# manifest`). Each row
    becomes one line by serialising each field and joining with ` | `. Serialisation per field type:
    - `string` → verbatim; sanitise ` | ` → ` - `
    - `number | boolean` → `.toString()`; cannot contain ` | `, no sanitise needed
    - `string[]` → `.join(" ")`; sanitise result if it contains ` | `
    The generic `T` captures the exact tuple shape — callers pass typed rows directly without
    pre-converting to `string[]`. The codec has no knowledge of `ManifestEntry` or any domain type.
  - `decodeToon(content: string): string[][]` — parse a toon string to a table of string rows.
    Skip blank lines and `#` comment lines. Split each line on ` | `; skip malformed lines
    (wrong field count) with a `console.warn`. Trim whitespace on each field. Tolerate `\r\n`.
    Returns raw `string[][]` — the caller interprets the field meaning and converts to domain types.
  - Export all three from `packages/utility/src/index.ts`.
  - **Only `ToonField` is exported as a type** — it is a format constraint, not a domain type.
    Domain types (`ManifestEntry`, `SearchResultEntry`) live in `@relic/core`.

**Migration:**

- **FR-2:** Create `packages/core/src/commands/toon-migrate.ts` — exports:
  - `buildSpecIndex(relicDir: string): ManifestEntry[]` — reads all `specs/*/` directories,
    extracts `name` from `# Spec: <Title>` in `spec.md` (fallback: folder name), sets
    `file` = folder with trailing slash (e.g. `001-auth/`), `tags` = `[]`, `tldr` = `""`.
  - `buildFixIndex(relicDir: string): ManifestEntry[]` — reads all `fixes/*.md` files
    (skipping `manifest.toon`), extracts `name` from `# Fix: <Title>` (fallback: file stem),
    sets `file` = filename, `tags` = `[]`, `tldr` = `""`.
  - `runToonMigrate(relicDir: string): MigrateResult` — orchestrates full migration:
    1. Finds all `shared/*/manifest.json` files. Converts each via `encodeToon`, writes
       `manifest.toon` alongside. Validates no entries are lost.
    2. Calls `buildSpecIndex` and writes `specs/manifest.toon`.
    3. Calls `buildFixIndex` and writes `fixes/manifest.toon`.
    4. If any generated entry has empty tags or tldr, emits:
       `"Warning: some entries have empty tags/tldr — ask your LLM to populate them."`.
    5. Does NOT delete `manifest.json` — both files coexist during transition.
    6. Returns `{ converted: [{ dir, entries }], spec_entries: N, fix_entries: N }`.
  - The toon read helper (used by `relic search` etc.) auto-calls `runToonMigrate` on a
    single subdir when `manifest.toon` is absent but `manifest.json` exists — it writes
    the file, emits a warning, and continues. The LLM never sees a missing-toon error.
- **FR-3:** Register `relic toon-migrate` in `bin.ts` and `bin.debug.ts`.

**Runtime reads — search and validate:**

- **FR-4:** `relic search` is the single search entry point. The `--deep` flag absorbs
  `relic deep-search` entirely — there is no longer a separate `relic deep-search` command.

  | Invocation | Behaviour |
  |---|---|
  | `relic search <kw>` | Scored results from all three spaces |
  | `relic search <kw> --knowledge` | Scored, knowledge space only |
  | `relic search <kw> --spec` | Scored, specs space only |
  | `relic search <kw> --fix` | Scored, fixes space only |
  | `relic search --deep` | All entries, all three spaces, unfiltered |
  | `relic search --deep --knowledge` | All knowledge entries, unfiltered |
  | `relic search --deep --spec` | All spec entries, unfiltered |
  | `relic search --deep --fix` | All fix entries, unfiltered |
  | `relic search <kw> --deep` | Keywords still filter even with `--deep` |

  **Error case:** no keywords AND no `--deep` flag →
  `error: "relic search requires keywords or --deep flag"`.

  Scoring (when keywords are present):
  - knowledge entries: tag-overlap score
  - spec/fix entries: keyword substring match on `name + tldr`

  Results sorted by score descending, filtered to score > 0.
  `--deep` with no keywords returns all entries sorted by source then name.

  **Output format: toon by default.** Use `--json` for JSON output.
  See FR-14 for the toon output line format.

- **FR-5 (dropped):** `relic deep-search` is removed as a standalone command. All its
  functionality is covered by `relic search --deep [--knowledge|--spec|--fix]`. The
  existing `commands/deep-search.ts` file (if it exists) is deleted.

- **FR-14 (CLI toon output format):** `relic search` outputs toon lines, not JSON.
  All output lines use a unified **6-field** format:

  ```
  <source> | <name> | <path> | <tags> | <tldr> | <score>
  ```

  Field definitions:
  - `source` — always `knowledge`, `spec`, or `fix`
  - `name` — the entry's display name (artifact name, spec title, or fix title/stem)
  - `path` — full relative path computed at query time (NOT stored in `.toon`):
    - knowledge: `shared/<subdir>/<file>` (e.g. `shared/domains/UserAuth.md`)
    - spec: `specs/<folder>` (e.g. `specs/001-auth/`)
    - fix: `fixes/<file>` (e.g. `fixes/2026-04-13-session-null.md`)
  - `tags` — space-separated keywords (empty string if not populated)
  - `tldr` — one-sentence description (empty string if not populated)
  - `score` — integer relevance score; `0` when results are unscored (`--deep` with no keywords)

  Example scored output (`relic search auth session`):
  ```
  # relic search: auth session
  knowledge | UserAuth | shared/domains/UserAuth.md | auth session token | Handles user authentication and session state. | 2
  spec | Auth Token Refresh | specs/001-auth/ | auth token session | Adds session token refresh endpoint. | 1
  fix | Copilot Per-Command Fix | fixes/2026-04-13-copilot-codex.md | | Copilot wrote single file instead of per-command files. | 0
  ```

  Scoped scored output (`relic search --knowledge auth`):
  ```
  # relic search --knowledge: auth
  knowledge | UserAuth | shared/domains/UserAuth.md | auth session token | Handles user authentication and session state. | 2
  ```

  Deep (unscored) output (`relic search --deep --spec`):
  ```
  # relic search --deep --spec
  spec | Workflow Test Suite | specs/001-workflow-test-suite/ | test typescript commands | Test suite for all core TypeScript commands. | 0
  spec | Agent Permission Config | specs/002-agent-permission-config/ | engines permission copilot | Per-command files and permission configs. | 0
  ```

  The format is identical regardless of which flags are used. The LLM uses `path` to open
  files directly and `score` to prioritise reading order. `score: 0` in `--deep` mode
  signals "unranked, all entries returned".

  **Constitution amendment required** — see NFR-8.
- **FR-6:** Update `relic validate` (`commands/validate.ts`): if a subdir has
  `manifest.toon`, treat it as the authoritative index for `missing_manifests` and
  `unregistered_files` checks. If both exist, prefer `manifest.toon`. Add a new
  `warn` field to the validate output listing subdirs that have `manifest.json` but
  no `manifest.toon` (migration nudge, not an error).

**Index generation (internal, not CLI commands):**

- **FR-7:** `buildSpecIndex` and `buildFixIndex` live in `toon-migrate.ts` (see FR-2).
  They are **not** exposed as CLI commands. There is no `relic spec-index` or
  `relic fix-index`. The manifest.toon files for specs and fixes are populated
  by `relic upgrade` and `relic toon-migrate`. `relic init` writes them empty from
  scratch — it does not use these builders.
- **FR-8 (merged into FR-2):** See FR-2 for `buildFixIndex` spec.
- **FR-9 (dropped):** No `relic spec-index` or `relic fix-index` commands are registered.

**Init and upgrade scaffolding:**

- **FR-10:** Update `relic init` (`commands/init.ts`) to write empty toon index files
  from scratch as part of normal scaffolding — no migration, no index builders:
  1. Write `specs/manifest.toon` with a comment header only (`# specs index`).
  2. Write `fixes/manifest.toon` with a comment header only (`# fixes index`).
  3. Write `shared/domains/manifest.toon`, `shared/contracts/manifest.toon`,
     `shared/rules/manifest.toon`, and `shared/assumptions/manifest.toon` — each with
     a comment header only (`# <subdir> manifest`). These are the four subdirs that
     `relic init` already creates; each gets an empty `.toon` alongside the existing
     empty `manifest.json`.
  All six files are always created empty. `relic init` does not call `buildSpecIndex`,
  `buildFixIndex`, or `runToonMigrate` — it has no dependency on migration logic.
  If the project already has content (re-init with `--force`), files are still written
  empty; `relic upgrade` is responsible for populating them.

- **FR-15:** Update `relic upgrade` (`commands/upgrade.ts`) to:
  1. After upgrading templates and engine files, call `runToonMigrate` if any
     `shared/*/manifest.json` exists without a corresponding `manifest.toon`.
     Emit: `"Auto-migrating manifest.json → manifest.toon"`.
  2. Always regenerate `specs/manifest.toon` and `fixes/manifest.toon` via
     `buildSpecIndex` and `buildFixIndex` to keep the index current after upgrade.
  **Intersection note:** `commands/upgrade.ts` is in spec 004's `touches_files`.
  Coordinate with spec 004 at implementation time — this is an additive call only.

**Preamble enforcement:**

- **FR-11:** Add a **`relic search` — Mandatory Context Entry Point** section to
  `templates/preamble.md`. This section must teach the LLM the full command surface
  and enforce search-first discipline. Required content:

  **Command reference table:**

  | Command | When to use |
  |---|---|
  | `relic search <keywords>` | Default — scored results from all three spaces |
  | `relic search <keywords> --knowledge` | Shared artifacts only (domains, contracts, rules, assumptions) |
  | `relic search <keywords> --spec` | Specs only |
  | `relic search <keywords> --fix` | Fix documents only |
  | `relic search --deep` | All entries, unfiltered — full triage when you have no keywords |
  | `relic search --deep --knowledge` | All knowledge artifacts, unfiltered |
  | `relic search --deep --spec` | All specs, unfiltered |
  | `relic search --deep --fix` | All fix documents, unfiltered |
  | `relic search <keywords> --deep` | Keywords filter even with `--deep` |

  **Output format reminder:** Each result is a 5-field toon line:
  `<source> | <name> | <path> | <tags> | <tldr>`. Use `path` to open files directly.

  **Enforcement rules (Relic Operational Rules — non-negotiable):**
  1. Never traverse the filesystem or list directories to find relevant context.
  2. Always run `relic search <topic keywords>` before reading any artifact, spec, or fix file.
  3. Use the `path` field from results to open files — never guess or derive paths manually.
  4. Use `--deep` only when you have no keywords or need the full index for triage.
  5. Use scope flags (`--knowledge`, `--spec`, `--fix`) to narrow when you know the type.
  6. `relic search` without keywords AND without `--deep` is an error — do not invoke it that way.

**Toon enforcement across all LLM-facing CLI lists:**

- **FR-12:** Every CLI command that produces a list the LLM consumes must read from
  toon indexes rather than raw directories. Specifically:
  - `relic search` (FR-4) and `relic deep-search` (FR-5) cover all artifact, spec,
    and fix lookups.
  - `relic context` — already reads `artifacts.json` per-spec (not a manifest list;
    no change needed here).
  - `relic validate` (FR-6) — reads `manifest.toon` as the authoritative index.
  - No other CLI command should read `shared/*/manifest.json` directly after this spec.
    All manifest access routes through the toon-aware read helpers in `toon.ts`.

- **FR-13:** Audit all 11 `templates/prompts/*.md` files. For any step that reads
  manifests directly, lists directories, or calls `relic deep-search` as a separate command:
  - Replace with `relic search <keywords>` (targeted, preferred).
  - Use `relic search <keywords> --spec` when cross-spec awareness is needed.
  - Use `relic search <keywords> --fix` when looking for related fixes.
  - Fall back to `relic search --deep --knowledge` (artifacts only) or `relic search --deep`
    (all indexes) only when keyword-based search is insufficient.
  - Propagate this cascade consistently across `clarify.md`, `plan.md`, `fix.md`,
    `solve.md`, `analyse.md`, `tasks.md`, `implement.md`, `use.md`.
  - **`specify.md` specifically:** After creating a new spec, the LLM must run
    `relic search --deep --spec` to get the current `specs/manifest.toon` content,
    then add the new spec's entry (with its own `tags` and `tldr` populated from the
    spec's Overview) to `specs/manifest.toon`. The LLM does not need to read other
    specs — it only populates its own entry. This ensures the index is always current
    after a new spec is created.

### Non-Functional Requirements

- **NFR-1:** `toon.ts` has zero runtime dependencies beyond TypeScript builtins. Pure
  encode/decode — no filesystem access.
- **NFR-2:** No enforced line-length limit. The toon format does not truncate `tldr`
  or any other field. Content is written as-is; the format's token efficiency comes
  from removing JSON structure, not from truncating data.
- **NFR-3:** All toon parsers must tolerate trailing whitespace and Windows line
  endings (`\r\n`).
- **NFR-4:** The `--json` flag on `relic search` produces a flat JSON array where each
  element has `{ source, name, path, tags, tldr, score }` fields, matching the 6-field
  toon output format. Machine consumers that need JSON (e.g. other CLI tools) use this
  flag. AI prompt consumers use the default toon output.
- **NFR-5:** `packages/utility` gets `toon.test.ts` covering: roundtrip (encode →
  decode = original), comment stripping, blank line tolerance, long tldr preserved
  without truncation, and tags roundtrip (space-separated string → array).
- **NFR-6:** `packages/core` gets tests for `toon-migrate.ts` (including `buildSpecIndex`,
  `buildFixIndex`), and the new `--deep`, `--spec`, `--fix` modes of `search.ts` using
  temp directories. No separate spec-index or fix-index test files.
- **NFR-7:** All domain types live in `@relic/core`. The only type exported from `@relic/utility/toon.ts` is `ToonField` — a format infrastructure type, not a domain type.
  - `ToonField = string | number | boolean | string[]` — the primitive union for toon field values.
    Lives in `@relic/utility/toon.ts`. Exported from `@relic/utility/index.ts`.
  - `ManifestEntry = { name: string; file: string; tags: string[]; tldr: string }` — the
    stored index record shape. Lives in `@relic/core/commands/toon-migrate.ts` (where it is
    first created and used). Re-exported from `@relic/core/index.ts`. Not in `@relic/utility`.
    There are no separate `SpecIndexEntry` or `FixIndexEntry` types — the unified 4-field
    schema covers all three spaces.
  - `SearchResultEntry = { source: "knowledge"|"spec"|"fix"; name: string; path: string; tags: string[]; tldr: string; score: number }` — the 6-field CLI output type. Lives in
    `@relic/core/commands/search.ts`. Re-exported from `@relic/core/index.ts`.
  The rule: `@relic/utility/toon.ts` is a pure format utility. Domain types never live here.
  `ToonField` is the format's primitive constraint — analogous to how a CSV library might export
  a `CsvCell` type without knowing what the cells mean. New consumers can use toon encoding
  without importing any Relic domain type.
- **NFR-8 (Constitution amendment required):** Toon output by default for list-returning
  commands conflicts with **Constitution Principle V** ("All Utility Commands Output JSON
  by Default"). The existing 2026-04-14 amendment carved out only `relic search` and
  `relic deep-search`. A broader amendment must be appended that establishes the full rule:
  *"JSON is dropped as the default output format for any CLI command that returns a flat
  list of entries consumed by the LLM. Toon is the enforced default. `--json` enables JSON
  output for machine consumers. Commands that return structured objects (not flat lists)
  — `relic context`, `relic validate`, `relic scaffold`, `relic spec-index`, `relic fix-index`,
  `relic toon-migrate` — remain JSON-default."*
  This amendment supersedes the 2026-04-14 amendment and Principle V in full for all
  list-returning commands. `relic deep-search` is removed — it no longer exists as a
  separate command and does not appear in the constitution's command list.

---

## User Stories

- As an AI agent running `/relic.plan`, I want manifest reads to consume as few tokens
  as possible so I have more budget for the actual implementation plan.
- As a developer, I want `relic search --deep --spec` to show me all specs at a glance,
  and `relic search --deep --fix` to show me all fix documents.
- As a developer, I want `relic init` and `relic upgrade` to handle toon migration
  automatically so I never need to manually run a migration command.
- As an AI agent, I want the preamble to explicitly enforce search-before-read so I
  never burn tokens traversing irrelevant artifacts.
- As a Relic contributor, I want a smooth migration path where both formats coexist
  so no project is forced to migrate immediately.

---

## Scope

### In Scope

- `packages/utility/src/toon.ts` — encode/decode library + `ManifestEntry` type
- `packages/utility/src/index.ts` — re-export toon exports
- `packages/utility/src/__tests__/toon.test.ts`
- `packages/core/src/commands/toon-migrate.ts` — migration + index generation (internal)
- `relic toon-migrate` registered in both binaries
- `relic search` redesigned: `--deep` flag (replaces `relic deep-search`); `--knowledge`, `--spec`, `--fix` scope flags; no-flag = all three spaces; toon output by default; `--json` flag
- `relic deep-search` command removed
- `relic search`: unified 5-field toon output line (`source | name | path | tags | tldr`)
- `relic validate` updated to prefer `manifest.toon`; new migration `warn` field; auto-convert on-the-fly
- `relic init` updated: writes spec/fix index toon files, auto-migrates on re-init
- `relic upgrade` updated: auto-migrates and regenerates spec/fix indexes
- `templates/preamble.md` — full `relic search` command reference and enforcement section
- All 11 `templates/prompts/*.md` — audit and enforce search-first cascade with `--deep` flag
- `packages/core/src/__tests__/` — tests for toon-migrate, `--deep`/`--spec`/`--fix` search modes

### Out of Scope

- Deleting `manifest.json` files (coexistence; deletion is a future cleanup spec)
- Toon format for `artifacts.json` (different shape, machine-written)
- Toon format for `session.json` or `engines.json` (machine-written, not LLM-read)
- A `relic toon-encode` CLI for arbitrary JSON (overkill)
- `relic spec-index` and `relic fix-index` as CLI commands (dropped; internal functions only)
- Changing `relic context`, `relic validate`, `relic scaffold`, or `relic toon-migrate`
  output format (those remain JSON-default)

---

## Shared Artifacts

**Owns:**
- `shared/contracts/ToonFormatContract.md` — new; defines toon line format, field
  order, comment syntax, and line-length constraint (300 chars)
- `shared/contracts/ManifestJsonContract.md` — taking ownership (currently unowned);
  will be amended to document toon as the preferred format with JSON as fallback
- `shared/contracts/SpecIndexContract.md` — new; defines `specs/manifest.toon` schema
- `shared/contracts/FixIndexContract.md` — new; defines `fixes/manifest.toon` schema

**Reads:**
- `shared/domains/SpecDomain.md` — spec structure needed for `spec-index.ts` parsing
- `shared/domains/FixDomain.md` — fix document structure needed for `fix-index.ts` parsing
- `shared/domains/TemplateDomain.md` — preamble and prompt templates are build-time
  embedded; modifying them requires re-running `build:templates`

---

## Open Questions

- **OQ-1 (resolved):** `spec-index.ts` must parse a tldr from `spec.md`. **Decision:**
  tags and tldr are intentionally left blank on generation — the LLM or user fills them in.
  No parsing of the Overview section at all. See FR-7.
- **OQ-2 (resolved):** Should `relic validate` warn when `manifest.json` exists without
  `manifest.toon`? **Decision:** yes — warn, do not error. Additionally, the toon read
  helper auto-converts `manifest.json` to toon on-the-fly when `manifest.toon` is absent,
  writes the `.toon` file, emits a console warning, and continues. The CLI absorbs the
  conversion — the LLM never sees a missing-manifest problem. See FR-4, FR-6.
- **OQ-3 (resolved):** Should `relic init` and `relic upgrade` auto-migrate? **Decision:**
  `relic init` writes empty toon files from scratch — no migration logic, no dependency
  on `buildSpecIndex`/`buildFixIndex`. `relic upgrade` detects unconverted manifests and
  auto-runs `runToonMigrate`, regenerates spec/fix indexes. The two commands have distinct
  responsibilities: init bootstraps structure; upgrade populates it. `relic toon-migrate`
  remains available for manual runs. See FR-10, FR-15.
- **OQ-4 (resolved):** NFR-2 line-length limit — imposed limit or parser implementation
  detail? **Decision:** removed entirely. The toon format does not truncate any field.
  Token savings come from eliminating JSON structure, not from cutting content. A `tldr`
  that runs long is the author's problem to fix, not the parser's.
- **OQ-5 (resolved, superseded):** Constitution Principle V conflicts with toon output by default for
  search/deep-search. **Decision:** First amendment carved out `relic search` and `relic
  deep-search`. Superseded by OQ-6.
- **OQ-6 (resolved):** Should the toon-default rule apply to ALL list-returning commands
  or only search/deep-search? **Decision:** All list-returning commands must default to
  toon. The broader constitution amendment (2026-04-14 v2) supersedes the first amendment
  and establishes toon-default as the project-wide rule for any CLI output that is a flat
  entry list consumed by the LLM. NFR-8 updated accordingly.

---

## Decisions

- **Pipe-delimited, not tab-delimited:** Pipes are visible in all editors and terminals;
  tabs are invisible and frequently mangled by copy-paste.
- **Coexistence, not hard cutover:** Both formats live side-by-side. `manifest.toon`
  takes priority; `manifest.json` is the fallback. Teams migrate at their own pace.
- **`toon.ts` in `@relic/utility`:** Pure encode/decode with no filesystem dependency —
  belongs in the utility layer. Commands that use it stay in `@relic/core`.
- **No `relic spec-index` / `relic fix-index` CLI commands:** Index generation is an
  internal concern of `relic init`, `relic upgrade`, and `relic toon-migrate`. Exposing
  them as CLI commands creates two entry points for the same operation and adds surface
  area to the LLM's mental model. `relic search --deep --spec` replaces the read side.
- **No line-length limit in toon:** The format enforces no truncation. Long `tldr`
  values are preserved verbatim. Parsers must handle any line length.
- **`relic deep-search` merged into `relic search --deep`:** One command, one mental
  model. `--deep` means "no filtering, return everything in scope". Keywords still filter
  when combined with `--deep`. The scope flags (`--knowledge`, `--spec`, `--fix`) work
  identically with and without `--deep`. Fewer commands = simpler prompt instructions.
- **Toon output is the default for search and deep-search:** Writing toon files and then
  returning JSON to the LLM defeats the entire purpose. The CLI output is the LLM's
  input — it must be toon. `--json` exists for machine consumers only.
- **Unified 6-field CLI output line regardless of scope:** `source | name | path | tags | tldr | score`.
  The parser never needs to know which flag was used; the `source` field carries the context.
  The `path` field points directly to the file/folder — the LLM never needs a secondary lookup.
  The `score` field is always present: a positive integer for scored results, `0` for unscored
  (`--deep` with no keywords). This lets the LLM prioritise reading order without a separate
  sort step. Scoped output is a subset of the same format — never a different format.
- **`toon.ts` is a typed field serialiser — no domain types, no domain knowledge:**
  `encodeToon<T extends ToonField[]>(rows: T[], header?)` accepts typed tuples directly — callers
  pass `[string, string[], string, number]` rows without pre-converting every field to a string.
  The encoder serialises per type: strings → verbatim, numbers/booleans → `.toString()`,
  `string[]` → `.join(" ")`. `decodeToon(content: string): string[][]` returns raw string arrays;
  the caller (in `@relic/core`) maps to domain types. `ToonField` is the only exported type —
  it is a format constraint, not a domain type. The codec has no concept of `ManifestEntry`,
  `SearchResultEntry`, or any Relic domain. New consumers (future commands, output formats)
  can use toon encoding without importing domain types or touching the utility layer.
- **All domain types (`ManifestEntry`, `SearchResultEntry`) live in `@relic/core`:**
  `ManifestEntry` is defined in `toon-migrate.ts` (where index building lives);
  `SearchResultEntry` is defined in `search.ts` (where the search command lives).
  Both are re-exported from `@relic/core/index.ts`. Neither is defined in or re-exported
  from `@relic/utility`.
- **Mixed scoring in no-flag mode:** Knowledge entries score by tag-overlap; spec/fix
  entries score by substring match on name and tldr fields. Merged results are ranked
  globally by score — the best matches bubble up regardless of source.
- **All LLM-facing list reads route through toon helpers:** No command reads
  `manifest.json` directly after this spec. The toon read helper in `toon.ts` is the
  single access point, with JSON fallback baked in.
- **`ManifestEntry` is the single stored type; `SpecIndexEntry`/`FixIndexEntry` are dropped:**
  All three index spaces use the same 4-field schema. Separate spec/fix types add complexity
  with zero benefit — the `file` field convention (folder vs filename) is the only difference.
- **Migration creates name+file only; tags and tldr are empty:** The initial manifest.toon
  for specs and fixes is generated with just enough information to be useful. Users (or the
  LLM) are responsible for populating tags and tldr. A console warning directs them to do so.
- **`manifest.json` auto-converts on-the-fly:** The toon read helper does not error when
  `manifest.toon` is absent — it reads `manifest.json`, converts, writes the `.toon` file,
  and emits a warning. The LLM always gets toon output regardless of whether migration has
  been run. `relic validate` warns (not errors) about unconverted json manifests.
- **`relic init` writes empty toon files; `relic upgrade` populates them:** `init` has
  one job — scaffold structure. It writes empty header-only toon files and has no dependency
  on migration or index-building logic. `relic upgrade` handles population: it calls
  `buildSpecIndex`, `buildFixIndex`, and auto-runs `runToonMigrate` when needed. Mixing
  migration logic into init would couple two unrelated concerns.
- **`specify.md` populates its own toon entry:** After creating a spec, the LLM adds
  the new spec's entry (with its own tags and tldr from the Overview) to `specs/manifest.toon`.
  It reads only its own spec — no cross-spec reads required.
