# Relic Changelog

*All plan mutations and fix events are recorded here.*

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
