# Plan: CLI Self Upgrade

**Spec ID:** 004-cli-self-upgrade
**Status:** active

---

## Architecture Overview

The implementation has three layers:

**Layer 1 — Engine registry utilities (`@relic/utility`)**
`engines-registry.ts` adds `readEnginesRegistry` / `writeEnginesRegistry` to the utility
package, following the same pattern as `session.ts`. Both `init.ts` and the `bin.ts`
add-engine handler call `writeEnginesRegistry` after successfully writing hook files.

**Layer 2 — Upgrade command (`@relic/core`)**
`packages/core/src/commands/upgrade.ts` implements `runUpgrade`. It reads the build-time
`INSTALL_CHANNEL` constant (injected via `bun build --define`), fetches the latest version
from the channel-specific registry, optionally spawns the package manager as a child
process via `child_process.spawnSync`, and re-runs `runAddEngine` for each engine in
`engines.json`. All file writes are constrained to the refresh-safe list from `UpgradeDomain`.

**Layer 3 — CLI wiring (`bin.ts`, `bin.debug.ts`, build scripts)**
Both binaries register the `upgrade` command. `packages/cli-node/package.json` injects
`INSTALL_CHANNEL="npm"` at build time; `.github/workflows/publish-pypi.yml` injects
`INSTALL_CHANNEL="pypi"` at compile time. Dev builds get neither — the command falls
back to the `"dev"` channel (FR-4 warning path).

**`packages/core/src/commands/add-engine.ts` correction:**
This file does not exist. The `runAddEngine` function lives in `packages/engines/src/index.ts`
and is re-exported via `@relic/core`. The engines.json write for the `add-engine` command
is done in the `bin.ts` handler (already in `touches_files`), not in a new core command file.
The spec's `touches_files` entry is corrected here — no new `add-engine.ts` is created.

---

## Implementation Phases

### Phase 0 — Build-time `INSTALL_CHANNEL` defines

1. In `packages/cli-node/package.json`, append `--define 'INSTALL_CHANNEL="npm"'` to
   both `build:npm` and `build:binary` scripts.
2. In `.github/workflows/publish-pypi.yml`, append
   `--define 'INSTALL_CHANNEL="pypi"'` to the `bun build ... --compile` command in the
   `Compile binary` step. All 5 matrix targets get the same define.

### Phase 1 — Engine registry utilities in `@relic/utility`

1. Create `packages/utility/src/engines-registry.ts`:
   - `export function readEnginesRegistry(relicDir: string): string[]` — reads
     `.relic/engines.json`; returns `[]` if file is absent or malformed.
   - `export function writeEnginesRegistry(relicDir: string, engines: string[]): void` —
     deduplicates, sorts, writes `.relic/engines.json` as formatted JSON.
2. Add exports to `packages/utility/src/index.ts`:
   `export { readEnginesRegistry, writeEnginesRegistry } from "./engines-registry.ts"`

### Phase 2 — Write `engines.json` from init and add-engine

1. In `packages/core/src/commands/init.ts`: after the engine loop
   (`for (const engine of options.engines) { await runAddEngine(...) }`), add a call to
   `writeEnginesRegistry(relicDir, options.engines)` when `options.engines.length > 0`.
   Add console output: `  .relic/engines.json  (registered engines: <list>)`.

2. In `packages/cli-node/src/bin.ts`, in the `add-engine` handler: after
   `await runAddEngine(...)`, read the current registry, append the new engine
   (deduplicated), and write it back. Import `readEnginesRegistry`, `writeEnginesRegistry`
   from `@relic/utility`. Apply the same change to `bin.debug.ts`.

### Phase 3 — `packages/core/src/commands/upgrade.ts`

New file. Key implementation details:

**INSTALL_CHANNEL declaration:**
```typescript
// Injected at build time by bun build --define. Undefined in dev builds.
declare const INSTALL_CHANNEL: string | undefined;
const channel = typeof INSTALL_CHANNEL !== "undefined" ? INSTALL_CHANNEL : "dev";
```

**Interfaces (exported):**
```typescript
export interface UpgradeOptions {
  check: boolean;         // --check: version check only
  promptsOnly: boolean;   // --prompts: hook refresh only
  text: boolean;          // --text: human-readable output
  currentVersion: string;
  relicDir?: string;      // resolved by findRelicDir if absent
}

export interface UpgradeCheckResult {
  current: string;
  latest: string;
  update_available: boolean;
  channel: string;
}

export interface UpgradeResult {
  check: UpgradeCheckResult | null;
  binary_upgraded: boolean;
  hooks_refreshed: string[];    // engine names refreshed
  preamble_updated: boolean;
  warnings: string[];
}
```

**`checkVersion(channel, currentVersion)`:**
- `"npm"`: `fetch("https://registry.npmjs.org/relic-cli/latest")` → `.version`
- `"pypi"`: `fetch("https://pypi.org/pypi/relic-cli/json")` → `.info.version`
- `"dev"`: return `null` (caller logs FR-4 warning and exits)
- Network error → throw with clear message (NFR-4)

