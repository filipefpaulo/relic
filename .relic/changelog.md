# Relic Changelog

*All plan mutations and fix events are recorded here.*

## [2026-04-14] fix — 005-toon-manifest-format / 2026-04-14-init-must-not-write-manifest-json

Remove `fixes/manifest.json` write from `init.ts`. Fresh installs are toon-only; JSON coexistence applies only to upgrade paths where JSON already exists. Classification: misspecification — spec FR-10 and T-07 incorrectly preserved the JSON write for fresh init, conflating "coexistence for existing projects" with "coexistence from first init". Code changes: removed `writeText(…"manifest.json"…)` and its console log line. Knowledge layer: spec FR-10, plan Phase 6 step 2, and tasks T-07 updated to reflect toon-only init. Contract changes: none.

## [2026-04-14] implement — 005-toon-manifest-format

Implementation complete. All 19 tasks done (T-01 through T-19). 154 tests pass (16 new).

**New files:**
- `packages/utility/src/toon.ts` — generic toon codec; exports `ToonField`, `encodeToon<T>`, `decodeToon`
- `packages/core/src/commands/toon-migrate.ts` — defines `ManifestEntry`; exports `readManifestToon`, `buildSpecIndex`, `buildFixIndex`, `runToonMigrate`
- `packages/utility/src/__tests__/toon.test.ts` — 16 codec tests
- `packages/core/src/__tests__/toon-migrate.test.ts` — 10 migration tests
- (rewritten) `packages/core/src/__tests__/search.test.ts` — 11 search tests for new interface

**Modified files:**
- `packages/utility/src/index.ts` — exports `ToonField`, `encodeToon`, `decodeToon`
- `packages/core/src/commands/search.ts` — full rewrite; `SearchResultEntry` defined here; `--deep`/`--knowledge`/`--spec`/`--fix`/`--json` flags; 6-field toon output; `runDeepSearch` deleted
- `packages/core/src/commands/validate.ts` — prefers `manifest.toon`; JSON fallback warns; `warnings[]` in result
- `packages/core/src/commands/init.ts` — writes 6 empty `.toon` index files on init
- `packages/core/src/commands/upgrade.ts` — calls `runToonMigrate` after hooks refresh; `toon_migrated`/`toon_warnings` in result
- `packages/core/src/index.ts` — exports new types and functions; removes `runDeepSearch`/`SearchResult`/`ManifestEntry` from types.ts
- `packages/cli-node/src/bin.ts` + `bin.debug.ts` — `search` rewritten with all flags; `deep-search` deleted; `toon-migrate` command added
- `templates/preamble.md` — `relic search` mandatory entry point section added
- `templates/prompts/plan.md`, `specify.md`, `fix.md`, `scan.md` — `deep-search` → `search --deep`; manifest writes updated to toon
- `.relic/preamble.md` — synced from updated template

**One architectural decision during implementation:** `runToonMigrate` does not call `console.log` internally — the CLI bin command prints its own output. This allows upgrade.ts to call the function without polluting its own JSON output.

## [2026-04-14] clarify — 005-toon-manifest-format (9)

**Generic encoder signature; `ToonField` type exported from `@relic/utility`.**

`encodeToon` signature changed from `encodeToon(rows: string[][], ...)` to
`encodeToon<T extends ToonField[]>(rows: T[], header?: string): string` where
`type ToonField = string | number | boolean | string[]`.

Callers now pass typed tuples directly — e.g. `[source, name, path, tags, tldr, score]`
where `tags` is `string[]` and `score` is `number` — without pre-converting every field to
a string. The encoder handles serialisation per type: strings verbatim, numbers/booleans
via `.toString()`, string arrays via `.join(" ")`. All string values (including joined arrays)
are sanitised against ` | `.

`ToonField` is exported from `@relic/utility` as a format infrastructure type — it is the
codec's primitive constraint, analogous to a CSV library's `CsvCell` type. It is NOT a domain
type. Domain types (`ManifestEntry`, `SearchResultEntry`) remain in `@relic/core`.

`decodeToon` is unchanged — it returns `string[][]`; callers map to domain types.

Files updated: `spec.md` (FR-1, NFR-7, Decisions), `ToonFormatContract.md` (new ToonField
section, encoder contract), `plan.md` (Phase 1 impl + Phase 2 tests), `tasks.md` (T-01, T-02, T-03).

## [2026-04-14] clarify — 005-toon-manifest-format (8)

**`ManifestEntry` moved to `@relic/core`; toon codec becomes fully generic.**

`@relic/utility/toon.ts` now exports ONLY `encodeToon(rows: string[][], header?: string): string`
and `decodeToon(content: string): string[][]`. No types at all. The codec is a pure string-row
serialiser — it has no knowledge of domains, manifests, or entries.

