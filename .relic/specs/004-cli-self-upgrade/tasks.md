# Tasks: CLI Self Upgrade

**Spec ID:** 004-cli-self-upgrade
**Generated from plan:** 2026-04-13

---

## Phase 0 — Build-time `INSTALL_CHANNEL` defines

- [ ] **T-01** In `packages/cli-node/package.json`, append `--define 'INSTALL_CHANNEL="npm"'` to the `build:npm` script
  - Before: `bun build src/bin.ts --target node --outfile dist/relic.js`
  - After: `bun build src/bin.ts --target node --outfile dist/relic.js --define 'INSTALL_CHANNEL="npm"'`

- [ ] **T-02** In `packages/cli-node/package.json`, append `--define 'INSTALL_CHANNEL="npm"'` to the `build:binary` script
  - Before: `bun build src/bin.ts --compile --outfile dist/relic`
  - After: `bun build src/bin.ts --compile --outfile dist/relic --define 'INSTALL_CHANNEL="npm"'`

- [ ] **T-03** In `.github/workflows/publish-pypi.yml`, append `--define 'INSTALL_CHANNEL="pypi"'` to the `Compile binary` step's `bun build` command (applies to all 5 matrix targets via the shared `run` block)
  - The step currently runs: `bun build packages/cli-node/src/bin.ts --compile --target ${{ matrix.bun_target }} --outfile packages/cli-python/relic/${{ matrix.binary }}`
  - Append: `--define 'INSTALL_CHANNEL="pypi"'`

---

## Phase 1 — Engine registry utilities in `@relic/utility`

- [ ] **T-04** Create `packages/utility/src/engines-registry.ts`
  - `export function readEnginesRegistry(relicDir: string): string[]`
    - Reads `<relicDir>/engines.json`; returns `[]` if the file is absent or JSON is malformed
    - Use `readJson` from `./fs.ts`
  - `export function writeEnginesRegistry(relicDir: string, engines: string[]): void`
    - Deduplicates (via Set), sorts alphabetically, writes `<relicDir>/engines.json` as formatted JSON
    - Use `writeJson` from `./fs.ts`

- [ ] **T-05** In `packages/utility/src/index.ts`, export the new helpers:
  ```typescript
  export { readEnginesRegistry, writeEnginesRegistry } from "./engines-registry.ts";
  ```
  _(Depends on T-04)_

---

## Phase 2 — Write `engines.json` from `init` and `add-engine`

- [ ] **T-06** In `packages/core/src/commands/init.ts`, after the engine loop, write `engines.json`:
  - Import `writeEnginesRegistry` from `@relic/utility`
  - After `for (const engine of options.engines) { await runAddEngine(...) }`, add:
    ```typescript
    if (options.engines.length > 0) {
      writeEnginesRegistry(relicDir, options.engines.map(String));
      console.log(`  .relic/engines.json  (registered engines: ${options.engines.join(", ")})`);
    }
    ```
  _(Depends on T-05)_

- [ ] **T-07** In `packages/cli-node/src/bin.ts`, update the `add-engine` handler to persist the engine to the registry:
  - Import `readEnginesRegistry`, `writeEnginesRegistry` from `@relic/utility`
  - After `await runAddEngine(...)`, add:
    ```typescript
    const engines = readEnginesRegistry(relicDir);
    writeEnginesRegistry(relicDir, [...engines, engine]);
    ```
  _(Depends on T-05)_

- [ ] **T-08** Apply the same change to `packages/cli-node/src/bin.debug.ts` add-engine handler (mirrors T-07)
  _(Depends on T-05)_

---

## Phase 3 — `packages/core/src/commands/upgrade.ts`

