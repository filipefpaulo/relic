# Tasks: Structured Write Command

**Spec ID:** 006-structured-write-command
**Generated from plan:** 2026-04-15

---

## Phase 1 — WritePayload type

- [ ] **T-01** In `packages/core/src/types.ts`, add the `WritePayload` interface:
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

- [ ] **T-02** In `packages/core/src/core/changelog.ts`, add `appendChangelogEntry(relicDir: string, payload: WritePayload): void`:
  - Import `WritePayload` from `../types.ts`
  - Format the block: `## [<ISO-timestamp>] <slash_command ?? "/relic.write"> — <name>\n\n<description>[<\n\nmetadata>]`
  - Append to `changelog.md` (read existing content + append; use `fileExists` guard)
  - Keep existing `appendChangelog()` and `filterChangelog()` unchanged

- [ ] **T-03** In `packages/core/src/index.ts`, export `appendChangelogEntry`:
  ```typescript
  export { appendChangelog, filterChangelog, appendChangelogEntry } from "./core/changelog.ts";
  ```

---

## Phase 3 — `write.ts` command

- [ ] **T-04** Create `packages/core/src/commands/write.ts` with types:
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

- [ ] **T-05** In `write.ts`, add `validateWritePayload(raw: unknown): WritePayload`:
  - Parse the JSON string if not already parsed
  - Assert `name` is a non-empty string
  - Assert `description` is a non-empty string
  - Throw a descriptive `Error` on any validation failure (message goes to stderr via caller)

- [ ] **T-06** In `write.ts`, add `upsertToonEntry(toonPath: string, header: string, entry: ManifestEntry): "appended" | "upserted"`:
  - Derive the directory from `toonPath` (use `dirname`)
  - Load existing entries via `readManifestToon(dir, header)`
  - Find existing entry index where `e.name === entry.name`
  - If found: replace at index → action `"upserted"`
  - If not found: append → action `"appended"`; if `entry.file` is empty string, throw (`file` is required for new entries)
  - Re-encode all entries with `encodeToon()` and `writeText(toonPath, ...)`

- [ ] **T-07** In `write.ts`, add the target-to-path mapping and add `resolveTargetPath(relicDir: string, target: WriteTarget): { toonPath: string; header: string } | null`:
  - Returns `null` for `"changelog"` (handled separately)
  - Maps each toon target to its `.toon` file path and header string:
    ```
    "specs"                  → { toonPath: "<relicDir>/specs/manifest.toon",                    header: "specs index" }
    "fixes"                  → { toonPath: "<relicDir>/fixes/manifest.toon",                    header: "fixes index" }
    "knowledge-domains"      → { toonPath: "<relicDir>/shared/domains/manifest.toon",           header: "domains manifest" }
    "knowledge-contracts"    → { toonPath: "<relicDir>/shared/contracts/manifest.toon",         header: "contracts manifest" }
    "knowledge-rules"        → { toonPath: "<relicDir>/shared/rules/manifest.toon",             header: "rules manifest" }
    "knowledge-assumptions"  → { toonPath: "<relicDir>/shared/assumptions/manifest.toon",       header: "assumptions manifest" }
    ```

- [ ] **T-08** In `write.ts`, implement `runWrite(options: WriteOptions): Promise<void>`:
  - Resolve `relicDir` via `findRelicDir(process.cwd())` (or use `options.relicDir` if provided)
  - If `relicDir` is null: `console.error("Error: not in a Relic project.")` + `process.exit(1)`
  - Parse `options.payload` as JSON; call `validateWritePayload()`; on error: `console.error(err.message)` + `process.exit(1)`
  - If `target === "changelog"`: call `appendChangelogEntry(relicDir, payload)`; result action = `"appended"`
  - Otherwise: call `resolveTargetPath()` to get `toonPath` + `header`; build `ManifestEntry` from payload:
    - `name`: `payload.name`
    - `file`: `payload.file ?? ""`
    - `tags`: `payload.tags ?? []`
    - `tldr`: `payload.description + (payload.metadata ? " — " + payload.metadata : "")`
  - Call `upsertToonEntry(toonPath, header, entry)`; capture action
  - Output: `console.log(JSON.stringify({ target: options.target, action, name: payload.name }))`

---

## Phase 4 — Core exports

- [ ] **T-09** In `packages/core/src/index.ts`, add exports for the new command:
  ```typescript
  export { runWrite } from "./commands/write.ts";
  export type { WriteOptions, WriteResult, WriteTarget } from "./commands/write.ts";
  ```
  Also export `WritePayload` from types (if not already re-exported):
  ```typescript
  export type { WritePayload } from "./types.ts";
  ```