`ManifestEntry` is defined and exported from `@relic/core/commands/toon-migrate.ts`. It is
re-exported from `@relic/core/index.ts`. Callers in `toon-migrate.ts` are responsible for
mapping `string[][]` ↔ `ManifestEntry[]`; callers in `search.ts` for mapping to `SearchResultEntry`.

This makes `toon.ts` reusable for any future pipe-delimited output — not just manifests.

Files updated: `spec.md` (FR-1, NFR-7, Decisions), `ToonFormatContract.md` (Types, Consumers,
encoder/decoder contracts), `plan.md` (Phase 1, 2, 3, 10, architecture overview), `tasks.md`
(T-01, T-02, T-03, T-04, T-11).

## [2026-04-14] clarify — 005-toon-manifest-format (7)

Two changes applied after plan review:

1. **`SearchResultEntry` moved from `@relic/utility` to `@relic/core`.** The toon codec
   (`toon.ts`) exports only what it needs to encode and decode: `ManifestEntry`, `encodeToon`,
   `decodeToon`. `SearchResultEntry` is a search business type — it belongs in `@relic/core`
   (`commands/search.ts`), exported from `@relic/core/index.ts`. Putting it in utility would
   force utility to grow with unrelated business types every time a new toon consumer emerges.
   The rule: `@relic/utility/toon.ts` = format infrastructure only.

2. **Score restored to CLI output.** FR-14 updated from 5-field to 6-field format:
   `source | name | path | tags | tldr | score`. Score is the tag-overlap or substring match
   count for scored results; `0` for `--deep` with no keywords (unscored mode). `SearchResultEntry`
   gains a `score: number` field. NFR-4 updated. `ToonFormatContract.md` updated. Plan phases
   1, 4, 9, 10 updated accordingly.

## [2026-04-14] plan — 005-toon-manifest-format

Plan created. 13 implementation phases across 4 layers.

**Touches:** `packages/utility/src/toon.ts` (new), `packages/core/src/commands/toon-migrate.ts` (new), `packages/core/src/commands/search.ts` (rewrite), `packages/core/src/commands/validate.ts` (modify), `packages/core/src/commands/init.ts` (modify), `packages/core/src/commands/upgrade.ts` (modify), `packages/cli-node/src/bin.ts`+`bin.debug.ts` (rewrite search cmd, add toon-migrate, remove deep-search), `templates/preamble.md` (add search reference section), all 11 `templates/prompts/*.md` (audit and update).

**Intersections:** Source file overlaps only — no ownership conflicts. `upgrade.ts` overlaps with spec 004 (additive call only, coordinate at implementation). `init.ts`, `utility/index.ts`, `core/index.ts`, `bin.ts`, `fix.md`, `solve.md`, `use.md` overlap with specs 002/003 (all additive, different sections).

## [2026-04-14] clarify — 005-toon-manifest-format (6)

Single change: **`relic init` also writes empty `manifest.toon` in each `shared/*/` subdirectory.**

FR-10 extended. `relic init` now creates six empty toon files: `specs/manifest.toon`,
`fixes/manifest.toon`, `shared/domains/manifest.toon`, `shared/contracts/manifest.toon`,
`shared/rules/manifest.toon`, and `shared/assumptions/manifest.toon` — all header-only,
zero entries. Every location that will eventually hold toon index data starts with a
valid (if empty) file from day one. No migration logic involved.

## [2026-04-14] clarify — 005-toon-manifest-format (5)

Single change: **`relic init` writes empty toon files from scratch; no migration dependency.**

FR-10 rewritten. `relic init` writes `specs/manifest.toon` (header `# specs index`) and
`fixes/manifest.toon` (header `# fixes index`) as empty files — comment header only, zero entries.
It does not call `buildSpecIndex`, `buildFixIndex`, or `runToonMigrate`. Init bootstraps structure;
upgrade populates it. The two concerns are now cleanly separated. `SpecIndexContract.md` and
`FixIndexContract.md` updated to reflect this split. OQ-3 resolution and Decisions updated.

## [2026-04-14] clarify — 005-toon-manifest-format (4)

Six changes applied:

1. **OQ-1 resolved (blank):** Tags and tldr are left empty on generation. No parsing of spec Overview. Index builders (`buildSpecIndex`, `buildFixIndex`) write name+file only.

2. **OQ-2 resolved (auto-convert):** `relic validate` warns when `manifest.json` exists without `manifest.toon`. The toon read helper goes further: if `manifest.toon` is absent it reads `manifest.json`, converts, writes the `.toon` file, emits a warning, and continues — the LLM always receives toon output, never a missing-manifest error. FR-6 and FR-4 updated.

