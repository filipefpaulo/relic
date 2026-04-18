# Tasks: Remote Ollama Engine

**Spec ID:** 007-remote-ollama-engine
**Generated from plan:** 2026-04-17

---

## Phase 1 — Infrastructure: utility + engines extensions

- [ ] **T-01** Extend `packages/utility/src/fetch.ts` — add optional `init?: RequestInit` parameter to `fetchWithTimeout`
  - Signature: `fetchWithTimeout(url: string, timeoutMs?: number, init?: RequestInit): Promise<Response>`
  - Merge `init` fields into the fetch call; AbortController `signal` always takes precedence over any `signal` in `init`
  - Default `timeoutMs` remains 10,000ms — unchanged for all existing callers

- [ ] **T-02** Add `getPromptTemplate(name: string): string | undefined` export to `packages/engines/src/index.ts`
  - Implementation: `` return ENGINE_TEMPLATES[`prompts/${name}.md`] ``
  - Import `ENGINE_TEMPLATES` from `./generated/engine-templates.ts`
  - **Prerequisite:** `bun run build:engine-templates` must have been run so `ENGINE_TEMPLATES` exists

---

## Phase 2 — Model invocation core

- [ ] **T-03** Create `packages/core/src/core/history-compressor.ts`
  - Export `compressMessage(content: string): string`
  - Rules:
    - Keep lines starting with `#` (headings)
    - Keep lines starting with `- ` or `* ` (bullets)
    - For prose paragraphs (non-heading, non-bullet, non-empty lines): keep only the first sentence — up to the first `.`, `!`, or `?`; if no terminator found, keep the full line
    - Drop fenced code blocks (opening ` ``` ` to closing ` ``` `) and all content between them
  - Pure function: no I/O, no imports outside TypeScript builtins

- [ ] **T-04** Create `packages/core/src/core/model-client.ts`
  - Export interface `ModelCallOptions`: `{ baseUrl: string; model: string; apiKey?: string; messages: Array<{ role: string; content: string }>; stream?: boolean; timeoutMs?: number }`
  - Export `callModel(options: ModelCallOptions): AsyncGenerator<string>` — yields response content chunks
  - When `stream: true` (default): POST to `{baseUrl}/v1/chat/completions`; read SSE response line-by-line; parse `data: {...}` JSON; yield `delta.content` (skip `[DONE]`)
  - When `stream: false`: await full response; yield `choices[0].message.content` once
  - Use `fetchWithTimeout` from `@relic/utility` with the extended `RequestInit` signature (T-01)
  - `Authorization: Bearer <apiKey>` header only when `apiKey` is non-empty
  - Must NOT import from `@relic/engines`
  - Depends on: T-01

- [ ] **T-05** Create `packages/core/src/core/model-runner.ts`
  - Export interface `ModelConfig`: `{ baseUrl: string; model: string; apiKey: string; maxHistoryMessages: number; recentFullMessages: number; timeoutMs: number }`
  - Export `loadModelConfig(relicDir: string): ModelConfig` — reads `.relic/models.json`; applies env var overrides (`RELIC_MODEL_BASE_URL`, `RELIC_MODEL_MODEL`, `RELIC_MODEL_API_KEY`); validates `baseUrl` and `model` are present and non-empty; on failure: `console.error(...)` with field name + `models.json` path + minimum valid schema; `process.exit(1)`
  - Export interface `RunModelOptions`: `{ command: string; userMessage: string; relicDir: string; specId?: string; fixId?: string; noStream?: boolean; resetContext?: boolean }`
  - Export `runModel(options: RunModelOptions): Promise<void>`
    1. `loadModelConfig(relicDir)`
    2. `getPromptTemplate(command)` from `@relic/engines` — error and exit if undefined
    3. Determine history path: `specId` → `specs/<specId>/history.json`; `fixId` → read `.relic/fixes/<fixId>.md`, extract `**Owning spec:**` field, use `specs/<owningSpec>/history.json`; neither → no history
    4. If `resetContext` and history path exists → write `[]` to history file
    5. Load history (`Array<{ role, content }>`) from history path; default to `[]`
    6. Apply compression: entries at index `< history.length - recentFullMessages` → pass through `compressMessage()`; drop oldest when `maxHistoryMessages` would be exceeded
    7. Build messages: `[{ role: "system", content: template }, ...compressedHistory, { role: "user", content: userMessage }]`
    8. `callModel(...)` — stream yielded chunks to stdout; collect full response string
    9. If history path is set: append `{ role: "user", content: userMessage }` and `{ role: "assistant", content: fullResponse }` to history array; write back to history file as JSON
  - Depends on: T-02, T-03, T-04

---

## Phase 3 — Workflow command implementations

All T-06 through T-15 depend on T-05. They are independent of each other.