---

## Phase 5 — CLI registration

- [ ] **T-10** In `packages/cli-node/src/bin.ts`, add the `write` command after the `search` command:
  - Import `runWrite` and `WriteTarget` from `@relic/core`
  - Register 7 boolean target flags (`--changelog`, `--specs`, `--fixes`, `--knowledge-domains`, `--knowledge-contracts`, `--knowledge-rules`, `--knowledge-assumptions`)
  - Register `--payload <json>` as a required option
  - In the action handler: collect which target flags are `true`; if not exactly one, `console.error(...)` + `process.exit(1)`; map the flag to `WriteTarget`; call `runWrite({ target, payload: opts.payload })`

- [ ] **T-11** Apply the same `write` command registration to `packages/cli-node/src/bin.debug.ts`
  - Identical to T-10; `bin.debug.ts` must stay in sync with `bin.ts` for all utility commands

---

## Phase 6 — Update prompt templates

- [ ] **T-12** Update `templates/prompts/specify.md`:
  - Find the section instructing the LLM to append a new entry to `specs/manifest.toon`
  - Replace with a `relic write --specs` call block:
    ```bash
    relic write --specs --payload '{"name":"<title>","file":"<spec-id>/","description":"<one-sentence tldr>","tags":["<tag1>","<tag2>"]}'
    ```
  - Remove any instruction to open or read `specs/manifest.toon` directly

- [ ] **T-13** Update `templates/prompts/clarify.md`:
  - Find the section with the changelog write instruction
  - Replace with:
    ```bash
    # Only when a shared artifact owned by this spec was amended:
    relic write --changelog --payload '{"name":"<spec-id>: <what changed>","slash_command":"/relic.clarify","description":"<why it changed>"}'
    ```
  - Add an explicit rule above the call: "Only write a changelog entry if a shared artifact was amended in this clarify session. Do not write one for spec.md edits, question resolution, or new artifact creation."

- [ ] **T-14** Update `templates/prompts/plan.md`:
  - Replace the `[plan] {{SPEC_ID}}: ...` changelog write instruction with:
    ```bash
    # Only when this plan amends an existing shared artifact (not on first plan creation):
    relic write --changelog --payload '{"name":"<spec-id>: Plan updated — <what changed>","slash_command":"/relic.plan","description":"<what changed and why>"}'
    ```
  - Add the cross-mutation-only rule alongside the call

- [ ] **T-15** Update `templates/prompts/fix.md`:
  - Replace any existing changelog write instruction with `relic write --changelog`
  - Payload shape: `{"name":"<fix-id>: <what changed>","slash_command":"/relic.fix","description":"<what changed>"}`
  - Apply cross-mutation-only rule: only write when fix amends a spec or contract

- [ ] **T-16** Update `templates/prompts/solve.md`:
  - Same change as T-15 for the solve prompt
  - Payload shape: `{"name":"<fix-id>: <what changed>","slash_command":"/relic.solve","description":"<what changed>"}`

- [ ] **T-17** Update `templates/prompts/scan.md`:
  - Find any instructions to write or update `shared/*/manifest.toon` directly
  - Replace with `relic write --knowledge-<subdir>` calls:
    ```bash
    relic write --knowledge-domains --payload '{"name":"<name>","file":"<file.md>","description":"<tldr>","tags":["<tag>"]}'
    ```

- [ ] **T-18** Audit `templates/prompts/analyse.md`, `tasks.md`, `implement.md`, `use.md`:
  - Read each file; check for any direct toon or changelog write instructions
  - Apply `relic write` replacement if found; if none found, no change needed
  - Mark this task complete after audit (even if no changes made)

---

## Notes

- **Task ordering is strict for Phases 1–4**: T-01 must precede T-02 (WritePayload used in changelog.ts), T-04 must precede T-05/T-06/T-07/T-08 (all in write.ts), T-08 must precede T-09 (exports runWrite), T-09 must precede T-10/T-11 (bin imports from @relic/core).
- **Phase 6 is independent of Phase 5**: prompt updates can be done in any order relative to CLI registration.
- **T-06 file validation**: the `upsertToonEntry` function must throw (not silently fail) when `entry.file` is empty and no existing entry is found. This prevents orphaned toon lines with blank `file` fields that break `relic validate`.
- **No task overlap with other specs**: all tasks in specs 001–005 touching `bin.ts`, `bin.debug.ts`, `index.ts`, and `templates/prompts/` are marked `[x]`. No concurrent conflict.
- **`--text` flag**: the `write` command does not need a `--text` flag (the output is a single-line result object, not a list). Constitution Principle V applies to list-returning commands. JSON default is sufficient here.
