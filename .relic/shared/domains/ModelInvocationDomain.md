# ModelInvocationDomain

**Type:** domain
**Owned by:** 007-remote-ollama-engine

## Description

The direct model invocation domain. Covers promoting Relic workflow commands to first-class production CLI commands that assemble spec context, load the relevant prompt template, and call any OpenAI-compatible API endpoint directly — bypassing any IDE agent. Also covers the consolidation of `bin.ts` and `bin.debug.ts` into a single production binary. The design is model-agnostic and anticipates multi-model, multi-agent, and review-agent growth.

## Key Entities

- **Workflow commands** (`relic specify`, `relic clarify`, `relic plan`, `relic analyse`, `relic tasks`, `relic implement`, `relic fix`, `relic solve`, `relic constitution`, `relic scan`): Moved to the single production binary. When `.relic/models.json` is present, each runs the full model invocation pipeline. If `models.json` is absent or invalid, the command prints an actionable error to stderr and exits — no fallback, no stack trace.
- **`relic scan` default inverted**: The default is now the AI workflow — assembles the manifest internally and passes it to the model with the `scan` prompt template. `--manifest` preserves the original manifest output; `--manifest --json` preserves the original JSON output.
- **`relic model --reset-context`**: Clears `.relic/specs/<spec-id>/history.json` for the current spec. `relic model` is the extensible entry point for all future model management commands.
- **`models.json`** (`.relic/models.json`): Gitignored project-local config. Schema defined in ModelConfigContract.
- **History** (`.relic/specs/<spec-id>/history.json`): Per-spec gitignored conversation history colocated with the spec. Format: JSON array of `{ role: "user" | "assistant"; content: string }` — the same shape as the OpenAI messages array, read directly and spread into the messages payload. Gitignored via the pattern `specs/**/history.json` in `.relic/.gitignore`. Allowed by the amended SpecFilesAllowlistRule. History is only persisted for spec-scoped workflow commands (specify, clarify, plan, analyse, tasks, implement, fix). Constitution and scan do not persist history. `relic solve` does not persist history (one-shot application command).
- **Model client** (`packages/core/src/core/model-client.ts`): Streaming POST client built on `fetchWithTimeout` from `@relic/utility` (extended to accept `RequestInit`). Default timeout from `models.json#timeoutMs` (default 300,000ms). Must not import from any engine package.
- **Model runner** (`packages/core/src/core/model-runner.ts`): Orchestrates the full pipeline — load and validate config, load prompt template via `getPromptTemplate()` from `@relic/engines`, load and compress history (when context provided), call model client, stream output to stdout, write exchange to history (when context provided). `RunModelOptions` has optional `specId?` and `fixId?` fields — callers provide only what is relevant; the runner suppresses history when neither is present.
- **History compressor** (`packages/core/src/core/history-compressor.ts`): Pure deterministic function. Retains markdown headings, bullet points, and first sentence of each prose paragraph; drops code blocks. No model call, no I/O. Applied to messages older than `recentFullMessages` when building the messages array.
- **`getPromptTemplate(name)`** (`packages/engines/src/index.ts`): New export. `ENGINE_TEMPLATES` in `packages/engines/src/generated/engine-templates.ts` already contains all prompts keyed as `prompts/<name>.md`; this function surfaces them as a public API.

## Command Context Scoping

| Command | Context type | History persisted? | `--reset-context`? |
|---|---|---|---|
| specify, clarify, plan, analyse, tasks, implement | spec (`specId`) | yes | yes |
| fix | spec (`specId`) | yes | yes |
| solve | fix (`fixId`) | no — one-shot | no |
| constitution | none | no | no |
| scan | none | no | no |

`runModel` accepts optional `specId?` and `fixId?`. Neither is required — commands that do not need context simply omit both. At present, `fix` is invoked with `specId` and uses spec history directly, because there is not yet a fix document available at invocation time.

## Context Window Strategy

1. Last `recentFullMessages` (default 2) entries sent at full length.
2. Older entries passed through `history-compressor.ts` to produce a structural extract.
3. Entries beyond `maxHistoryMessages` are dropped, oldest first.

Entirely deterministic, zero-cost, exploits Relic's structured markdown output.

## Binary Consolidation

`bin.debug.ts` is deleted as part of this spec. All workflow commands that were debug-only stubs are now real production commands calling the model. A single `bin.ts` is maintained going forward.

## Boundaries

- SSH tunnel management is outside this domain.
- Model management (listing, pulling models) is outside this domain.
- This domain does not interact with engine hooks (claude, copilot, codex).
- LLM-based summarisation of history is explicitly out of scope.
- Multi-model routing and review-agent orchestration are deferred to a future spec.

## Relationships

- Depends on SpecResolutionDomain for context assembly.
- Depends on TemplateDomain for template embedding; `getPromptTemplate()` from `@relic/engines` surfaces the already-embedded prompts.
- Config schema defined in ModelConfigContract.
- History stored at `.relic/specs/<spec-id>/history.json` — colocated with the spec, gitignored, governed by the amended SpecFilesAllowlistRule. Separate from `session.json` (SessionStateContract owned by spec 003).