3. **OQ-3 resolved (auto-migration in init + upgrade):** `relic init` (re-init) and `relic upgrade` automatically detect and migrate unconverted manifests. FR-10 updated; FR-15 added. `packages/core/src/commands/upgrade.ts` added to `touches_files` with intersection note (004 also touches it — additive call only).

4. **`relic spec-index` and `relic fix-index` dropped as CLI commands:** Index generation moves entirely into `toon-migrate.ts` as internal `buildSpecIndex`/`buildFixIndex` functions. FR-7, FR-8, FR-9 rewritten. Removed from `touches_files`: `spec-index.ts`, `fix-index.ts`, `spec-index.test.ts`, `fix-index.test.ts`. `SpecIndexContract.md` and `FixIndexContract.md` updated.

5. **`relic deep-search` removed; merged into `relic search --deep`:** FR-5 dropped. FR-4 rewritten as the single search entry point. `--deep` flag returns all entries unfiltered; keywords still filter when combined with `--deep`. Error when no keywords and no `--deep`. FR-13 updated to use `--deep` flag throughout. `ToonFormatContract.md` updated.

6. **`specify.md` populates toon entry; preamble gets full search reference:** FR-11 expanded to a full `relic search` command reference table + 6 enforcement rules. FR-13 adds `specify.md`-specific instruction: LLM appends its own spec entry (with populated tags/tldr) to `specs/manifest.toon` after spec creation.

## [2026-04-14] clarify — 005-toon-manifest-format (3)

Four changes applied:

1. **Unified 4-field schema for all three index spaces** — `specs/manifest.toon` and `fixes/manifest.toon` now use the same `name | file | tags | tldr` schema as `shared/*/manifest.toon`. The `file` field convention differs by space: spec entries use the folder name with trailing slash (`001-auth/`); fix entries use the filename. `SpecIndexContract.md` and `FixIndexContract.md` rewritten to reflect the unified schema. `SpecIndexEntry` and `FixIndexEntry` types dropped — `ManifestEntry` covers all three spaces.

2. **Migration creates name+file only; tags and tldr left empty** — `relic spec-index` and `relic fix-index` on first run generate entries with only `name` and `file` populated (empty strings for tags and tldr). A console warning is emitted directing the user to ask the LLM to populate the missing fields. This mirrors the knowledge index migration strategy: usable immediately, improved iteratively. FR-7, FR-8, `SpecIndexContract.md`, and `FixIndexContract.md` updated.

3. **CLI output upgraded to 5-field format** — `relic search` and `relic deep-search` now output `source | name | path | tags | tldr` (5 fields). The `path` field is computed at query time from the stored `file` field and provides the full relative path (e.g. `shared/domains/UserAuth.md`, `specs/001-auth/`, `fixes/2026-04-13-crash.md`). The LLM can open the file directly without a secondary lookup. FR-14, NFR-4, NFR-7, `ToonFormatContract.md` updated. `SearchResultEntry` type updated to `{ source, name, path, tags, tldr }`.

4. **Broader constitution amendment** — the 2026-04-14 amendment (search/deep-search only) superseded by a full amendment: toon is the enforced default for ALL list-returning commands. JSON-default applies only to commands that return structured objects. Constitution updated.

## [2026-04-14] clarify — 005-toon-manifest-format (2)

Two changes applied:

1. **`relic search` redesigned to mirror `relic deep-search`** — both commands now share identical scope flags: no flag = all three spaces (knowledge + specs + fixes); `--knowledge` = shared artifacts only; `--spec` = specs index only; `--fix` = fixes index only. `relic search` requires keywords and returns scored results; `relic deep-search` requires no keywords and returns everything in the selected scope. FR-4 and FR-5 rewritten accordingly.

2. **CLI output is toon by default for search and deep-search** — both commands output toon format by default; `--json` flag available for machine consumers. The unified 4-field CLI output line is `source | id | detail | tldr` (same format regardless of scope flag). `SearchResultEntry` type added to `@relic/utility`. This is the core concept: reading toon files and returning JSON to the LLM would negate the entire token savings. `ToonFormatContract.md` updated with the CLI output line format and the new type. Constitution amendment written and appended (2026-04-14) carving `relic search` and `relic deep-search` out of Principle V's JSON-default rule. OQ-5 resolved.

## [2026-04-14] clarify — 005-toon-manifest-format

Four changes applied:

1. **NFR-2 removed** — no line-length limit in toon. Truncating `tldr` at 300 chars was an imposed constraint with no benefit; token savings come from eliminating JSON structure, not from cutting content. NFRs renumbered; NFR-5 toon test updated to assert long tldr is preserved, not truncated. `ToonFormatContract.md` updated accordingly.

