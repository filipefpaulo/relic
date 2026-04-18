# Spec: Remote Ollama Engine

**Spec ID:** 007-remote-ollama-engine
**Created:** 2026-04-17
**Status:** draft

---

## Overview

Relic's existing "engines" (claude, copilot, codex) are IDE integration hooks — they write prompt files that an IDE agent picks up and executes. This spec introduces a complementary capability: **direct model execution**. The Relic workflow commands (`relic specify`, `relic clarify`, `relic plan`, etc.) are promoted to first-class commands in the single production binary. When `.relic/models.json` is present, they assemble spec context, load the relevant prompt template, and call any OpenAI-compatible API endpoint directly — no IDE required. The design is model-agnostic: any server that speaks the OpenAI `/v1/chat/completions` protocol is supported. The primary motivator is users running Ollama models locally or on a remote machine via SSH port forwarding, but the architecture anticipates multi-model, multi-agent, and review-agent workflows as a natural growth path. This spec also consolidates `bin.ts` and `bin.debug.ts` into a single binary, removing the split that existed only while workflow commands were stubs.

---

## Requirements

### Functional Requirements

- FR-1: The workflow commands `relic specify`, `relic clarify`, `relic plan`, `relic analyse`, `relic tasks`, `relic implement`, `relic fix`, `relic solve`, and `relic constitution` are added to the production binary. `relic scan` is inverted to match `/relic.scan`: by default it now runs the AI workflow (assembles the project manifest internally, then calls the model with the scan prompt template). The `--manifest` flag preserves today's behaviour — outputting the raw project manifest without calling any model. `--manifest --json` preserves the existing `--json` output. This ensures IDE and terminal usage are symmetric: `/relic.scan` and `relic scan` do the same thing, and developers switching between them need no mental context switch. `relic use` is already in the production binary and does not require model config. When `.relic/models.json` is present, each model-dependent command assembles spec context, loads its prompt template, and calls the configured model endpoint.
- FR-2: If a model-dependent command is run and `.relic/models.json` is absent or invalid, the command prints a clear, actionable error to stderr and exits non-zero. The error must name the missing/invalid field and show the minimum valid `models.json` structure. It must not crash with a stack trace.
- FR-3: `models.json` supports: `baseUrl`, `model`, optional `apiKey` (default `""`), optional `maxHistoryMessages` (default `20`), optional `recentFullMessages` (default `2`), and optional `timeoutMs` (default `300000` — 5 minutes, to accommodate LLM transmission time).
- FR-4: Each workflow command assembles spec context using the same resolution chain used by every other Relic command (arg → env → session.json → git branch).
- FR-5: The prompt template (`templates/prompts/<command>.md`) is sent as the `system` message. User-supplied arguments and the assembled spec context are sent as the `user` message.
- FR-6: The model response is streamed to stdout as it arrives. A `--no-stream` flag disables streaming for environments that don't support SSE.
- FR-7: Conversation history is persisted per-spec at `.relic/specs/<spec-id>/history.json`, colocated with the spec. This file is gitignored via the glob pattern `specs/**/history.json` in `.relic/.gitignore`. After each model call, the full exchange (user message + model response) is appended. On subsequent calls, history is loaded and prepended to the messages array so the model retains reasoning continuity across `specify` → `clarify` → `plan` → … within a session. `history.json` is a permitted fifth file in spec directories per the amended SpecFilesAllowlistRule (session-local runtime state, never read by cross-spec tooling).
- FR-8: When building the messages array for a call, a **structural extract** is applied to any messages older than the most recent `recentFullMessages` entries (default: 2). The structural extract is computed deterministically without any model call — it retains headings, bullet points, and the first sentence of each prose paragraph, and drops code blocks.
- FR-9: When the total number of history entries would exceed `maxHistoryMessages`, the oldest entries are dropped. The most recent `recentFullMessages` entries are always kept full regardless of `maxHistoryMessages`.
- FR-10: The `relic model` command is the single entry point for model management. The `--reset-context` flag clears `.relic/specs/<spec-id>/history.json` for the current spec. The same `--reset-context` flag on any workflow command clears history before running. `relic model` is designed for future extensibility (e.g. `relic model --status`, `relic model --history`).
- FR-11: SSH tunneling is the user's responsibility; commands only need `baseUrl` to be reachable.
- FR-12: `RELIC_MODEL_BASE_URL`, `RELIC_MODEL_MODEL`, and `RELIC_MODEL_API_KEY` env vars override the corresponding `models.json` fields, enabling CI usage without committed credentials.

