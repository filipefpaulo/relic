# Plan: Structured Write Command

**Spec ID:** 006-structured-write-command
**Status:** draft

---

## Architecture Overview

`relic write` is a thin routing command. The CLI receives a target flag and a compact JSON payload, validates the payload against `WritePayload`, then delegates to one of two write primitives:

- **Toon upsert** (all `--specs`, `--fixes`, `--knowledge-*` targets): read the target `.toon` file, find an entry by `name`, replace it or append a new line, re-encode with `encodeToon()`, write back. Atomic — the file is only written after the full encode succeeds.
- **Changelog append** (`--changelog`): build a formatted block string from the payload, append it to `changelog.md`. Never reads the existing file content; uses a simple append.

The `WritePayload` type is a **single flat shape with optional fields** (not a discriminated union). The target flag is the discriminator — it arrives from the CLI, not from the payload. Irrelevant fields (e.g. `tags` for `--changelog`) are silently ignored. This keeps the LLM's invocation surface minimal and consistent across all targets.

`metadata` is resolved at write time:
- Toon targets: `tldr = description + (metadata ? " — " + metadata : "")`
- Changelog: description body + `"\n\n" + metadata` if present

The `write` command is registered in both `bin.ts` (production) and `bin.debug.ts` (debug), following the same pattern as `validate`, `search`, and `scaffold`.

---

## Resolved Open Questions

- **OQ2 — Schema shape**: Single flat shape with optional fields. Flag is the discriminator. Simpler, less LLM surface.
- **OQ6 — Metadata merge**: Toon → appended to `description` with ` — ` separator. Changelog → new paragraph after description body.

---

## Implementation Phases

### Phase 1 — WritePayload type

1. Add `WritePayload` interface to `packages/core/src/types.ts`:
   ```typescript
   export interface WritePayload {
     name: string;
     description: string;
     slash_command?: string;
     tags?: string[];
     metadata?: string;
   }
   ```
2. Add `validateWritePayload(raw: unknown): WritePayload` — validates required fields, returns typed object or throws with a clear message.

### Phase 2 — Changelog append (new format)

1. In `packages/core/src/core/changelog.ts`, add `appendChangelogEntry(relicDir: string, payload: WritePayload): void`:
   - Format: `## [<ISO-timestamp>] <slash_command ?? "/relic.write"> — <name>\n\n<description>[<\n\nmetadata>]`
   - Appends to `changelog.md`; never reads existing content.
   - Keep existing `appendChangelog()` unchanged — it has no TypeScript callers today but is exported; it remains as a legacy path.
2. Export `appendChangelogEntry` from `packages/core/src/index.ts`.

### Phase 3 — Toon upsert helper

1. In `packages/core/src/commands/write.ts`, add `upsertToonEntry(toonPath: string, header: string, entry: ManifestEntry): "appended" | "upserted"`:
   - Read current entries via `readManifestToon(dir, header)`.
   - Find existing entry by `entry.name` (exact match).
   - Replace in-place if found → action `"upserted"`.
   - Append if not found → action `"appended"`.
   - Re-encode with `encodeToon()` and `writeText()`.
2. Build `ManifestEntry` from `WritePayload`:
   - `name`: `payload.name`
   - `file`: not in payload — for `--specs` and `--fixes` the LLM must pass `file` or... actually, the existing toon entries already have a `file` field. For upsert, keep the existing `file` if the entry already exists; for append (new entry), the LLM must supply `file` in the payload.

   **Decision: add optional `file` field to `WritePayload`** — required for new toon entries (append path); ignored for changelog. For upsert (existing entry), the existing `file` value is preserved. Validation: if target is a toon space and no entry with that name exists yet, `file` must be provided.

   ```typescript
   export interface WritePayload {
     name: string;
     description: string;   // → tldr for toon, body for changelog
     file?: string;         // required for new toon entries; ignored for --changelog
     slash_command?: string; // → heading prefix for --changelog
     tags?: string[];       // → tags for toon entries
     metadata?: string;     // → appended to tldr or changelog body
   }
   ```

### Phase 4 — `runWrite()` command

1. Create `packages/core/src/commands/write.ts`:

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
  payload: string;  // raw JSON string from --payload flag
  relicDir?: string;
}

export interface WriteResult {
  target: WriteTarget;
  action: "appended" | "upserted";
  name: string;
}

