# Fix: 2026-04-18-solve-persists-history-against-spec

**Date:** 2026-04-18
**Owning spec:** 007-remote-ollama-engine
**Status:** solved

---

## Issue

Copilot code review flagged that `runModel()` and `loadModelConfig()` are untested, and specifically
called out that "ensuring solve does not persist history" is missing from the test suite.

Investigation confirmed there is an actual bug beneath the test gap: `solve.ts` passes `fixId` to
`runModel`, which causes the runner to resolve a `historyPath` (the owning spec's `history.json`)
and write to it at step 9. The comment in `solve.ts:30` says "runner suppresses for solve" but no
such suppression exists in `model-runner.ts`. The spec is explicit: `relic solve` is a one-shot
apply command and must not persist conversation history.

## Root Cause

**Classification:** code-bug

`solve.ts` passes `fixId` to `runModel` with the intent that the runner would suppress history
for this command. The runner has no such mechanism — it persists to `historyPath` whenever the
path is non-null, which it is when `fixId` is provided. The comment in `solve.ts` is aspirational;
the implementation never delivered the suppression.

The test gap (T-20 only covering `history-compressor.ts`) meant this divergence from the spec
went undetected. `loadModelConfig()` and `runModel()`'s history behaviours (load, compress, trim,
persist, reset, suppress-for-solve) are all tested by the spec's test plan only at the integration
level (T-27: manual smoke test). No automated regression exists.

## Proposed Changes

### Code changes

**`packages/core/src/commands/solve.ts` (1-line fix)**

Remove `fixId` from the `runModel(...)` call. `solve` does not use `fixId` to load context — the
fix document content is already passed as `userMessage`. Passing `fixId` was only causing the
runner to resolve a history path, which then triggered unwanted persistence. Without `fixId`,
`historyPath` resolves to `null` and step 9 is a no-op.

```diff
  await runModel({
    command: "solve",
    userMessage: fixDocContent,
    relicDir,
-   fixId,
    noStream,
  });
```

Update the comment on line 30 to match the actual mechanism:
```
// solve is one-shot — do not pass specId or fixId so the runner skips history entirely
```

**`packages/core/src/__tests__/model-runner.test.ts` (new file)**

Add unit tests using temp dirs and a stubbed `callModel` to cover the behaviours flagged by the
review. The stub approach avoids a live server while testing all runner logic:

1. `loadModelConfig` — missing `models.json` → exits non-zero (mock `process.exit`)
2. `loadModelConfig` — missing `baseUrl` field → exits non-zero with field name in stderr
3. `loadModelConfig` — missing `model` field → exits non-zero with field name in stderr
4. `loadModelConfig` — `RELIC_MODEL_BASE_URL` env override replaces `baseUrl` from file
5. `loadModelConfig` — `RELIC_MODEL_MODEL` env override replaces `model` from file
6. `loadModelConfig` — valid file returns config with correct defaults for optional fields
7. `runModel` — after a call, `history.json` is created and contains the user + assistant turn
8. `runModel` — second call appends to existing history (accumulation)
9. `runModel` — `resetContext: true` clears history before the call
10. `runModel` — entries older than `recentFullMessages` are compressed (heading preserved verbatim)
11. `runModel` — total entries trimmed to `maxHistoryMessages` (oldest dropped first)
12. `runModel` — no `specId` or `fixId` → no `history.json` written (constitution, scan)
13. `runModel` (solve path) — `fixId` NOT passed → no `history.json` written (regression for this bug)

### Spec amendments

None. The spec is correct — it explicitly states solve must not persist history. The code was wrong.

### Shared artifact changes

None. No contract or domain artifact needs updating.

## Changelog entry (draft)

```
### Fixed
- `relic solve` no longer persists conversation history to `history.json`. The runner skips
  history entirely when neither `specId` nor `fixId` is passed — `solve.ts` was incorrectly
  passing `fixId`, triggering an unintended history write. Spec 007 was always clear: solve
  is one-shot. (Fix: 2026-04-18-solve-persists-history-against-spec)
- Added `model-runner.test.ts` covering `loadModelConfig` error UX, env var overrides, and
  `runModel` history accumulation, compression, trimming, reset, and suppression behaviours.
```