2. **`relic search` extended with `--spec` / `--fix` flags** — `--spec <keywords>` searches `specs/manifest.toon` by substring match against title+tldr; `--fix <keywords>` searches `fixes/manifest.toon` by match against fix-id+owning-spec+tldr. Both return typed arrays sorted by score. Tag-overlap scoring kept for the no-flag (shared artifact) mode. Three new types added: `SpecIndexEntry`, `FixIndexEntry` exported from `@relic/utility`.

3. **`relic deep-search` extended with `--spec` / `--fix` / `--knowledge` flags** — no flag = all three indexes merged with a `source` field; `--knowledge` = current behaviour (shared artifacts only); `--spec` = specs index only; `--fix` = fixes index only.

4. **Toon enforcement broadened** — FR-12 expanded to FR-12+FR-13: every LLM-facing list read routes through toon helpers. Prompt updates (FR-13) now explicitly reference `relic search --spec` and `relic search --fix` for cross-spec and fix lookups. `packages/core/src/__tests__/search.test.ts` added to `artifacts.json` touches_files.

## [2026-04-13] fix — 002-agent-permission-config / 2026-04-13-copilot-codex-per-command-files

Corrected Copilot engine to write individual `.github/prompts/relic.<name>.prompt.md` files (one per command, with YAML frontmatter) instead of a single `.github/copilot-instructions.md`. Corrected Codex engine to write individual `.codex/commands/relic.<name>.md` files instead of a single `.codex/instructions.md`. Also fixed both engines' PROMPT_NAMES to include "solve" (11 commands, matching Claude). Classification: misspecification — the implementation wrote single-file output despite FR-6 specifying per-file output; Decisions section incorrectly described "concatenation". No contract changes.

## [2026-04-13] clarify — 002-agent-permission-config

**Copilot and Codex engine output changed from single-file to per-command files.**

FR-6 revised: both engines now write one file per prompt command, matching the Claude pattern.
- Copilot: `.github/prompts/relic.<name>.prompt.md` with YAML frontmatter (`description: Relic <name> command`) — these appear as slash commands in Copilot Chat.
- Codex: `.codex/commands/relic.<name>.md` with prompt body written directly — these appear as slash commands in Codex.

Neither engine writes a single monolithic instruction file anymore. The template flow diagram in `plan.md` updated to reflect the new output paths. Phase 2 steps 3 & 4 and Phase 5 test assertions updated accordingly.

Root cause: FR-6 originally specified "runtime composition into a single file" based on the incorrect assumption that Copilot and Codex only support monolithic instruction files. Both engines support native per-command slash command files.

Fix reference: `2026-04-13-copilot-codex-per-command-files` (misspecification).

## [2026-04-13] implement — 004-cli-self-upgrade

Implementation complete. 127 tests pass (39 utility + 9 engines + 79 core).
New files: `engines-registry.ts`, `engines-registry.test.ts`, `upgrade.ts`,
`upgrade.test.ts`. Modified: `utility/src/index.ts`, `core/src/index.ts`,
`core/src/commands/init.ts`, `bin.ts`, `bin.debug.ts`, `cli-node/package.json`,
`publish-pypi.yml`. One plan deviation: added `_channel?: string` to `UpgradeOptions`
for test injection (module-level `channel` const cannot be overridden without it).
Introduced `const VERSION` in both bin files to avoid Commander `.version()` return-value
trap. `relic validate` passes. `relic upgrade` is now a fully functional production command.

## [2026-04-13] clarify — 004-cli-self-upgrade (3)

Ownership claimed for two previously unowned scan artifacts: `DistributionDomain.md`
and `TemplateDomain.md`. Both moved from `reads` to `owns` in `artifacts.json` and
`spec.md`. `TemplateDomain.md` stale reference to `templates/engines/` corrected —
that directory was deleted in spec 002; engine templates now live in
`packages/engines/src/generated/engine-templates.ts` (ENGINE_TEMPLATES map).

## [2026-04-13] tasks — 004-cli-self-upgrade

14 atomic tasks across 6 phases. Phase 0: INSTALL_CHANNEL defines in package.json and
publish-pypi.yml (T-01–T-03). Phase 1: engines-registry.ts utility + export (T-04–T-05).
Phase 2: engines.json writes in init.ts, bin.ts, bin.debug.ts (T-06–T-08). Phase 3: full
upgrade.ts implementation (T-09). Phase 4: @relic/core export (T-10). Phase 5: register
upgrade command in both binaries (T-11–T-12). Phase 6: tests (T-13–T-14).
No live task overlaps — all intersecting specs (002, 003) are fully released.

