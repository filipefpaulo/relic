# Tasks: Structured Write Command

**Spec ID:** 006-structured-write-command
**Generated from plan:** 2026-04-15

---

## Phase 1 — WritePayload type

- [x] **T-01** In `packages/core/src/types.ts`, add the `WritePayload` interface:
  ```typescript
  export interface WritePayload {
    name: string;
    description: string;
    file?: string;
    slash_command?: string;
    tags?: string[];
    metadata?: string;
  }
  ```

---

## Phase 2 — Changelog append (new format)

- [x] **T-02** In `packages/core/src/core/changelog.ts`, add `appendChangelogEntry(relicDir: string, payload: WritePayload): void`:
  - Import `WritePayload` from `../types.ts`
  - Format the block: `## [<ISO-timestamp>] <slash_command ?? "/relic.write"> — <name>\n\n<description>[<\n\nmetadata>]`
  - Append to `changelog.md` (read existing content + append; use `fileExists` guard)
  - Keep existing `appendChangelog()` and `filterChangelog()` unchanged

- [x] **T-03** In `packages/core/src/index.ts`, export `appendChangelogEntry`:
  ```typescript
  export { appendChangelog, filterChangelog, appendChangelogEntry } from "./core/changelog.ts";
  ```

---

## Phase 3 — `write.ts` command

- [x] **T-04** Create `packages/core/src/commands/write.ts` with types:
  ```typescript
  export type WriteTarget =
    | "changelog"
    | "specs"
    | "fixes"
    | "knowledge-domains"
    | "knowledge-contracts"
    | "knowledge-rules"
    | "knowledge-assumptions";

  export interface WriteOptions {
    target: WriteTarget;
    payload: string;       // raw JSON string from --payload flag
    relicDir?: string;
  }

  export interface WriteResult {
    target: WriteTarget;
    action: "appended" | "upserted";
    name: string;
  }
  ```

- [x] **T-05** In `write.ts`, add `validateWritePayload(raw: unknown): WritePayload`:
  - Parse the JSON string if not already parsed
  - Assert `name` is a non-empty string
  - Assert `description` is a non-empty string
  - Throw a descriptive `Error` on any validation failure (message goes to stderr via caller)

- [x] **T-06** In `write.ts`, add `upsertToonEntry(toonPath: string, header: string, entry: ManifestEntry): "appended" | "upserted"`:
  - Derive the directory from `toonPath` (use `dirname`)
  - Load existing entries via `readManifestToon(dir, header)`
  - Find existing entry index where `e.name === entry.name`
  - If found: replace at index → action `"upserted"`
  - If not found: append → action `"appended"`; if `entry.file` is empty string, throw (`file` is required for new entries)
  - Re-encode all entries with `encodeToon()` and `writeText(toonPath, ...)`

- [x] **T-07** In `write.ts`, add the target-to-path mapping and add `resolveTargetPath(relicDir: string, target: WriteTarget): { toonPath: string; header: string } | null`:
  - Returns `null` for `"changelog"` (handled separately)
  - Maps each toon target to its `.toon` file path and header string

- [x] **T-08** In `write.ts`, implement `runWrite(options: WriteOptions): Promise<void>`:
  - Resolve `relicDir` via `findRelicDir(process.cwd())` (or use `options.relicDir` if provided)
  - Route to `appendChangelogEntry` or `upsertToonEntry` based on target
  - Output JSON result

---

## Phase 4 — Core exports

- [x] **T-09** In `packages/core/src/index.ts`, add exports for the new command:
  ```typescript
  export { runWrite } from "./commands/write.ts";
  export type { WriteOptions, WriteResult, WriteTarget } from "./commands/write.ts";
  export type { WritePayload } from "./types.ts";
  ```

---

## Phase 5 — CLI registration

- [x] **T-10** In `packages/cli-node/src/bin.ts`, add the `write` command after the `search` command:
  - 7 boolean target flags + required `--payload <json>`
  - Exactly-one-target validation in the action handler

- [x] **T-11** Apply the same `write` command registration to `packages/cli-node/src/bin.debug.ts`

---

## Phase 6 — Update prompt templates

- [x] **T-12** Update `templates/prompts/specify.md`: replaced toon append instruction with `relic write --specs`

- [x] **T-13** Update `templates/prompts/clarify.md`: replaced changelog write instruction with `relic write --changelog` + cross-mutation-only rule

- [x] **T-14** Update `templates/prompts/plan.md`: replaced changelog write instruction with `relic write --changelog` + cross-mutation-only rule

- [x] **T-15** Update `templates/prompts/fix.md`: replaced toon manifest write instruction with `relic write --fixes`

- [x] **T-16** Update `templates/prompts/solve.md`: replaced changelog write instruction with `relic write --changelog` + cross-mutation-only rule

- [x] **T-17** Update `templates/prompts/scan.md`: replaced toon manifest write instructions with `relic write --knowledge-*` calls; replaced changelog instruction with "do not write — scan creates, not amends"

- [x] **T-18** Audit `templates/prompts/analyse.md`, `tasks.md`, `use.md` (no direct write instructions found — no change needed); updated `implement.md` changelog instruction to `relic write --changelog` + cross-mutation-only rule

---

## Phase 7 — Tests (added via fix 2026-04-15-missing-tests-write-command)

- [x] **T-19** Create `packages/core/src/__tests__/write.test.ts`:
  - `appendChangelogEntry`: creates file, appends, `slash_command` in heading, `metadata` paragraph
  - `runWrite --changelog`: format, action, append-only
  - `runWrite --specs`: append, upsert, file-preserved-on-upsert, missing-file error
  - Toon target routing: `--fixes`, all 4 `--knowledge-*` targets write to correct path
  - `metadata` merged into `tldr` with ` — ` separator
  - Validation errors: invalid JSON, missing `name`, missing `description`
  - 20 tests, all pass

---

## Notes

- **Task ordering is strict for Phases 1–4**: T-01 must precede T-02 (WritePayload used in changelog.ts), T-04 must precede T-05/T-06/T-07/T-08 (all in write.ts), T-08 must precede T-09 (exports runWrite), T-09 must precede T-10/T-11 (bin imports from @relic/core).
- **Phase 6 is independent of Phase 5**: prompt updates can be done in any order relative to CLI registration.
- **T-06 file validation**: the `upsertToonEntry` function must throw (not silently fail) when `entry.file` is empty and no existing entry is found. This prevents orphaned toon lines with blank `file` fields that break `relic validate`.
- **No task overlap with other specs**: all tasks in specs 001–005 touching `bin.ts`, `bin.debug.ts`, `index.ts`, and `templates/prompts/` are marked `[x]`. No concurrent conflict.
- **`--text` flag**: the `write` command does not need a `--text` flag (the output is a single-line result object, not a list). Constitution Principle V applies to list-returning commands. JSON default is sufficient here.