export async function runWrite(options: WriteOptions): Promise<void>
```

2. Inside `runWrite`:
   - Resolve `relicDir` via `findRelicDir`.
   - Parse `options.payload` as JSON; call `validateWritePayload()`.
   - Route by `options.target`:
     - `"changelog"` → call `appendChangelogEntry(relicDir, payload)`; action = `"appended"`.
     - all others → resolve `.toon` file path from target name; call `upsertToonEntry()`; get action.
   - Output `JSON.stringify(result)` to stdout.

3. Target → path mapping:
   ```
   "specs"                  → join(relicDir, "specs/manifest.toon")
   "fixes"                  → join(relicDir, "fixes/manifest.toon")
   "knowledge-domains"      → join(relicDir, "shared/domains/manifest.toon")
   "knowledge-contracts"    → join(relicDir, "shared/contracts/manifest.toon")
   "knowledge-rules"        → join(relicDir, "shared/rules/manifest.toon")
   "knowledge-assumptions"  → join(relicDir, "shared/assumptions/manifest.toon")
   ```
   Header string for `readManifestToon` is derived from the path's directory name.

### Phase 5 — CLI registration

1. In `packages/core/src/index.ts`: export `runWrite`, `WritePayload`, `WriteResult`, `WriteTarget`.
2. In `packages/cli-node/src/bin.ts`:
   ```
   program
     .command("write")
     .description("Write a structured entry to a toon index or changelog")
     .option("--changelog", "Target: .relic/changelog.md", false)
     .option("--specs", "Target: specs/manifest.toon", false)
     .option("--fixes", "Target: fixes/manifest.toon", false)
     .option("--knowledge-domains", "Target: shared/domains/manifest.toon", false)
     .option("--knowledge-contracts", "Target: shared/contracts/manifest.toon", false)
     .option("--knowledge-rules", "Target: shared/rules/manifest.toon", false)
     .option("--knowledge-assumptions", "Target: shared/assumptions/manifest.toon", false)
     .requiredOption("--payload <json>", "Compact JSON payload (WritePayload schema)")
     .action(async (opts) => { ... })
   ```
   The action validates that exactly one target flag is set, maps it to `WriteTarget`, calls `runWrite()`.
3. Same registration in `bin.debug.ts`.

### Phase 6 — Update prompt templates

For each prompt, the change is the same pattern: find any instruction that tells the LLM to "append to changelog.md", "update manifest.toon", or "write to specs/manifest.toon" and replace with the appropriate `relic write` call.

**`templates/prompts/specify.md`**
- Replace "Append the new spec's entry to `specs/manifest.toon`" with:
  ```bash
  relic write --specs --payload '{"name":"<title>","file":"<spec-id>/","description":"<one-sentence tldr>","tags":["<tag1>","<tag2>"]}'
  ```

**`templates/prompts/clarify.md`**
- Replace "Write a changelog entry" instruction with:
  ```bash
  # Only if a shared artifact was amended (cross-artifact mutation):
  relic write --changelog --payload '{"name":"<spec-id>: <what changed>","slash_command":"/relic.clarify","description":"<why it changed>"}'
  ```
- Add explicit rule: do not call `relic write --changelog` unless a shared artifact was modified.

**`templates/prompts/plan.md`**
- Replace "Write a changelog entry" with `relic write --changelog` (same pattern as clarify).
- Add explicit rule: only on cross-artifact mutations (a plan that creates new artifacts or modifies existing shared ones; not on pure new-spec plans).

**`templates/prompts/fix.md`** and **`templates/prompts/solve.md`**
- Replace any changelog write instruction with `relic write --changelog`.
- Keep the cross-mutation-only rule.

**`templates/prompts/scan.md`**
- Replace any knowledge manifest write instructions with `relic write --knowledge-*`.

**`templates/prompts/analyse.md`**, **`templates/prompts/tasks.md`**, **`templates/prompts/implement.md`**, **`templates/prompts/use.md`**
- Audit for any file-write instructions; update to `relic write` if present.
- These prompts are mostly read-only or non-manifest-writing; changes may be minimal.

---

## File Changes

| File | Action | Notes |
|---|---|---|
| `packages/core/src/types.ts` | Modify | Add `WritePayload` interface |
| `packages/core/src/commands/write.ts` | Create | `runWrite`, `upsertToonEntry`, `WriteOptions`, `WriteResult`, `WriteTarget` |
| `packages/core/src/core/changelog.ts` | Modify | Add `appendChangelogEntry()` with new format; keep `appendChangelog()` |
| `packages/core/src/index.ts` | Modify | Export `runWrite`, `WritePayload`, `WriteResult`, `WriteTarget`, `appendChangelogEntry` |
| `packages/cli-node/src/bin.ts` | Modify | Register `write` command |
| `packages/cli-node/src/bin.debug.ts` | Modify | Register `write` command |
| `templates/prompts/specify.md` | Modify | `relic write --specs` for spec index |
| `templates/prompts/clarify.md` | Modify | `relic write --changelog` (cross-mutation-only rule) |
| `templates/prompts/plan.md` | Modify | `relic write --changelog` (cross-mutation-only rule) |
| `templates/prompts/fix.md` | Modify | `relic write --changelog` for contract/spec mutations |
| `templates/prompts/solve.md` | Modify | `relic write --changelog` for contract/spec mutations |
| `templates/prompts/scan.md` | Modify | `relic write --knowledge-*` for knowledge manifest writes |
| `templates/prompts/analyse.md` | Modify | Audit; likely no change |
| `templates/prompts/tasks.md` | Modify | Audit; likely no change |
| `templates/prompts/implement.md` | Modify | Audit; likely no change |
| `templates/prompts/use.md` | Modify | Audit; likely no change |

---

## Shared Artifact Changes

| Artifact | Action | Owned by |
|---|---|---|
| `shared/contracts/WriteCommandContract.md` | Created (clarify) | 006 |
| `shared/rules/ChangelogAppendOnlyRule.md` | Amended (clarify) | 006 |

No further shared artifact changes needed at plan time.

---

## Intersection Notes

Files touched by this spec that also appear in other specs' `touches_files`:

| File | Other spec(s) | Status |
|---|---|---|
| `packages/core/src/index.ts` | 002, 004, 005 | All finished — no conflict |
| `packages/cli-node/src/bin.ts` | 002, 003, 004, 005 | All finished — no conflict |
| `packages/cli-node/src/bin.debug.ts` | 003, 004, 005 | All finished — no conflict |
| `templates/prompts/*.md` | 002, 005 | All finished — no conflict |

No active ownership conflicts. No unresolved intersections.

---

## Changelog Reference

*Changelog entry to be written when this plan is adopted (only if it amends a shared artifact — which it does not; spec creation and plan creation are not cross-artifact mutations).*

No changelog entry required for this plan — it creates new implementation without amending any currently-owned shared artifacts.