**`upgradeBinary(channel, targetVersion)`:**
- `"npm"`: `spawnSync("npm", ["install", "-g", `relic-cli@${targetVersion}`], { stdio: "inherit" })`
- `"pypi"`: try `spawnSync("uv", ["tool", "upgrade", "relic-cli"], { stdio: "inherit" })`
  — if `status !== 0`, try `spawnSync("pip", ["install", "--upgrade", "relic-cli"], { stdio: "inherit" })`
  — if both fail, throw with manual upgrade instructions

**`refreshHooks(relicDir, projectDir)`:**
- Read `.relic/engines.json` via `readEnginesRegistry(relicDir)`
- If `engines.json` file does not exist: push FR-14 warning to result, return early
- For each engine: `await runAddEngine({ engine, projectDir })`
- Compare and overwrite `.relic/preamble.md` with `TEMPLATES["preamble.md"]`; record
  whether content changed

**`runUpgrade` orchestration:**
```
channel === "dev"  → output warning + manual instructions + return
--prompts          → refreshHooks → output result
--check            → checkVersion → output check result
default            → checkVersion
                     → already up to date? output + return
                     → upgradeBinary → refreshHooks → output result
```

### Phase 4 — Export from `@relic/core`

In `packages/core/src/index.ts`:
```typescript
export { runUpgrade } from "./commands/upgrade.ts";
export type { UpgradeOptions, UpgradeCheckResult, UpgradeResult } from "./commands/upgrade.ts";
```

### Phase 5 — Register `relic upgrade` in `bin.ts` and `bin.debug.ts`

Add to both files:
```typescript
program
  .command("upgrade")
  .description("Upgrade relic-cli and refresh AI engine hook files")
  .option("--check", "Check for updates only, do not install", false)
  .option("--prompts", "Refresh engine hook files only, skip binary upgrade", false)
  .option("--text", "Human-readable output instead of JSON", false)
  .action(async (opts: { check: boolean; prompts: boolean; text: boolean }) => {
    const relicDir = findRelicDir(process.cwd()) ?? undefined;
    await runUpgrade({
      check: opts.check,
      promptsOnly: opts.prompts,
      text: opts.text,
      currentVersion: program.version(),
      relicDir,
    });
  });
```

### Phase 6 — Tests

**`packages/utility/src/__tests__/engines-registry.test.ts`:**
- `readEnginesRegistry`: returns `[]` when file absent
- `readEnginesRegistry`: returns correct values when file exists
- `writeEnginesRegistry`: creates file, deduplicates, sorts
- Round-trip: write then read preserves values

**`packages/core/src/__tests__/upgrade.test.ts`:**
- FR-4: `channel = "dev"` produces warning in output, no fetch call
- FR-14: missing `engines.json` produces warning, does not throw
- `--check` with mocked fetch: returns correct `UpgradeCheckResult` shape
- `--check` when already up to date: `update_available: false`
- `--prompts` with populated `engines.json`: calls `runAddEngine` for each entry
- `--prompts` with missing `engines.json`: emits FR-14 warning, no `runAddEngine` calls

---

## File Changes

| File | Action | Notes |
|------|--------|-------|
| `packages/utility/src/engines-registry.ts` | **create** | `readEnginesRegistry`, `writeEnginesRegistry` |
| `packages/utility/src/index.ts` | **modify** | export registry helpers |
| `packages/utility/src/__tests__/engines-registry.test.ts` | **create** | round-trip tests |
| `packages/core/src/commands/upgrade.ts` | **create** | full upgrade command |
| `packages/core/src/index.ts` | **modify** | export `runUpgrade` and types |
| `packages/core/src/__tests__/upgrade.test.ts` | **create** | flag logic, FR-4, FR-14, version check |
| `packages/core/src/commands/init.ts` | **modify** | write `engines.json` after engine loop |
| `packages/cli-node/src/bin.ts` | **modify** | add `upgrade` command; update add-engine handler |
| `packages/cli-node/src/bin.debug.ts` | **modify** | add `upgrade` command; update add-engine handler |
| `packages/cli-node/package.json` | **modify** | `--define INSTALL_CHANNEL='"npm"'` on build scripts |
| `.github/workflows/publish-pypi.yml` | **modify** | `--define INSTALL_CHANNEL='"pypi"'` on compile step |

---

## Shared Artifact Changes

| Artifact | Action | Notes |
|----------|--------|-------|
| `shared/domains/UpgradeDomain.md` | none needed | already captures the full domain |

---

## Intersection Notes

- **`init.ts`** — last touched by spec 003 (fully released, v0.5.0). No live conflict.

- **`bin.ts` / `bin.debug.ts`** — last touched by spec 003 (fully released). No live conflict.

- **`packages/utility/src/`** — last touched broadly by spec 002 (fully released). New
  `engines-registry.ts` follows the established `session.ts` pattern. No conflict.

- **`.github/workflows/publish-pypi.yml`** — not previously in any spec's `touches_files`.
  Claimed by this spec via `artifacts.json`. No conflict.

- **`packages/core/src/commands/add-engine.ts` — does not exist.** The spec's
  `touches_files` entry is a mistake (the logic lives in `packages/engines/src/index.ts`).
  No new `add-engine.ts` will be created. The engines.json write is done in `bin.ts`'s
  existing add-engine handler, which is already listed in `touches_files`.

---

## Changelog Reference

See entry written after this plan session in `.relic/changelog.md`.