## [2026-04-13] clarify — 004-cli-self-upgrade (2)

Two corrections: (1) FR-12 replaced — npm and PyPI channels each query their own registry
(npmjs.org vs pypi.org); using a single npm endpoint risks false "up to date" when channels
are published independently. (2) OQ-1 resolved — INSTALL_CHANNEL embedded via
`bun build --define` (no separate entry points or code gen needed); no `pypi-uv`/`pypi-pip`
split is needed — the same PyPI wheel is installed by either tool; runtime try-uv-then-pip
fallback correctly identifies the managing tool. Decisions section added to spec.md.
artifacts.json adds `.github/workflows/publish-pypi.yml` to touches_files.

## [2026-04-13] clarify — 004-cli-self-upgrade

FR-7 replaced: engine detection no longer relies on presence of `.github/copilot-instructions.md`
or `.codex/instructions.md` — those files can exist for non-Relic reasons. Engine detection
now uses `.relic/engines.json`, a committed JSON array written by `relic init --engine` and
`relic add-engine`. FR-13 added: both commands must write/update engines.json (idempotent, no
duplicates). FR-14 added: graceful degradation when engines.json is absent (warn + skip refresh).
UpgradeDomain.md updated with engines.json schema and Engine Registry section.
artifacts.json touches_files expanded: `init.ts` and `add-engine.ts` added.
OQ-4 added noting the intersection with specs 003 and 002 (both released, no live conflict).

## [2026-04-13] specify — 004-cli-self-upgrade

New spec: `relic upgrade` command for self-updating the CLI and refreshing engine hook
files. Two distribution channels supported (npm, pypi) via build-time `INSTALL_CHANNEL`
constant. Protected file list enforces that the shared brain, specs, fixes, constitution,
and changelog are never touched during upgrade. New shared artifact: `UpgradeDomain.md`.
Touches: `packages/core/src/commands/upgrade.ts` (new), `bin.ts`, `bin.debug.ts`,
`packages/cli-node/package.json`. Reads: `DistributionDomain`, `TemplateDomain`.
Open question blocking plan: OQ-1 (INSTALL_CHANNEL embedding mechanism).

## [2026-04-13] implement — 003-fix-solve-workflow

[implement] 003-fix-solve-workflow: Implementation complete. session.json replaces current-spec as
the single gitignored session state file (spec + fix fields). New packages/utility/src/session.ts
provides readSession/writeSession. relic init now scaffolds fixes/ dir and fixes/manifest.json.
relic use gains --fix <id> and --clear-fix flags. relic context gains current_fix field and
reports active_spec_source: "session". fix.md rewritten as two-stage diagnosis prompt; solve.md
created as apply stage; use.md updated with fix-ID detection branch. All 109 tests pass;
relic validate: valid. Claude engine PROMPT_NAMES updated to include "solve" (11 slash commands).

## [2026-04-13] clarify — 003-fix-solve-workflow (6)

Five issues from second /relic.analyse pass resolved:
(1) spec.md Scope section: stale "New X artifact" phrasing corrected to present tense;
(2) spec.md Shared Artifacts: SessionStateContract added to Owns list (was missing from prose,
    correct in artifacts.json);
(3) plan.md Phase 6 step 5 and Intersection Notes: bin.debug.ts mentioned alongside bin.ts;
(4) tasks.md: T-17a and T-17b promoted to Phase 0 "DO THIS FIRST" at top of file (were
    previously misplaced in Phase 12 after all implementation phases, contradicting the
    ordering requirement); ordering note updated to reflect Phase 0 first;
(5) tasks.md: init.test.ts note hardened from "review; update if assertions fail" to
    "WILL break; must update as part of T-03" (confirmed by reading actual test at line 38).

## [2026-04-13] clarify — 003-fix-solve-workflow (5)

Three gaps found by /relic.analyse resolved: (1) `packages/cli-node/src/bin.debug.ts` added
to `artifacts.json` touches_files and plan File Changes table — it registers the same `use`
command as `bin.ts` and needs the same `--fix`/`--clear-fix` flags. (2) Task T-17b added:
update 3 stale manifest entries (SpecResolutionDomain tldr/tags, FixDomain tags, SessionStateContract
tags) that still reference `current-spec`/`current-fix`. (3) Task T-17a added: amend
`constitution.md` to replace the stale `current-spec` principle line and append a dated
amendment block — must be done before TypeScript migration tasks begin.

## [2026-04-13] clarify — 003-fix-solve-workflow (4)

