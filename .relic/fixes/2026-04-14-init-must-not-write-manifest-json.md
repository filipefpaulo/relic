# Fix: 2026-04-14-init-must-not-write-manifest-json

**Date:** 2026-04-14
**Owning spec:** 005-toon-manifest-format
**Status:** solved

---

## Issue

`relic init` writes both `fixes/manifest.json` and `fixes/manifest.toon` on a fresh install. On a new project, the system should enforce toon-only from the start — creating a `manifest.json` immediately requires migration that should never be needed.

## Root Cause

**Classification:** misspecification

Spec 005 FR-10 explicitly stated: *"each gets an empty `.toon` alongside the existing empty `manifest.json`"* and T-07 said: *"Keep existing `fixes/manifest.json` write (coexistence — both formats on init)"*. The rationale was backwards compatibility for existing projects, but on a fresh install there is no existing state to be compatible with. The spec should have distinguished between upgrade paths (where JSON may already exist) and fresh init (where toon-only is the correct initial state).

## Proposed Changes

### Code changes

- `packages/core/src/commands/init.ts`: Remove the `writeText(join(relicDir, "fixes", "manifest.json"), "[]\n")` line. The six toon files written by the TOON_INIT_FILES array already cover `fixes/manifest.toon` — no JSON counterpart should be created on fresh init.

### Spec amendments

- `specs/005-toon-manifest-format/spec.md` FR-10: Remove the clause about writing `manifest.json` alongside `manifest.toon` on init. Fresh init writes toon files only.
- `specs/005-toon-manifest-format/tasks.md` T-07: Remove the note *"Keep existing `fixes/manifest.json` write (coexistence — both formats on init)"*.

### Shared artifact changes

None. The `ManifestJsonContract` already classifies JSON as a legacy/migration path; no contract update needed.

## Changelog entry (draft)

[fix] 005-toon-manifest-format: 2026-04-14-init-must-not-write-manifest-json — Remove `fixes/manifest.json` write from `init.ts`. Fresh installs are toon-only; JSON coexistence applies only to upgrade paths where JSON already exists. Classification: misspecification (spec FR-10 and T-07 incorrectly preserved the JSON write for fresh init).
