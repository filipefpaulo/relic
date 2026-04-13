# Tasks: CLI Self Upgrade

**Spec ID:** 004-cli-self-upgrade
**Generated from plan:** 2026-04-13

---

## Phase 0 — Build-time `INSTALL_CHANNEL` defines

- [x] **T-01** In `packages/cli-node/package.json`, append `--define 'INSTALL_CHANNEL="npm"'` to the `build:npm` script
- [x] **T-02** In `packages/cli-node/package.json`, append `--define 'INSTALL_CHANNEL="npm"'` to the `build:binary` script
- [x] **T-03** In `.github/workflows/publish-pypi.yml`, append `--define 'INSTALL_CHANNEL="pypi"'` to the `Compile binary` step's `bun build` command

---

## Phase 1 — Engine registry utilities in `@relic/utility`

- [x] **T-04** Create `packages/utility/src/engines-registry.ts` with `readEnginesRegistry` and `writeEnginesRegistry`
- [x] **T-05** In `packages/utility/src/index.ts`, export the new helpers

---

## Phase 2 — Write `engines.json` from `init` and `add-engine`

- [x] **T-06** In `packages/core/src/commands/init.ts`, after the engine loop, write `engines.json`
- [x] **T-07** In `packages/cli-node/src/bin.ts`, update the `add-engine` handler to persist the engine to the registry
- [x] **T-08** Apply the same change to `packages/cli-node/src/bin.debug.ts` add-engine handler

---

## Phase 3 — `packages/core/src/commands/upgrade.ts`

- [x] **T-09** Create `packages/core/src/commands/upgrade.ts` — full implementation (INSTALL_CHANNEL, interfaces, checkVersion, upgradeBinary, refreshHooks, runUpgrade)
  - Implementation note: added `_channel?: string` to `UpgradeOptions` for test injection — channel is a module-level const from the build-time define and cannot be overridden at runtime without this escape hatch.

---

## Phase 4 — Export from `@relic/core`

- [x] **T-10** In `packages/core/src/index.ts`, add exports for `runUpgrade` and types

---

## Phase 5 — Register `relic upgrade` in CLI binaries

- [x] **T-11** Register `relic upgrade --check/--prompts/--text` in `packages/cli-node/src/bin.ts`
  - Implementation note: introduced `const VERSION = "0.5.1"` in both binaries to pass to both `.version(VERSION)` and `runUpgrade({ currentVersion: VERSION })` — avoids the `program.version()` Commander return-value trap noted in tasks.
- [x] **T-12** Apply the same `upgrade` command registration to `packages/cli-node/src/bin.debug.ts`

---

## Phase 6 — Tests

- [x] **T-13** Create `packages/utility/src/__tests__/engines-registry.test.ts` (10 tests — all pass)
- [x] **T-14** Create `packages/core/src/__tests__/upgrade.test.ts` (10 tests — all pass)

---

## Notes

**No live task overlaps.** All specs that touched the same files are fully released:
- `init.ts` — last touched by spec 003 (v0.5.0, released)
- `bin.ts` / `bin.debug.ts` — last touched by spec 003 (v0.5.0, released)
- `packages/utility/src/` — last touched by spec 002 (v0.4.0, released)
- `.github/workflows/publish-pypi.yml` — claimed solely by this spec

**`_channel` test override.** `UpgradeOptions._channel` was added during implementation to allow tests to override the build-time `INSTALL_CHANNEL` constant. Without it, all tests always see `channel = "dev"` and cannot exercise the npm/pypi code paths.
