# SpecResolutionDomain

**Type:** domain
**Inferred from:** packages/core/src/commands/context.ts, packages/core/src/commands/fix.ts, packages/core/src/commands/scaffold.ts, packages/core/src/utils/spec-id.ts
**Confidence:** high

## Description
The logic for determining which spec is "active" for any given command. Implements a five-level priority chain: explicit arg > active fix owning spec > env var > `session.json` (`session.spec` field) > git branch inference.

## Key Entities
- **Active spec source**: One of `arg`, `env`, `session`, or `git-branch`
- **`RELIC_SPEC` env var**: Priority 2 override; useful in CI and scripted workflows
- **`session.spec`**: The `spec` field in `.relic/session.json` (gitignored). Written by `relic use <spec-id>`; priority 3. Defined in `SessionStateContract`.
- **Branch inference**: Extracts `NNN-slug` from the current git branch name; priority 4
- **`inferSpecFromBranch`**: Regex `(\d{3}-[a-z0-9-]+)` extracts spec ID from branch name
- **`resolveSpec(arg, relicDir)`** (`packages/utility/src/spec-id.ts`): Canonical utility implementing the full five-step chain. All workflow commands (`clarify`, `plan`, `analyse`, `tasks`, `implement`, `fix`, and `relic model`) call this function — no inline resolution chains. Step 2 (active fix → owning spec) ensures commands like `clarify` and `analyse` automatically use the fix's owning spec when a fix is active, without requiring the user to also set `session.spec`.
- **`resolveFix(arg, relicDir)`** (`packages/utility/src/spec-id.ts`): Canonical two-step fix resolution: `arg → session.fix`. Used by `solve`.

## Relationships
- Used by SpecDomain — all commands that need an active spec delegate to this domain
- Written by `relic use` / `runUse` — sets `session.spec` in `.relic/session.json`
- Read by `context`, `scaffold`, `fix`, `clarify`, `plan`, `analyse`, `tasks`, `implement`, `relic model`
- Extended by `FixDomain` — `session.fix` sits above `session.spec` in precedence for fix-aware commands

## Owned by
(unowned — assign when a spec takes responsibility)