### Non-Functional Requirements

- NFR-1: No new runtime dependencies. The model client uses the `fetchWithTimeout` wrapper from `@relic/utility`, extended to accept an optional `RequestInit` parameter (for POST body and headers). The default timeout for model calls is `timeoutMs` from `models.json` (default 300,000ms), replacing the 10s default used for ordinary utility fetches.
- NFR-2: Prompt templates are loaded via a new `getPromptTemplate(name: string): string | undefined` export added to `@relic/engines/src/index.ts`. The underlying data already exists — `ENGINE_TEMPLATES` in `packages/engines/src/generated/engine-templates.ts` contains all prompts keyed as `prompts/<name>.md`. This export just surfaces them. The model client (`model-client.ts`) must not import from any engine package; only the runner (`model-runner.ts`) does.
- NFR-3: The history compressor is a standalone pure-function module at `packages/core/src/core/history-compressor.ts`. No I/O, no model calls, no side effects.
- NFR-4: `models.json` is gitignored in `.relic/.gitignore`. Per-spec `history.json` files are gitignored via the glob `specs/**/history.json` in `.relic/.gitignore`. Neither is committed.
- NFR-5: All config validation errors are actionable: name the missing field, show the path to `models.json`, and show the minimum valid schema.
- NFR-6: The workflow commands are thin orchestrators only — assemble context → load template → build messages → call model → stream output. No business logic from prompt templates is duplicated in TypeScript.

---

## User Stories

- As a developer using Ollama on a remote machine, I want to SSH-tunnel the Ollama port locally and run `relic plan` so that I can drive Relic workflows with my custom models, without needing Claude Code.
- As a developer running a multi-step workflow, I want the model to retain reasoning from my previous `relic specify` call when I run `relic clarify`, without re-sending the full prior response at full token cost.
- As a CI pipeline, I want to set `RELIC_MODEL_BASE_URL` and `RELIC_MODEL_MODEL` env vars so I can drive Relic workflows against a hosted model without committing credentials.
- As a developer evaluating local LLMs, I want to point Relic at any OpenAI-compatible server to compare model outputs on the same assembled context and prompt.
- As a developer, I want a single `relic` binary with all commands — no separate debug binary — so there is one system to understand and maintain.

---

## Scope

### In Scope

- All workflow commands (`specify`, `clarify`, `plan`, `analyse`, `tasks`, `implement`, `fix`, `solve`, `constitution`) added to the single production `bin.ts`
- `relic scan` default inverted to AI workflow (matches `/relic.scan`); `--manifest` flag preserves existing manifest output; `--manifest --json` preserves existing `--json` output
- `packages/cli-node/src/bin.debug.ts` deleted; all its commands merged into `bin.ts`
- `packages/core/src/core/model-client.ts` — streaming POST client using extended `fetchWithTimeout`
- `packages/core/src/core/model-runner.ts` — orchestrates context assembly → template loading → history loading → model call → stream output → history write
- `packages/core/src/core/history-compressor.ts` — deterministic structural extract; pure function
- `packages/utility/src/fetch.ts` — extend `fetchWithTimeout` to accept optional `RequestInit`
- `packages/engines/src/index.ts` — add `getPromptTemplate(name: string): string | undefined` export
- `.relic/models.json` schema (baseUrl, model, apiKey, maxHistoryMessages, recentFullMessages, timeoutMs)
- `.relic/specs/<spec-id>/history.json` — per-spec gitignored conversation history (colocated with spec, allowed by amended SpecFilesAllowlistRule)
- `relic model --reset-context` command; `--reset-context` flag on all workflow commands
- `.relic/.gitignore` update: `models.json` entry + `specs/**/history.json` glob
- Env var overrides: `RELIC_MODEL_BASE_URL`, `RELIC_MODEL_MODEL`, `RELIC_MODEL_API_KEY`
- `--no-stream` and `--spec <id>` flags on all workflow commands
- Actionable stderr error when `models.json` is missing or invalid

### Out of Scope