Added NFR-8: all prompts (`solve.md`, `fix.md`, and all future prompts) must open with the
standard preamble/constitution block — the AI must read both files in full before acting.
The preamble is non-negotiable. If a prompt behaviour deviates from a constitution principle,
a constitution amendment authorising the deviation must be written first and referenced in
the prompt. Plan Phases 7, 8, and 9 updated to include the mandatory preamble block
specification for each prompt file written or modified by this spec.

## [2026-04-13] plan — 003-fix-solve-workflow

11-phase implementation plan. Key touches: `packages/utility/src/session.ts` (new — session
read/write helpers), `packages/core/src/commands/{init,scaffold,context,use,fix}.ts` (session.json
migration), `packages/cli-node/src/bin.ts` (--fix/--clear-fix flags on `use`), 3 prompt files
(fix.md rewrite, solve.md new, use.md amendment).

Shared artifact amended: `FixDocumentContract` — status simplified to `pending | solved`
(removed `approved`; calling `/relic.solve` is now the approval act).

artifacts.json `touches_files` expanded: added `scaffold.ts`, `bin.ts`, and
`packages/utility/src/{session,index}.ts`.

Intersections: `packages/utility/` and `templates/prompts/` both in spec 002's touches_files;
002 is implemented and released (v0.4.0) — no live conflict.

## [2026-04-13] clarify — 003-fix-solve-workflow (3)

Four changes: (1) Removed `current-spec` entirely — resolution chain is now arg > env >
`session.json` > git-branch; `SpecResolutionDomain` updated accordingly. (2) FR-2 corrected —
when no spec owns the code, user is told to run `/relic.specify` (not `relic scaffold`; scaffold
is internal to prompts). (3) FR-12 removed — calling `/relic.solve` is itself the approval act;
no explicit status flag required. (4) NFR-2 promoted — `relic init` now scaffolds `.relic/fixes/`
and `fixes/manifest.json` (empty `[]`) as a forward investment for future global fix search;
prompts no longer create this directory at runtime. `SessionStateContract`, `FixDomain`,
`ContextResultContract` all updated to remove remaining `current-spec` references.

## [2026-04-13] clarify — 003-fix-solve-workflow

Replaced `.relic/current-fix` flat text file proposal with `.relic/session.json` structured
JSON. A single gitignored file now holds all personal session state (`spec` + `fix` fields),
replacing both `current-spec` and the proposed `current-fix`. Backwards compat: if
`session.json` absent, `relic context` falls back to reading `current-spec`. New writes
always go to `session.json`.

New shared artifact: `SessionStateContract` — defines the `session.json` schema, write rules
(read-merge semantics), and gitignore requirement. Added to `artifacts.json` `owns`.
`FixDomain` and `ContextResultContract` updated to reference `session.fix`/`session.json`.

## [2026-04-13] specify — 003-fix-solve-workflow

New spec: full cross-spec fix and solve pipeline. `/relic.fix` becomes a cross-spec command
that enforces spec ownership as a gate: unowned code cannot be fixed until a spec is written.
Two-stage pipeline (diagnose → human review → solve) with fix session state in
`.relic/current-fix`. New `/relic.solve` command applies approved fixes.

New shared artifacts: `FixDomain`, `FixDocumentContract`. Ownership claimed for
`ContextResultContract` (previously unowned); amended to add `current_fix` field.

## [2026-04-13] clarify — 002-agent-permission-config (2)

Correction: the gitignore for `packages/engines/src/generated/` must live in
`packages/engines/.gitignore` (package-level), not in the root `.gitignore`. Root gitignore
is not touched by this spec. Spec NFR-4, plan Phase 3 step 4, file changes table, and
task T-14b all updated to reflect this.

## [2026-04-13] clarify — 002-agent-permission-config

`packages/engines/src/generated/engine-templates.ts` was committed to git — this is a bug.
The plan already marked it "(generated)" but omitted the `.gitignore` entry. NFR-4 updated
to make the gitignore requirement explicit. Plan updated with a step to add the entry and
untrack the file. Task T-14b added.

## [2026-04-13] implement — 002-agent-permission-config

Implementation complete. Created `@relic/utility` and `@relic/engines` packages; all import sites
in `packages/core` updated to use workspace packages; added permission configs for Claude
(`settings.json` Bash allow rule) and Codex (`config.toml` prefix_rules); deleted
`templates/engines/` duplication (Copilot/Codex now assembled at runtime from ENGINE_TEMPLATES);
all 95 tests pass across 3 packages; `relic validate` reports `valid: true`.

## [2026-04-12T00:00:00.000Z] scan — bootstrap

