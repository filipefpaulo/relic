# Spec: Structured Write Command

**Spec ID:** 006-structured-write-command
**Created:** 2026-04-15
**Status:** draft

---

## Overview

Every Relic AI workflow command currently writes to project files in an ad-hoc way — each LLM opens the file, reads its existing structure, decides how to format a new entry, and appends. With multiple agents and multiple model families in play, the results diverge: different timestamp formats, different heading styles, different toon line orderings. This spec introduces `relic write`, a single structured-write entry point that accepts a machine-friendly payload and handles all file mutations on behalf of the LLM.

The design is intentionally generic. The same command covers five target spaces: changelogs, spec index, fix index, and all four knowledge manifests. The LLM delivers a minimal JSON payload (name, description, optionally a slash-command tag and free-form metadata). `relic write` validates it, formats it, and writes it. The LLM never opens the file.

As a secondary goal, the spec tightens the **changelog enforcement rule**: the changelog is not a general progress log. It exists solely to record cross-artifact mutations — when `fix` amends a spec, when `clarify` changes a contract, when `specify` amends the constitution. All other events must not create changelog entries.

---

## Requirements

### Functional Requirements

- FR-1: `relic write` accepts a `--payload` flag whose value is a JSON string conforming to the `WritePayload` schema (see Shared Artifacts).
- FR-2: `relic write` accepts exactly one target flag per invocation from: `--changelog`, `--specs`, `--fixes`, `--knowledge-domains`, `--knowledge-contracts`, `--knowledge-rules`, `--knowledge-assumptions`.
- FR-3: For toon target spaces (`--specs`, `--fixes`, `--knowledge-*`): if an entry with the same `name` already exists in the target `.toon` file, overwrite it (upsert). If it does not exist, append a new line.
- FR-4: For `--changelog`: always append a new timestamped block. Never edit or remove existing blocks.
- FR-5: The command outputs JSON by default: `{ "target": "<flag>", "action": "appended" | "upserted", "name": "<name>" }`.
- FR-6: If the payload is malformed (missing required fields, invalid JSON), the command exits with code 1 and a human-readable error on stderr. No partial writes.
- FR-7: All `templates/prompts/*.md` files are updated to instruct the LLM to call `relic write` instead of directly editing index and changelog files. Each prompt specifies which flag to use and the exact payload shape.
- FR-8: Prompts must only instruct the LLM to write a changelog entry when a cross-artifact mutation has occurred (a file previously owned by another command is being amended). Progress, completion, and new-entry creation events must not generate changelog entries.

### Non-Functional Requirements

- NFR-1: `relic write` is a native TypeScript CLI command — no bash, no jq, no sed (Constitution Principle IV).
- NFR-2: JSON output by default; `--text` flag for human-readable output (Constitution Principle V).
- NFR-3: Zero partial writes — the file is only modified after full validation of the payload.
- NFR-4: The `WritePayload` type is exported from `@relic/core` so all internal callers share the same schema.

---

## User Stories

- As an AI agent finishing a `specify` run, I want to call `relic write --specs --payload '{"name":"...", "description":"...", "tags":["..."]}' ` so that the spec index is updated with a consistent entry without my needing to parse the toon file.
- As an AI agent applying a `fix` that amends a contract, I want to call `relic write --changelog --payload '{"name":"...", "slash_command":"/relic.fix", "description":"..."}' ` so that the audit trail records only this cross-artifact mutation.
- As a project maintainer running two different LLM models on the same project, I want all toon index entries and changelog blocks to be identically formatted regardless of which model wrote them.
- As an AI agent updating a domain artifact, I want to call `relic write --knowledge-domains --payload '...'` to upsert the manifest entry without hand-editing `manifest.toon`.

---

## Scope

### In Scope