- SSH tunnel management
- Model management (listing, pulling, deleting Ollama models)
- Multi-model routing within a single invocation (deferred to future multi-agent spec)
- Response caching
- LLM-based summarisation of history — the compressor is deterministic only
- A new `--engine ollama` flag on `relic init` / `relic add-engine`
- Tool use / function calling
- Automatic changelog entries on workflow command completion

---

## Shared Artifacts

**Owns:**
- `shared/domains/ModelInvocationDomain.md`
- `shared/contracts/ModelConfigContract.md`
- `shared/assumptions/OllamaOpenAICompat.md`

**Reads:**
- `shared/domains/SpecResolutionDomain.md`
- `shared/domains/TemplateDomain.md`
- `shared/contracts/ContextResultContract.md`

---

## Open Questions

*(none)*

---

## Decisions

- **No `invoke` subcommand** — `relic specify`, `relic clarify`, etc. are the entry points directly.
- **`relic scan` default inverted** — `relic scan` now runs the AI workflow by default, matching `/relic.scan` in the IDE. `--manifest` flag (and `--manifest --json`) are the escape hatch for the raw project manifest. Rationale: symmetry between IDE and terminal reduces the mental overhead of switching contexts.
- **`models.json` not `invoke.json`** — broader name for multi-agent/review-agent growth path.
- **Prompt template → system message; user args + context → user message** — most compatible pattern across Ollama model families.
- **History stored at `.relic/specs/<spec-id>/history.json`** — colocated with the spec for natural discoverability. `SpecFilesAllowlistRule` amended to allow `history.json` as a permitted fifth file (session-local runtime state, gitignored via `specs/**/history.json`, never read by cross-spec tooling). `packages/core/src/commands/validate.ts` updated accordingly.
- **`relic model --reset-context` not `relic model-reset`** — `relic model` is the extensible subcommand for all future model management features.
- **Programmatic structural extract, not LLM summarisation** — `history-compressor.ts` is deterministic: headings + bullets + first sentence of prose; code blocks dropped. Last `recentFullMessages` (default 2) always kept full.
- **`getPromptTemplate()` added to `@relic/engines`** — `ENGINE_TEMPLATES` already contains all prompts; the export just surfaces them. `model-runner.ts` uses this; `model-client.ts` stays engine-free.
- **`fetchWithTimeout` extended for POST** — `@relic/utility` wrapper gains optional `RequestInit`; default LLM timeout 300,000ms (5 min) overrides the utility's 10s default.
- **Single production binary** — `bin.debug.ts` deleted; all workflow commands merged into `bin.ts`. One system to maintain.
- **Error-only on missing config** — actionable stderr, exit non-zero. No fallback stdout dump.
- **Changelog rules unchanged** — only cross-artifact mutations trigger a changelog entry.
- **All previous intersection concerns resolved** — specs 003 and 004 are merged.
- **`RunSolveOptions` is fix-scoped, not spec-scoped** — `relic solve` receives a fix ID (resolved via fix resolution chain: arg → `session.fix`), not a spec ID. The owning spec is derived from the fix document's `Owning spec:` field at runtime. This matches the `/relic.solve` prompt template's context model. `relic solve` does NOT persist conversation history — it is a one-shot application command, not a multi-turn dialogue. `--reset-context` is therefore absent from `RunSolveOptions`.
- **`RunConstitutionOptions` is project-scoped** — `{ relicDir, noStream?: boolean }` only. No spec, no fix, no reset-context. Constitution regeneration is a project-level operation; it reads the codebase, not any specific spec or fix session. No history is persisted for constitution runs.
- **`RunModelOptions` optional context fields** — `specId` and `fixId` are both optional. Callers provide only what is semantically relevant: specify/clarify/plan/analyse/tasks/implement pass `specId`; fix passes `fixId` (runner reads owning spec from fix document for history path); solve passes `fixId` but suppresses history; constitution and scan pass neither. `runModel` does not enforce context presence — it skips history entirely when neither `specId` nor `fixId` is provided.
- **History file format is JSON array** — `history.json` stores `Array<{ role: "user" | "assistant"; content: string }>`, the same shape as the OpenAI messages array. The array is read directly and spread into the messages payload. Markdown would require custom role-boundary parsing and is fragile. JSONL would improve append performance but requires sequential writes; given expected file sizes, a full JSON rewrite per call is acceptable. Content values are already markdown — the file is human-readable by inspection.
