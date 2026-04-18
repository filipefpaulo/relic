# Plan: Remote Ollama Engine

**Spec ID:** 007-remote-ollama-engine
**Status:** ready

---

## Architecture Overview

This spec promotes Relic's workflow commands from prompt-only stubs to first-class production CLI commands capable of calling any OpenAI-compatible API directly. The implementation is layered: a thin utility extension at the bottom, a pure model-invocation core in the middle, and a unified binary at the top.

**Key architectural decisions carried over from spec decisions:**
- `model-client.ts` must not import from any engine package — isolation boundary enforced at the module level
- `model-runner.ts` imports `getPromptTemplate()` from `@relic/engines` and delegates model I/O to `model-client.ts`
- The history compressor is a pure function with no I/O — testable in isolation
- `bin.debug.ts` is deleted; all commands live in the single `bin.ts`
- `relic scan` default inverted: `--manifest` flag preserves existing manifest output; AI workflow is the new default

**Pipeline (per workflow command invocation):**
```
bin.ts command handler
  → assemble spec context (via existing runContext / context-builder)
  → model-runner.ts
      → load + validate models.json (with env var overrides)
      → getPromptTemplate(commandName) from @relic/engines
      → load history from specs/<specId>/history.json
      → apply history compressor to entries older than recentFullMessages
      → drop oldest if total > maxHistoryMessages
      → build messages array: [system: template, ...compressed history, user: context+args]
      → model-client.ts → POST /v1/chat/completions → stream stdout
      → append exchange to history.json
```

**`relic scan` inversion:**
- `relic scan` (no flags) → AI workflow: build manifest internally, pass as user context to model with `scan` prompt template
- `relic scan --manifest` → current default behaviour (human-readable manifest)
- `relic scan --manifest --json` → current `--json` behaviour (JSON manifest)
- `relic scan --json` alone → treated as `--manifest --json` for backward compatibility

---

## Implementation Phases

### Phase 1 — Infrastructure: utility + engines extensions

1. **`packages/utility/src/fetch.ts`** — extend `fetchWithTimeout` signature:
   - Add optional third parameter `init?: RequestInit`
   - Merge `init` fields into the fetch call, preserving `signal` from `AbortController`
   - Default timeout remains 10,000ms for non-model callers; model-client passes `timeoutMs` from config

2. **`packages/engines/src/index.ts`** — add `getPromptTemplate(name: string): string | undefined`:
   - `ENGINE_TEMPLATES` in `packages/engines/src/generated/engine-templates.ts` already stores prompts keyed as `prompts/<name>.md`
   - Export a thin accessor: `return ENGINE_TEMPLATES[`prompts/${name}.md`]`
   - `model-runner.ts` uses this; `model-client.ts` must not import from `@relic/engines`

### Phase 2 — Model invocation core (packages/core/src/core/)

3. **`packages/core/src/core/history-compressor.ts`** — deterministic structural extract:
   - Input: `string` (full message content)
   - Output: `string` (compressed)
   - Rules: keep all lines starting with `#` (headings) or `- ` / `* ` (bullets); for prose paragraphs keep only the first sentence (up to first `.`, `!`, or `?`); drop fenced code blocks (``` ` `` ``...``` ` `` ``) and their contents entirely
   - Pure function, no I/O, no imports from outside `@relic/utility`

4. **`packages/core/src/core/model-client.ts`** — streaming POST client:
   - Exports `callModel(options: ModelCallOptions): AsyncGenerator<string>` (yields response chunks)
   - `ModelCallOptions`: `{ baseUrl, model, apiKey?, messages, stream?, timeoutMs? }`
   - Calls `fetchWithTimeout(url, timeoutMs, { method: "POST", headers, body: JSON.stringify(...) })`
   - When `stream: true` (default): reads SSE chunks line-by-line, parses `data: {...}` JSON, yields `delta.content`
   - When `stream: false`: awaits full response, yields full `choices[0].message.content` once
   - Authorization header included only when `apiKey` is non-empty
   - Must not import from `@relic/engines`