[scan] Initial artifact scan: generated 14 artifacts from existing codebase.
  Domains: SpecDomain, SharedArtifactDomain, SpecResolutionDomain, DistributionDomain, TemplateDomain.
  Contracts: ScanManifestContract, ContextResultContract, ArtifactsJsonContract, ManifestJsonContract, ScaffoldResultContract.
  Rules: ArtifactOwnershipRules, SpecIdNamingRules, ChangelogAppendOnlyRule, SpecFilesAllowlistRule, ArtifactPathPrefixRule.
  Assumptions: BunRuntimeAvailability, SingleSpecPerBranch, GitAvailability, ClaudeAsDefaultEngine.
  All artifacts are unowned — assign ownership via artifacts.json when creating the first spec.
  Confidence is medium on DistributionDomain, TemplateDomain, and all assumptions — review before a spec claims ownership.

## [2026-04-12T00:01:00.000Z] clarify — 001-workflow-test-suite

[clarify] 001-workflow-test-suite: added FR-6 and CI workflow scope.
  Added requirement to create `.github/workflows/test.yml` that runs `bun run test` on every PR
  and blocks merging on failure. Added to touches_files in artifacts.json. No shared artifact
  changes — this is a new file with no ownership conflicts.

## [2026-04-12T00:02:00.000Z] plan — 001-workflow-test-suite

[plan] 001-workflow-test-suite: Plan created. 7 phases, 14 files.
  Touches: packages/core/src/__tests__/ (13 test files), package.json, .github/workflows/test.yml.
  Key decisions: explicit bun test path to avoid scanning workspace root; process.exit error
  paths not tested (no fs mocking per constitution); scan.ts gets smoke test against real
  project dir rather than isolated temp dir.
  Intersections: none — only spec in repository.

## [2026-04-12T00:03:00.000Z] clarify — 001-workflow-test-suite

[clarify] 001-workflow-test-suite: changed test script location from root to per-package.
  packages/core/package.json now owns the test command ("bun test src/__tests__").
  Root package.json uses "bun run --filter '*' test" to delegate to all workspace packages
  that define a test script — new packages with tests participate automatically.
  Updated: spec.md (FR-4, scope, decisions), plan.md (Phase 1, file changes table),
  tasks.md (T-01 split into T-01a/T-01b), artifacts.json (added packages/core/package.json
  to touches_files), TestingRules.md (script location section added).

## [2026-04-12] implement — 001-workflow-test-suite

[implement] 001-workflow-test-suite: Implementation complete. 86 tests across 12 files — all passing.
  Created: spec-id.test.ts, intersection.test.ts, fs.test.ts, changelog.test.ts,
  context-builder.test.ts, init.test.ts, use.test.ts, scaffold.test.ts, validate.test.ts,
  context.test.ts, search.test.ts, scan.test.ts, .github/workflows/test.yml.
  One test corrected during implementation: inferSpecFromBranch returns the full greedy
  NNN-slug match (not a truncated prefix) — test updated to reflect actual behaviour.

## [2026-04-12] specify — 002-agent-permission-config

[specify] 002-agent-permission-config: Spec created. Eliminate per-command relic approval prompts by
  writing committed permission configs during engine setup. Claude: .claude/settings.json with
  Bash(relic *) allow rule (merge, not overwrite). Codex: .codex/config.toml (pending CLI
  verification). Copilot: no equivalent mechanism — out of scope. Intersections: none.

## [2026-04-12] clarify — 002-agent-permission-config

[clarify] 002-agent-permission-config: Scope significantly expanded. Original scope was
  only permission config writes (settings.json, config.toml). New scope adds a full engine
  package refactor: introduce packages/engines (@relic/engines) as a dedicated workspace
  package owning all engine logic and templates. Each engine gets an isolated directory.
  Claude prompts move from templates/prompts/ into the engines package. Copilot and Codex
  single-file outputs are assembled from shared prompt sources, eliminating the duplication
  that currently makes prompt updates a 3-file change. Permission configs (FR-6/7/8) become
  part of each engine's write output. Two open questions block planning: Codex config schema
  and embed strategy (single script vs separate).

## [2026-04-12] clarify — 002-agent-permission-config (2)