- [ ] **T-06** Create `packages/core/src/commands/solve.ts`
  - Export interface `RunSolveOptions`: `{ relicDir: string; fix?: string; noStream?: boolean }`
  - Resolve fix ID: `options.fix` → `readSession(relicDir).fix` → error and exit if neither set
  - Read `.relic/fixes/<fixId>.md`; error and exit if file does not exist
  - Pass fix document content as `userMessage`
  - Call `runModel({ command: "solve", userMessage: fixDocContent, relicDir, fixId, noStream })` — no `specId`, no `resetContext` (runner suppresses history for solve since `fixId`-based history only applies to fix, not solve)

- [ ] **T-07** Create `packages/core/src/commands/constitution.ts`
  - Export interface `RunConstitutionOptions`: `{ relicDir: string; noStream?: boolean }`
  - Call `runModel({ command: "constitution", userMessage: "", relicDir, noStream })` — no `specId`, no `fixId`, no `resetContext`

- [ ] **T-08** Replace stub in `packages/core/src/commands/clarify.ts`
  - Update `ClarifyOptions` to include `spec?: string; noStream?: boolean; resetContext?: boolean`
  - Assemble spec context: resolve spec via resolution chain → `buildContext()` + `renderContext()` from `context-builder.ts`
  - Call `runModel({ command: "clarify", userMessage: renderedContext, relicDir, specId, noStream, resetContext })`

- [ ] **T-09** Replace stub in `packages/core/src/commands/plan.ts`
  - Same pattern as T-08; `command: "plan"`

- [ ] **T-10** Replace stub in `packages/core/src/commands/analyse.ts`
  - Same pattern as T-08; `command: "analyse"`

- [ ] **T-11** Replace stub in `packages/core/src/commands/tasks.ts`
  - Same pattern as T-08; `command: "tasks"`

- [ ] **T-12** Replace stub in `packages/core/src/commands/implement.ts`
  - Same pattern as T-08; `command: "implement"`

- [ ] **T-13** Update `packages/core/src/commands/fix.ts`
  - Add `noStream?: boolean; resetContext?: boolean` to `FixOptions`
  - Preserve existing spec-resolution and context-assembly logic
  - After context is assembled: call `runModel({ command: "fix", userMessage: renderedContext + (issue ? "\n\n## Issue\n" + issue : ""), relicDir, specId, noStream, resetContext })`
  - Note: `specId` is used (not `fixId`) — the fix document doesn't exist yet at this point; history goes into the owning spec's `history.json`

- [ ] **T-14** Update `packages/core/src/commands/specify.ts`
  - Add `noStream?: boolean; resetContext?: boolean` to `SpecifyOptions`
  - After scaffolding: check `fileExists(join(relicDir, "models.json"))`
    - If yes: assemble context for the new spec; call `runModel({ command: "specify", userMessage: renderedContext + (title ? "\n\n## Title\n" + title : ""), relicDir, specId, noStream, resetContext })`
    - If no: existing behaviour — print "In your AI agent: /relic.specify"

- [ ] **T-15** Update `packages/core/src/commands/scan.ts`
  - Add `manifest?: boolean` to `ScanOptions` (default `false` — AI workflow is the new default)
  - When `manifest: false`: run existing manifest-build logic internally; serialise to human-readable string; call `runModel({ command: "scan", userMessage: manifestString, relicDir, noStream })`; no `specId` or `fixId`
  - When `manifest: true, json: true`: existing JSON output
  - When `manifest: true, json: false`: existing human-readable output
  - Backward compat: `json: true` without `manifest: true` → treat as `manifest: true, json: true`

---

## Phase 4 — Validation update

- [ ] **T-16** Update `packages/core/src/commands/validate.ts`
  - Find the `ALLOWED_SPEC_FILES` constant (or equivalent set/array)
  - Add `"history.json"` to the allowed set
  - `history.json` exempt from content checks — presence in the set is sufficient

---

## Phase 5 — Core exports

- [ ] **T-17** Update `packages/core/src/index.ts`
  - Add: `export { runSolve } from "./commands/solve.ts"`
  - Add: `export { runConstitution } from "./commands/constitution.ts"`
  - Add: `export { runModel, loadModelConfig } from "./core/model-runner.ts"`
  - Add: `export type { ModelConfig, RunModelOptions } from "./core/model-runner.ts"`
  - All existing exports unchanged
  - Depends on: T-05, T-06, T-07

---

## Phase 6 — Binary consolidation

