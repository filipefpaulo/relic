# Fix: 2026-04-18-init-missing-gitignore-entries

**Date:** 2026-04-18
**Owning spec:** 007-remote-ollama-engine
**Status:** solved

---

## Issue

`relic init` writes `.relic/.gitignore` with only `session.json`. It does not include `models.json` or `specs/**/history.json`, which were added by spec 007. New projects created after spec 007's implementation receive an incomplete `.gitignore`, meaning `models.json` (which may contain API keys) and per-spec `history.json` files will be committed to git unless the user manually adds the entries.

## Root Cause

**Classification:** code-bug

Spec 007 task T-21 updated the existing project's `.relic/.gitignore` directly, but `packages/core/src/commands/init.ts` is the authoritative source for what gets written into `.gitignore` for new projects. `init.ts` was never updated — it still writes only `"session.json\n"` at line 55. The fix was therefore half-complete: existing projects got the new entries, new projects do not. `init.ts` was also missing from `artifacts.json` `touches_files`, which masked the gap.

## Proposed Changes

### Code changes

- `packages/core/src/commands/init.ts`: change line 55 from:
  ```
  writeText(join(relicDir, ".gitignore"), "session.json\n");
  ```
  to:
  ```
  writeText(join(relicDir, ".gitignore"), "session.json\nmodels.json\nspecs/**/history.json\n");
  ```

- `packages/core/src/__tests__/init.test.ts`: update the test that asserts the `.gitignore` content to include all three entries.

- `.relic/specs/007-remote-ollama-engine/artifacts.json`: add `"packages/core/src/commands/init.ts"` to `touches_files` so the gap is visible in future intersection checks.

### Spec amendments

None — the spec's intent is correct; the implementation missed a file.

### Shared artifact changes

None — no contract or domain artifacts are affected.

## Changelog entry (draft)

None required — this is a code-bug fix with no contract changes.