[clarify] 002-agent-permission-config: All three open questions resolved. Codex config
  schema confirmed: .codex/config.toml with [rules] prefix_rules, pattern ["relic"],
  decision "allow". String-based idempotency check (no TOML parser). Embed strategy:
  new scripts/embed-engine-templates.ts reads from root templates/ (source of truth) and
  produces packages/engines/src/generated/engine-templates.ts; @relic/core TEMPLATES map
  stripped of prompts/* and engines/* keys. Copilot/Codex output: runtime composition from
  ENGINE_TEMPLATES map — cheap, no build-time concatenation needed. No blocking open
  questions remain. Spec status: ready for /relic.plan.

## [2026-04-12] clarify — 002-agent-permission-config (3)

[clarify] 002-agent-permission-config: Two final clarifications applied. (1) Templates
  single-update-point confirmed: templates/prompts/ and templates/engines/ never move —
  scripts/embed-engine-templates.ts reads from them and produces ENGINE_TEMPLATES in the
  engines package generated/ dir. No templates live in packages/engines/ source. (2) Testing
  requirements added: NFR-5 — packages/engines needs its own test suite (src/__tests__/,
  test script, covered by root --filter); NFR-6 — packages/core init.test.ts must be
  reviewed post-refactor since init calls runAddEngine. No blocking questions remain.
  Spec fully resolved — ready for /relic.plan.

## [2026-04-12] clarify — 002-agent-permission-config (4)

[clarify] 002-agent-permission-config: Corrected source-of-truth definition. templates/engines/
  is NOT a source of truth — it is deleted entirely as part of this spec (it was the root
  of the duplication problem). Only two sources of truth exist: templates/prompts/ (10 prompt
  files, sole input to embed-engine-templates.ts) and the 5 root scaffold files (preamble.md,
  constitution.md, spec.md, plan.md, tasks.md — stay in @relic/core TEMPLATES, untouched).
  All references to templates/engines/ as an input have been removed from the spec.

## [2026-04-12] clarify — 002-agent-permission-config (5)

[clarify] 002-agent-permission-config: Added packages/utility (@relic/utils) as the
  dependency floor. fs.ts and spec-id.ts move from packages/core/src/utils/ to
  packages/utility/src/ — not copied, moved. Both @relic/core and @relic/engines import
  from @relic/utils. Dep graph: utils <- engines, utils <- core, engines <- core. No
  cycles possible. fs.test.ts and spec-id.test.ts move to packages/utility/src/__tests__/.
  Decision: new package per lifecycle boundary, new file per new utility within a concern.
  All three new packages (utils, engines, plus engines tests) covered by CI --filter.

## [2026-04-12] clarify — 002-agent-permission-config (6)

[clarify] 002-agent-permission-config: Package renamed from @relic/utils / packages/utility
  to @relic/utility / packages/utility throughout spec and artifacts.json.

## [2026-04-12] plan — 002-agent-permission-config

[plan] 002-agent-permission-config: Plan created. 6 phases, 36 file changes.
  Touches: packages/utility/ (new), packages/engines/ (new), scripts/embed-engine-templates.ts
  (new), packages/core/src/commands/add-engine.ts (delete), packages/core/src/utils/ (delete),
  12 core import sites (modify), package.json (modify).
  Deletes: templates/engines/ entirely.
  Intersections: spec 001 created fs.test.ts and spec-id.test.ts (moved, not conflicting);
  package.json build scripts are additive.

## [2026-04-12] cross-spec — 001-workflow-test-suite / 002-agent-permission-config

[cross-spec] 002-agent-permission-config will move packages/core/src/__tests__/fs.test.ts
  and spec-id.test.ts to packages/utility/src/__tests__/ (tasks T-05, T-06). Test logic
  unchanged; import paths adjusted. Ownership of those files transfers to spec 002 at move
  time. Spec 001 retains ownership of shared/rules/TestingRules.md. Note added to spec
  001 Open Questions section for implementer awareness.

## [2026-04-15T00:00:00.000Z] /relic.clarify — ChangelogAppendOnlyRule: tightened to cross-artifact-mutation-only

Spec 006-structured-write-command clarify amended ChangelogAppendOnlyRule.md. The rule previously required a changelog entry for every plan mutation and fix event. It now requires entries only when a cross-artifact mutation occurs — when one command amends an artifact originally created by a different command (e.g. fix amending a spec, clarify changing a contract). Progress, completion, and new-entry creation events must not write changelog entries. Entry format also updated: `## [<ISO-date>] <slash-command> — <name>` with description body on following lines.

## [2026-04-15T16:48:07.851Z] /relic.implement — 006-structured-write-command: implementation complete

relic write command implemented; all prompts updated to use structured writes.

## [2026-04-15T18:00:06.060Z] /relic.solve — 006-structured-write-command / 2026-04-15-missing-tests-write-command: added write.test.ts

Spec 006 plan and tasks did not include a test phase. Created write.test.ts with 20 tests covering runWrite (changelog and toon paths), appendChangelogEntry, validateWritePayload, upsertToonEntry, toon target routing, and metadata merging. Amended spec.md scope, plan.md Phase 7, tasks.md T-19, and artifacts.json. Classification: misspecification — code was correct, spec omitted test requirement.