5. **`packages/core/src/core/model-runner.ts`** — pipeline orchestrator:
   - Exports `runModel(options: RunModelOptions): Promise<void>`
   - `RunModelOptions`: `{ command, userMessage, relicDir, specId?, fixId?, noStream?, resetContext? }`
     - `specId` and `fixId` are both optional — callers provide only what is semantically relevant
     - `resetContext` only meaningful when a context ID is provided; ignored otherwise
   - Step 1: load `models.json` from `relicDir`; apply env var overrides (`RELIC_MODEL_BASE_URL`, `RELIC_MODEL_MODEL`, `RELIC_MODEL_API_KEY`); validate required fields (`baseUrl`, `model`) — on failure: `console.error(...)` with field name + path + minimum schema; `process.exit(1)`
   - Step 2: `getPromptTemplate(command)` — if undefined, error and exit
   - Step 3: determine history path — if `specId` provided: `specs/<specId>/history.json`; if `fixId` provided: read fix document to get owning spec, use `specs/<owningSpec>/history.json`; if neither: skip history entirely
   - Step 4: if `resetContext` and history path exists → clear `history.json`
   - Step 5: load history (array of `{ role, content }` entries); if none or no path, start empty
   - Step 6: apply compression — entries beyond index `history.length - recentFullMessages` are passed through `compressMessage()`; entries beyond `maxHistoryMessages` total are dropped oldest-first
   - Step 7: build messages: `[{ role: "system", content: template }, ...compressedHistory, { role: "user", content: userMessage }]`
   - Step 8: call `callModel(...)` — stream chunks to stdout; collect full response
   - Step 9: if history path is set, append `{ role: "user", content: userMessage }` and `{ role: "assistant", content: fullResponse }` to history; write back to `history.json`
   - Exports `ModelConfig` type and `loadModelConfig(relicDir)` for use by `relic model --reset-context`

### Phase 3 — Workflow command implementations

6. **New: `packages/core/src/commands/solve.ts`**:
   - `RunSolveOptions`: `{ relicDir, fix?: string, noStream?: boolean }`
   - Fix ID resolved via: arg → `session.fix` (from `session.json`) — error if neither is set
   - Does NOT assemble spec context; instead loads the fix document (`.relic/fixes/<fix-id>.md`) and passes its content as the user message — the fix document already contains the full diagnosis and proposed changes
   - Calls `runModel({ command: "solve", userMessage: fixDocContent, relicDir, fixId, noStream })` — history is suppressed by runner since this is a one-shot apply command; no `resetContext` flag
   - No `--reset-context` flag on `relic solve`

7. **New: `packages/core/src/commands/constitution.ts`**:
   - `RunConstitutionOptions`: `{ relicDir, noStream?: boolean }`
   - No spec, no fix, no reset-context — constitution is project-level
   - Passes `relicDir` to `runModel({ command: "constitution", userMessage: "", relicDir, noStream })` — no `specId` or `fixId`; runner will skip history

8. **Update stubs → real implementations** for: `clarify.ts`, `plan.ts`, `analyse.ts`, `tasks.ts`, `implement.ts`:
   - Each currently prints "not yet implemented." Replace body with: assemble spec context → call `runModel({ command: "<name>", ... })`
   - Add `spec?`, `noStream?`, `resetContext?` to each command's options interface

9. **Update `packages/core/src/commands/fix.ts`**:
   - Extend to call `runModel({ command: "fix", userMessage: assembledContext + issue, ... })` when `models.json` present
   - Preserve existing context-assembly logic (`buildContext()`, spec resolution)

10. **Update `packages/core/src/commands/specify.ts`**:
    - After scaffolding, if `models.json` present: call `runModel({ command: "specify", userMessage: assembledContext + (title args), specId, ... })`
    - If `models.json` absent: keep current behaviour (print "In your AI agent: /relic.specify")

11. **Update `packages/core/src/commands/scan.ts`**:
    - Add `manifest?: boolean` to `ScanOptions`
    - When `manifest: false` (new default): build manifest internally (reuse existing logic), serialise to string, call `runModel({ command: "scan", userMessage: manifestString, relicDir, noStream })` — no `specId`, `fixId`, or `resetContext`
    - When `manifest: true`: existing output paths (`--json` → JSON, else human-readable)
    - Note: scan has no per-spec history (no `specId`); history is not persisted for scan invocations

### Phase 4 — Validation update

12. **`packages/core/src/commands/validate.ts`**:
    - Update `ALLOWED_SPEC_FILES` constant to include `"history.json"` (or equivalent set)
    - `history.json` is exempt from cross-spec content checks — validate only that it is not committed (gitignore check is out of scope for validate; the gitignore entry handles enforcement)

### Phase 5 — Core exports

13. **`packages/core/src/index.ts`**:
    - Add exports: `runSolve`, `runConstitution` (new commands)
    - Add exports: `runModel`, `loadModelConfig`, `ModelConfig`, `RunModelOptions`, `ModelCallOptions` from model-runner/client
    - All existing exports unchanged

### Phase 6 — Binary consolidation

14. **`packages/cli-node/src/bin.ts`** — add all workflow commands:
    - `relic specify [--title <t>] [--spec <id>] [--no-stream] [--reset-context]`
    - `relic clarify [--spec <id>] [--no-stream] [--reset-context]`
    - `relic plan [--spec <id>] [--no-stream] [--reset-context]`
    - `relic analyse [--spec <id>] [--no-stream] [--reset-context]`
    - `relic tasks [--spec <id>] [--no-stream] [--reset-context]`
    - `relic implement [--spec <id>] [--no-stream] [--reset-context]`
    - `relic fix [--spec <id>] [--issue <desc>] [--no-stream] [--reset-context]`
    - `relic solve [--fix <id>] [--no-stream]` — no `--reset-context`, no `--spec`
    - `relic constitution [--no-stream]` — no `--spec`, no `--fix`, no `--reset-context`
    - **`relic scan` changes**: add `--manifest` flag; when `--manifest` absent → AI workflow; when `--manifest` → existing output paths; `--json` alone treated as `--manifest --json`
    - **`relic model`**: subcommand with `--reset-context [--spec <id>]`