- New `relic write` CLI command in `packages/core/src/commands/write.ts`, registered in `bin.ts` and `bin.debug.ts`.
- Test coverage in `packages/core/src/__tests__/write.test.ts` for `runWrite`, `appendChangelogEntry`, validation errors, toon upsert paths, and all target routing.
- `WritePayload` schema definition and validation exported from `@relic/core`.
- Upsert logic for all five toon target spaces.
- Append-only logic for `--changelog` (extending the existing `changelog.ts`).
- Updates to all `templates/prompts/*.md` files to replace direct file-write instructions with `relic write` invocations.
- Tightening of `ChangelogAppendOnlyRule.md` to cross-artifact-mutation-only enforcement.
- New `WriteCommandContract.md` shared artifact documenting the payload schema and all valid target flags.

### Out of Scope

- Batch writes (multiple targets in one invocation) — single target per call only.
- Writes to `spec.md`, `plan.md`, `tasks.md`, or `constitution.md` — these are LLM-authored narrative documents; `relic write` covers only structured indexes and the append-only changelog.
- Interactive/prompting mode — `relic write` is non-interactive.
- Migration of existing ad-hoc changelog entries to the new format.

---

## Shared Artifacts

**Owns:**
- `shared/contracts/WriteCommandContract.md` — new; defines the `WritePayload` schema and valid target flags.
- `shared/rules/ChangelogAppendOnlyRule.md` — ownership transfer from unowned; amended to cross-artifact-mutation-only.

**Reads:**
- `shared/contracts/ToonFormatContract.md`
- `shared/contracts/ManifestJsonContract.md`
- `shared/contracts/SpecIndexContract.md`
- `shared/contracts/FixIndexContract.md`

---

## Open Questions

- [x] **Payload delivery** — Resolved: `--payload <compact-json-string>`. LLM delivers compact single-line JSON inline. No temp file. Cheapest path for both LLM and CLI; strict validation keeps control.
- [x] **Schema union vs single shape** — Resolved at plan: single flat shape with optional fields. The CLI target flag is the discriminator; irrelevant fields are silently ignored. `WritePayload` exported from `@relic/core`. Also adds optional `file?: string` field (required for new toon entries on the append path; ignored for `--changelog`).
- [x] **Changelog format** — Resolved: new format `## [<ISO-date>] <slash-command> — <name>` (heading line), then description body on the following lines. No migration of existing entries; old entries remain as-is. All new entries via `relic write --changelog` use this format.
- [x] **Intersection on `templates/prompts/`** — Resolved: specs 002 and 005 are finished. No concurrent modification risk.
- [x] **`ChangelogAppendOnlyRule.md` ownership** — Resolved: this spec takes ownership and amends the rule (see Decisions).
- [x] **`metadata` field merge strategy** — Resolved at plan. Toon: `tldr = description + (metadata ? " — " + metadata : "")`. Changelog: description body + `"\n\n" + metadata` if present.

---

## Decisions

- **D1 — Payload as compact inline JSON**: `--payload` accepts a compact (single-line) JSON string. No temp file intermediary. This is the cheapest path for the LLM (no file I/O) and gives the CLI a strict, typed entry point with no side-channel cleanup. Weak rules (freeform text, line-separated fields) are explicitly rejected.
- **D2 — New changelog format**: `## [<ISO-date>] <slash-command> — <name>` then description body. Old entries are left untouched (append-only invariant). All new entries from `relic write --changelog` use this shape. The `slash_command` field defaults to `/relic.write` if not provided.
- **D3 — Changelog is cross-artifact-mutation-only**: The changelog must not be written on progress, creation, or completion events. It is only written when one artifact is mutated by a command that originally created a different artifact — e.g. `fix` amending a `spec`, `clarify` amending a `contract`. This replaces the previous "every plan mutation and fix event" enforcement.
- **D4 — Ownership of `ChangelogAppendOnlyRule.md`**: This spec takes ownership. The rule is amended to reflect D3 and D2. No other in-progress spec claims it.