- [ ] **T-18** Update `packages/cli-node/src/bin.ts`
  - Add imports: `runSpecify`, `runClarify`, `runPlan`, `runAnalyse`, `runTasks`, `runImplement`, `runFix`, `runSolve`, `runConstitution`, `loadModelConfig` from `@relic/core`
  - **`relic specify`**: `[--title <t>] [--spec <id>] [--no-stream] [--reset-context]`
  - **`relic clarify`**: `[--spec <id>] [--no-stream] [--reset-context]`
  - **`relic plan`**: `[--spec <id>] [--no-stream] [--reset-context]`
  - **`relic analyse`**: `[--spec <id>] [--no-stream] [--reset-context]`
  - **`relic tasks`**: `[--spec <id>] [--no-stream] [--reset-context]`
  - **`relic implement`**: `[--spec <id>] [--no-stream] [--reset-context]`
  - **`relic fix`**: `[--spec <id>] [--issue <desc>] [--no-stream] [--reset-context]`
  - **`relic solve`**: `[--fix <id>] [--no-stream]` — no `--spec`, no `--reset-context`
  - **`relic constitution`**: `[--no-stream]` — no `--spec`, no `--fix`, no `--reset-context`
  - **`relic scan` changes**: add `--manifest` boolean flag; when `--manifest` absent → AI workflow (`manifest: false`); `--json` alone → treated as `--manifest --json`; update description to reflect new default
  - **`relic model`**: new command; `--reset-context [--spec <id>]`; resolves spec from resolution chain; calls `loadModelConfig` to validate config exists; reads and clears `specs/<specId>/history.json`; exits cleanly with confirmation message
  - Depends on: T-17

- [ ] **T-19** Delete `packages/cli-node/src/bin.debug.ts`
  - Depends on: T-18

---

## Phase 7 — Tests

- [ ] **T-20** Create `packages/core/src/__tests__/history-compressor.test.ts`
  - `compressMessage`: heading line (`# Heading`) is preserved verbatim
  - `compressMessage`: bullet line (`- item`) is preserved verbatim
  - `compressMessage`: prose paragraph — only first sentence retained (up to first `.`)
  - `compressMessage`: prose with `!` terminator — sentence boundary respected
  - `compressMessage`: prose with no terminator — full line preserved
  - `compressMessage`: fenced code block is fully dropped (opening, content, and closing line)
  - `compressMessage`: mixed content — headings and bullets preserved, prose truncated, code dropped
  - `compressMessage`: empty string → empty string

---

## Phase 8 — Configuration and preamble

- [ ] **T-21** Update `.relic/.gitignore` — add two lines: `models.json` and `specs/**/history.json`

- [ ] **T-22** Update `templates/preamble.md`
  - In the `specs/<spec-id>/` section: update file list from 4 to 5; add `history.json` as session-local (gitignored)
  - Update "If you are about to create a fifth file" → "sixth file"
  - Update Prohibited Actions to say "other than the five listed above"

- [ ] **T-23** Update `.relic/preamble.md` — apply the same changes as T-22 to the installed copy

---

## Phase 9 — Verify

- [ ] **T-24** Run `bun run build:templates` — confirm both embed steps complete without error
- [ ] **T-25** Run `bun run test` — all packages pass
- [ ] **T-26** Run `relic validate` — `valid: true`, no warnings
- [ ] **T-27** Smoke test: create `.relic/models.json` pointing to a local server; run `relic plan`; confirm streaming output to stdout; run `relic model --reset-context`; confirm `history.json` is cleared

---

## Notes

**Strict dependency order:**
- T-01 → T-04 (fetchWithTimeout extension needed by model-client)
- T-02 → T-05 (`getPromptTemplate` needed by model-runner)
- T-03 → T-05 (`compressMessage` needed by model-runner)
- T-04 → T-05 (`callModel` needed by model-runner)
- T-05 → T-06 through T-15 (all workflow commands call `runModel`)
- T-05, T-06, T-07 → T-17 (new commands must exist before export)
- T-17 → T-18 (exports must exist before bin imports)
- T-18 → T-19 (bin.ts must be complete before deleting bin.debug.ts)
- T-21, T-22, T-23 are independent of all TypeScript tasks — can be done in any order

**T-06 through T-15 are independent of each other** — can be done in parallel after T-05 is complete.

**T-20 is independent of T-03** — can be done alongside the compressor implementation.

**No overlap with other specs:** All specs 001–006 are fully implemented. File overlaps on `bin.ts`, `bin.debug.ts`, `validate.ts`, `core/src/index.ts`, `templates/preamble.md` are historical — no concurrent conflict.

**`relic fix` uses `specId`, not `fixId`** (T-13): At the time `relic fix` runs, the fix document hasn't been written yet. History accumulates under the owning spec's `history.json`. The `fixId` path in `model-runner.ts` is used only by `relic solve` (and even there, history is suppressed).

**`model-client.ts` is not unit-tested** — streaming SSE requires a live server. T-27 covers the happy path manually.

**`bun run build:engine-templates` prerequisite** for T-02 and T-05: `ENGINE_TEMPLATES` is gitignored and generated at build time. Run `bun run build:engine-templates` (or `bun run build:templates`) before implementing these tasks.