15. **`packages/cli-node/src/bin.debug.ts`** — delete

### Phase 7 — Configuration and preamble

16. **`.relic/.gitignore`** — add two entries:
    ```
    models.json
    specs/**/history.json
    ```

17. **`templates/preamble.md`** — update spec files section:
    - Reflect the amended SpecFilesAllowlistRule: 4 committed files + `history.json` (session-local, gitignored)
    - Update the "Prohibited Actions" section to note that `history.json` is the single allowed exception

18. **`.relic/preamble.md`** — apply the same update as `templates/preamble.md` (the installed copy must match the template source)

---

## File Changes

| File | Action | Notes |
|------|--------|-------|
| `packages/utility/src/fetch.ts` | modify | Accept optional `RequestInit`; merge into fetch call; preserve AbortController signal |
| `packages/engines/src/index.ts` | modify | Add `getPromptTemplate(name)` export surfacing `ENGINE_TEMPLATES` |
| `packages/core/src/core/history-compressor.ts` | create | Pure deterministic structural extract; no I/O |
| `packages/core/src/core/model-client.ts` | create | Streaming POST client; no engine imports |
| `packages/core/src/core/model-runner.ts` | create | Pipeline orchestrator; owns models.json loading + validation |
| `packages/core/src/commands/solve.ts` | create | New workflow command (was prompt-only) |
| `packages/core/src/commands/constitution.ts` | create | New workflow command (was prompt-only) |
| `packages/core/src/commands/clarify.ts` | modify | Replace stub with model runner call |
| `packages/core/src/commands/plan.ts` | modify | Replace stub with model runner call |
| `packages/core/src/commands/analyse.ts` | modify | Replace stub with model runner call |
| `packages/core/src/commands/tasks.ts` | modify | Replace stub with model runner call |
| `packages/core/src/commands/implement.ts` | modify | Replace stub with model runner call |
| `packages/core/src/commands/fix.ts` | modify | Add model runner call path |
| `packages/core/src/commands/specify.ts` | modify | Add model runner call after scaffold when models.json present |
| `packages/core/src/commands/scan.ts` | modify | Invert default; add `manifest` option; AI workflow path |
| `packages/core/src/commands/validate.ts` | modify | Add `history.json` to allowed spec files set |
| `packages/core/src/__tests__/history-compressor.test.ts` | create | Unit tests for pure compressor function (8 cases) |
| `packages/core/src/index.ts` | modify | Export new commands + model types |
| `packages/cli-node/src/bin.ts` | modify | Add all workflow commands; `relic model`; invert `relic scan` |
| `packages/cli-node/src/bin.debug.ts` | delete | Consolidated into bin.ts |
| `templates/preamble.md` | modify | Document history.json in spec files allowlist |
| `.relic/preamble.md` | modify | Mirror template change in installed copy |
| `.relic/.gitignore` | modify | Add `models.json` + `specs/**/history.json` glob |

---

## Shared Artifact Changes

All owned artifacts were created during `specify`. No existing shared artifacts are amended by this plan — the artifacts below are new declarations only.

| Artifact | Action | Approved by |
|----------|--------|-------------|
| `shared/domains/ModelInvocationDomain.md` | create (already exists) | spec 007 |
| `shared/contracts/ModelConfigContract.md` | create (already exists) | spec 007 |
| `shared/assumptions/OllamaOpenAICompat.md` | create (already exists) | spec 007 |
| `shared/rules/SpecFilesAllowlistRule.md` | create (already exists) | spec 007 |

No cross-artifact mutations. No changelog entry required.

---

## Intersection Notes

| Spec | File overlap | Resolution |
|------|-------------|------------|
| 003-fix-solve-workflow | `bin.ts`, `bin.debug.ts`, `fix.ts` | Spec 003 is implemented. Overlap is historical — no active conflict. Coordinate via git merge if branches diverge. |
| 004-cli-self-upgrade | `bin.ts`, `bin.debug.ts`, `core/src/index.ts` | Spec 004 is implemented. Same resolution. |
| 005-toon-manifest-format | `bin.ts`, `bin.debug.ts`, `validate.ts`, `core/src/index.ts`, `templates/preamble.md` | Spec 005 is implemented. No active conflict. |
| 006-structured-write-command | `bin.ts`, `bin.debug.ts`, `core/src/index.ts` | Spec 006 is implemented. No active conflict. |

No ownership conflicts. No spec currently `owns` `templates/preamble.md`; spec 007 modifies it under SpecFilesAllowlistRule ownership.

---

## Changelog Reference

No cross-artifact mutations in this plan — all owned artifacts are new. No changelog entry written.
