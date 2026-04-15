# Fix: 2026-04-15-missing-tests-write-command

**Date:** 2026-04-15
**Owning spec:** 006-structured-write-command
**Status:** solved

---

## Issue

The implementation of spec 006 (`relic write`) was completed without any test coverage. The new `write.ts` command and `appendChangelogEntry()` in `changelog.ts` are untested. The spec's tasks (T-01 through T-18) and plan had no test phase.

## Root Cause

**Classification:** misspecification

The spec and plan were written without a test phase. The `TestingRules` artifact (owned by spec 001) requires test files for all new `run*` commands and file I/O functions. The spec's scope section did not mention tests, and the plan's phases did not include a test phase. This is a gap in the original spec, not an implementation error — the code itself is correct.

## Proposed Changes

### Code changes

Create `packages/core/src/__tests__/write.test.ts` covering:

**`validateWritePayload` (unit, no I/O):**
- Valid payload with all fields → returns typed object
- Missing `name` → throws with clear message
- Missing `description` → throws with clear message
- Invalid JSON is not tested here (caller catches JSON.parse errors before calling validate)

**`runWrite` — `--changelog` path (integration, temp dir):**
- First call creates `changelog.md` with the correct format: `## [<ISO>] /relic.write — <name>\n\n<description>`
- Second call appends (does not overwrite) — file has two blocks
- `slash_command` field appears in heading when provided
- `metadata` appears as second paragraph when provided

**`runWrite` — toon upsert path (integration, temp dir):**
- `--specs`: appends new entry when name not found; returns `action: "appended"`
- `--specs`: upserts (overwrites) existing entry when name matches; returns `action: "upserted"`; existing `file` field preserved on upsert
- `--knowledge-domains`, `--knowledge-contracts`, `--knowledge-rules`, `--knowledge-assumptions`: each target writes to the correct `manifest.toon` path (one test per target is sufficient)
- `--fixes`: appends a fix entry; returns correct result shape
- Missing `file` on new (append) toon entry → `process.exit(1)` (test via error throw path in `upsertToonEntry` directly, or by asserting the error is thrown)

**`appendChangelogEntry` (integration, temp dir):**
- Already partially covered by `changelog.test.ts` for `appendChangelog`; add a dedicated block for the new function in `write.test.ts` (or extend `changelog.test.ts` — implementer's choice per module boundary)

### Spec amendments

Add a test phase to `plan.md` and a new task block to `tasks.md`:

**`plan.md`** — add Phase 7 after Phase 6:
```
### Phase 7 — Tests

1. Create `packages/core/src/__tests__/write.test.ts` covering `runWrite` (changelog and toon paths), `validateWritePayload`, and `upsertToonEntry`.
2. Extend or co-locate `appendChangelogEntry` tests (write.test.ts or changelog.test.ts).
```

**`tasks.md`** — add T-19 after T-18:
```
- [ ] T-19 Create packages/core/src/__tests__/write.test.ts
```

**`artifacts.json`** — add `packages/core/src/__tests__/write.test.ts` to `touches_files`.

### Shared artifact changes

None. No contracts or domains need updating — this is a missing test gap only.

## Changelog entry (draft)

Fix 2026-04-15-missing-tests-write-command: spec 006 plan and tasks did not include a test phase. Added write.test.ts covering runWrite (changelog and toon paths), validateWritePayload, and upsertToonEntry. Updated plan.md, tasks.md, and artifacts.json to reflect the added test file.
