# Relic Changelog

*All plan mutations and fix events are recorded here.*

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