- [ ] **T-09** Create `packages/core/src/commands/upgrade.ts` — full implementation:

  **INSTALL_CHANNEL declaration (top of file):**
  ```typescript
  declare const INSTALL_CHANNEL: string | undefined;
  const channel = typeof INSTALL_CHANNEL !== "undefined" ? INSTALL_CHANNEL : "dev";
  ```

  **Exported interfaces:**
  ```typescript
  export interface UpgradeOptions {
    check: boolean;
    promptsOnly: boolean;
    text: boolean;
    currentVersion: string;
    relicDir?: string;
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
    hooks_refreshed: string[];
    preamble_updated: boolean;
    warnings: string[];
  }
  ```

  **`checkVersion(channel, currentVersion)`:**
  - `"npm"`: `fetch("https://registry.npmjs.org/relic-cli/latest")` → `.version`
  - `"pypi"`: `fetch("https://pypi.org/pypi/relic-cli/json")` → `.info.version`
  - `"dev"`: return `null` (caller logs FR-4 warning)
  - Network error → throw with clear message

  **`upgradeBinary(channel, targetVersion)`:**
  - `"npm"`: `spawnSync("npm", ["install", "-g", `relic-cli@${targetVersion}`], { stdio: "inherit" })`
  - `"pypi"`: try `spawnSync("uv", ["tool", "upgrade", "relic-cli"], { stdio: "inherit" })`; if `status !== 0`, try `spawnSync("pip", ["install", "--upgrade", "relic-cli"], { stdio: "inherit" })`; if both fail, throw with manual instructions

  **`refreshHooks(relicDir, projectDir, result)`:**
  - `readEnginesRegistry(relicDir)` → if absent (empty + warning via FR-14), push FR-14 warning and return early
  - For each engine: `await runAddEngine({ engine, projectDir })`; push to `result.hooks_refreshed`
  - Compare `.relic/preamble.md` with `TEMPLATES["preamble.md"]`; overwrite if different; set `result.preamble_updated`

  **`runUpgrade` orchestration (FR-4, --prompts, --check, default):**
  - `channel === "dev"` → output FR-4 warning + manual instructions, return
  - `--prompts` → `refreshHooks` → output result
  - `--check` → `checkVersion` → output `UpgradeCheckResult`
  - default → `checkVersion` → if up to date, output + return; else `upgradeBinary` → `refreshHooks` → output result

---

## Phase 4 — Export from `@relic/core`

- [ ] **T-10** In `packages/core/src/index.ts`, add exports for the upgrade command:
  ```typescript
  export { runUpgrade } from "./commands/upgrade.ts";
  export type { UpgradeOptions, UpgradeCheckResult, UpgradeResult } from "./commands/upgrade.ts";
  ```
  _(Depends on T-09)_

---

## Phase 5 — Register `relic upgrade` in CLI binaries

- [ ] **T-11** In `packages/cli-node/src/bin.ts`:
  - Import `runUpgrade` (and types) from `@relic/core`
  - Register the `upgrade` command:
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
  _(Depends on T-10)_

- [ ] **T-12** Apply the same `upgrade` command registration to `packages/cli-node/src/bin.debug.ts` (mirrors T-11)
  _(Depends on T-10)_

---

## Phase 6 — Tests

- [ ] **T-13** Create `packages/utility/src/__tests__/engines-registry.test.ts`:
  - `readEnginesRegistry` returns `[]` when file is absent
  - `readEnginesRegistry` returns correct values when file exists
  - `writeEnginesRegistry` creates the file, deduplicates entries, sorts alphabetically
  - Round-trip: write then read preserves values exactly
  _(Depends on T-04)_

- [ ] **T-14** Create `packages/core/src/__tests__/upgrade.test.ts`:
  - FR-4: `channel = "dev"` produces a warning in output, no `fetch` call
  - FR-14: missing `engines.json` produces warning, does not throw, `runAddEngine` not called
  - `--check` with mocked `fetch`: returns correct `UpgradeCheckResult` shape for both npm and pypi channels
  - `--check` when already at latest: `update_available: false`
  - `--prompts` with populated `engines.json`: calls `runAddEngine` for each registered engine
  - `--prompts` with missing `engines.json`: emits FR-14 warning, no `runAddEngine` calls
  _(Depends on T-09)_

---

## Notes

**No live task overlaps.** All specs that touched the same files are fully released:
- `init.ts` — last touched by spec 003 (v0.5.0, released)
- `bin.ts` / `bin.debug.ts` — last touched by spec 003 (v0.5.0, released)
- `packages/utility/src/` — last touched by spec 002 (v0.4.0, released)
- `.github/workflows/publish-pypi.yml` — claimed solely by this spec

**Ordering constraint.** T-04 (create engines-registry.ts) and T-05 (export it) must precede T-06, T-07, T-08 (callers), and T-09 (upgrade.ts uses `readEnginesRegistry`). T-09 must precede T-10, T-11, T-12, T-14.

**T-09 imports.** `upgrade.ts` needs: `spawnSync` from `child_process`, `readEnginesRegistry` from `@relic/utility`, `findRelicDir` from `@relic/utility`, `runAddEngine` from `@relic/engines`, `TEMPLATES` from `../generated/templates.ts`, `writeText` from `@relic/utility`.

**`program.version()` in T-11/T-12.** Commander's `.version(string)` returns the `Command` instance, not the string. Pass `"0.5.1"` as a literal matching `program.version("0.5.1")`, or read it from the command's `_version` field. The cleanest approach is to store the version string in a `const VERSION = "0.5.1"` and pass it to both `.version(VERSION)` and `runUpgrade({ currentVersion: VERSION })`.
