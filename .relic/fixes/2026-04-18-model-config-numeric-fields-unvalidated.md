# Fix: 2026-04-18-model-config-numeric-fields-unvalidated

**Date:** 2026-04-18
**Owning spec:** 007-remote-ollama-engine
**Status:** solved

---

## Issue

Copilot review flagged that `maxHistoryMessages`, `recentFullMessages`, and `timeoutMs` are
accepted from `models.json` without validation. Negative or non-integer values pass silently:

- `maxHistoryMessages: -1` causes `compressed.slice(compressed.length - (-1))` → `slice(-1)` →
  returns only the last entry instead of trimming nothing (or trimming correctly)
- `recentFullMessages: -5` causes `Math.max(0, history.length - (-5))` → all messages are
  treated as "old" and compressed, including the most recent ones
- `timeoutMs: 0` causes an immediate abort on every model call
- `recentFullMessages > maxHistoryMessages` is logically incoherent — you can't keep more full
  entries than the total allowed

None of these produce an error. They silently corrupt history behavior in ways that are very
hard to debug.

User direction: create a `parseModelConfig` parser in `@relic/utility` (paralleling `resolveSpec`)
to centralize validation. This makes the logic reusable for future multi-agent configurations and
keeps the validation rules in a single testable place. Move `ModelConfig` type to `@relic/utility`
as part of the same change (it's a config contract shape, appropriate for the dependency floor).

## Root Cause

**Classification:** misspecification

Spec FR-3 defined the optional numeric fields and their defaults. Spec NFR-5 stated "all config
validation errors are actionable" but was scoped only to the `baseUrl`/`model` required field
checks. The spec never defined what constitutes a valid value for numeric fields, so the
implementation applied defaults and moved on. The silent failure paths were never part of the
contract, but neither were they prohibited by it.

## Proposed Changes

### Code changes

**1. New file: `packages/utility/src/model-config.ts`**

- Export `ModelConfig` interface (moved from `model-runner.ts`):
  ```typescript
  interface ModelConfig {
    baseUrl: string; model: string; apiKey: string;
    maxHistoryMessages: number; recentFullMessages: number; timeoutMs: number;
  }
  ```
- Export `parseModelConfig(raw: Record<string, unknown>, configPath: string): ModelConfig`
  Applies env var overrides first, then validates:
  - `baseUrl`: non-empty string (required) → actionable error naming field + path + minimum schema
  - `model`: non-empty string (required) → same
  - `maxHistoryMessages`: finite integer > 0 (default 20) → error if invalid
  - `recentFullMessages`: finite integer ≥ 0 AND ≤ `maxHistoryMessages` (default 2) → error if invalid
  - `timeoutMs`: finite number > 0 (default 300,000) → error if invalid
  All errors: `console.error(...)` + `process.exit(1)`. Error messages must name the field,
  its invalid value, the constraint violated, and the path to `models.json`.

**2. `packages/utility/src/index.ts`** — export `ModelConfig` and `parseModelConfig`.

**3. `packages/core/src/core/model-runner.ts`**:
  - Remove `ModelConfig` interface definition (now imported from `@relic/utility`)
  - Remove `RawModelConfig` interface (subsumed by `parseModelConfig`)
  - Replace the entire validation block inside `loadModelConfig` with a call to `parseModelConfig`
  - `loadModelConfig` becomes: read the file (if it exists) → call `parseModelConfig(raw, configPath)`

**4. `packages/core/src/index.ts`** — remove re-export of `ModelConfig` from `model-runner.ts`;
   re-export from `@relic/utility` instead (or keep re-exporting from `model-runner.ts` if it
   re-exports from utility — either way, the public API surface stays the same).

**5. `packages/core/src/__tests__/model-runner.test.ts`** — extend `loadModelConfig` tests:
   - `maxHistoryMessages: 0` → exits with error naming the field and constraint
   - `maxHistoryMessages: -5` → exits with error
   - `maxHistoryMessages: 1.5` → exits with error (not an integer)
   - `recentFullMessages: -1` → exits with error
   - `recentFullMessages > maxHistoryMessages` → exits with error
   - `timeoutMs: 0` → exits with error
   - `timeoutMs: -1000` → exits with error

### Spec amendments

**`specs/007-remote-ollama-engine/spec.md`** — amend FR-3 to add explicit validation rules for
numeric fields. Append after the existing field list:
> Valid values: `maxHistoryMessages` must be a positive integer (> 0). `recentFullMessages` must
> be a non-negative integer (≥ 0) and must not exceed `maxHistoryMessages`. `timeoutMs` must be
> a positive finite number (> 0). Invalid values produce an actionable error (field name, invalid
> value, constraint, path to `models.json`) and exit non-zero.

### Shared artifact changes

**`shared/contracts/ModelConfigContract.md`** — add a "Validation" section documenting the
constraints for numeric fields. No specs other than 007 own or read this artifact — no cascade.

## Changelog entry (draft)

```
### Fixed
- `models.json` numeric fields (`maxHistoryMessages`, `recentFullMessages`, `timeoutMs`) now
  validated on load. Negative values, non-integers, zero timeouts, and incoherent combinations
  (recentFullMessages > maxHistoryMessages) all produce actionable errors naming the field,
  its invalid value, the constraint, and the config path — then exit non-zero.
- Config parsing extracted to `parseModelConfig()` in `@relic/utility`, paralleling
  `resolveSpec()`. `ModelConfig` type moved to `@relic/utility` as part of the same change.
  (Fix: 2026-04-18-model-config-numeric-fields-unvalidated)
```
