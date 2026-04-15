# WriteCommandContract

**Type:** contract
**Owned by:** 006-structured-write-command
**Created:** 2026-04-15

## Description
The `relic write` command — a structured-write entry point for all LLM-facing file mutations
in a Relic project. The LLM delivers a compact JSON payload; the CLI validates, formats, and
writes. The LLM never opens the target file directly.

## Command signature

```
relic write <target-flag> --payload '<compact-json>'
```

Exactly one target flag must be provided per invocation.

## Target flags

| Flag | Target file | Write mode |
|---|---|---|
| `--changelog` | `.relic/changelog.md` | append-only |
| `--specs` | `.relic/specs/manifest.toon` | upsert by `name` |
| `--fixes` | `.relic/fixes/manifest.toon` | upsert by `name` |
| `--knowledge-domains` | `.relic/shared/domains/manifest.toon` | upsert by `name` |
| `--knowledge-contracts` | `.relic/shared/contracts/manifest.toon` | upsert by `name` |
| `--knowledge-rules` | `.relic/shared/rules/manifest.toon` | upsert by `name` |
| `--knowledge-assumptions` | `.relic/shared/assumptions/manifest.toon` | upsert by `name` |

## Payload schema

The `--payload` value must be a **compact single-line JSON string** (no unescaped newlines).

### Required fields (all targets)

```typescript
type WritePayload = {
  name: string;         // entry title; upsert key for toon targets
  description: string;  // becomes tldr for toon; becomes body for changelog
}
```

### Optional fields

```typescript
{
  file?: string;           // filename or folder (e.g. "001-auth/") — required for new toon entries; ignored for --changelog
  slash_command?: string;  // e.g. "/relic.fix" — used in changelog heading; ignored for toon
  tags?: string[];         // lowercase keywords — used for toon targets; ignored for --changelog
  metadata?: string;       // free-form extra context (see Metadata handling below)
}
```

### Full type (exported from `@relic/core`)

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

The schema is a **single flat shape** with optional fields. The CLI target flag is the
discriminator — irrelevant fields are silently ignored per target. `file` is validated at
runtime: required when target is a toon space and no existing entry with `name` is found
(append path); optional on the upsert path (existing file value is preserved).

## Metadata handling

`metadata` is optional and must only be provided when the LLM judges it genuinely necessary.
It is not a catch-all field — use only for information that cannot be expressed in `description`.

- **Toon targets**: `metadata` is appended to `description` with a ` — ` separator to form the full `tldr`.
- **`--changelog`**: `metadata` is appended as a new paragraph after the `description` body.

## Output (JSON, default)

```json
{ "target": "--changelog", "action": "appended", "name": "AuthAPI contract: session expiry field added" }
{ "target": "--specs", "action": "upserted", "name": "Structured Write Command" }
```

`action` is `"appended"` for `--changelog` (always new block) and for toon targets when the
entry did not previously exist. `action` is `"upserted"` for toon targets when an existing
entry was overwritten.

## Error behaviour

- Missing required fields → exit 1, stderr message, no file written
- Invalid JSON in `--payload` → exit 1, stderr message, no file written
- Missing target flag or multiple target flags → exit 1, stderr message
- Target `.toon` file does not exist → exit 1, stderr message (caller must ensure the file exists; `relic init` creates all manifest files)

## Changelog format (produced by `--changelog`)

```markdown
## [<ISO-date>] <slash-command> — <name>

<description>
[<metadata if present>]
```

`slash_command` defaults to `/relic.write` if not provided.

## LLM usage rules (enforced by prompts)

1. Always use `relic write` — never open and hand-edit a `.toon` file or `changelog.md` directly.
2. `--payload` must be compact single-line JSON. Escape any internal double-quotes.
3. `tags` must be lowercase, space-separated keywords relevant to the artifact.
4. Only write a `--changelog` entry when a cross-artifact mutation has occurred (see `ChangelogAppendOnlyRule`).
5. `metadata` is opt-in — omit unless the information adds genuine value beyond `description`.

## Consumers

- All `templates/prompts/*.md` files — instruct the LLM to call `relic write` for all index and changelog writes
- `packages/core/src/commands/write.ts` — implementation
- `packages/core/src/core/changelog.ts` — extended to support the new entry format
