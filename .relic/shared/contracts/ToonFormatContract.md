# ToonFormatContract

**Type:** contract
**Owned by:** 005-toon-manifest-format
**Created:** 2026-04-13

## Description
The Toon format — a compact, line-oriented, pipe-delimited text format for Relic index
files. Designed to reduce LLM token consumption compared to equivalent JSON. One record
per line. Fields separated by ` | ` (space-pipe-space). Lines starting with `#` are
comments. Blank lines are ignored.

## Stored line format (all three index spaces)

All three index spaces — knowledge (`shared/*/manifest.toon`), specs
(`specs/manifest.toon`), and fixes (`fixes/manifest.toon`) — use the **same 4-field
schema**:

```
<name> | <file> | <tags> | <tldr>
```
- `name` — display name of the entry (artifact name, spec title, or fix title)
- `file` — filename or folder that locates the content (no leading path prefix)
  - knowledge: `UserAuth.md`
  - spec: `001-auth/` (folder name with trailing slash)
  - fix: `2026-04-13-crash.md`
- `tags` — space-separated lowercase keywords; empty string if not yet populated
- `tldr` — one-sentence description; empty string if not yet populated

Empty fields are written as empty strings between pipes: `Name | file | | ` (still 4 fields).

## Rules

- File extension: `.toon`
- Encoding: UTF-8
- Line endings: LF preferred; CRLF (`\r\n`) must be tolerated by all parsers
- No enforced line-length limit. Fields are written verbatim — no truncation.
- Leading/trailing whitespace on each field is trimmed by parsers
- Fields must never contain the literal string ` | ` — sanitise input when encoding

## Field primitive type

```typescript
type ToonField = string | number | boolean | string[];
```

Exported from `@relic/utility`. This is a format constraint, not a domain type. It defines what
can appear as a field value in a toon row. Callers pass typed tuples directly — no pre-serialization
to `string[]` needed.

## Encoder contract (`encodeToon`)

```typescript
encodeToon<T extends ToonField[]>(rows: T[], header?: string): string
```

Input: `T[]` where `T extends ToonField[]` — typed rows. The codec has no knowledge of domain types.
Output: UTF-8 string
- First line: `# <header>` (default: `# manifest`)
- Each row: serialise each field then join with ` | `
- Per-field serialisation:
  - `string` → verbatim; sanitise ` | ` → ` - `
  - `number | boolean` → `.toString()` (cannot contain ` | `; no sanitise needed)
  - `string[]` → `.join(" ")`; sanitise result if it contains ` | `
- Empty input produces a string with only the header comment line
- No truncation, no length enforcement
- **Field ordering and field meaning are the caller's responsibility.**

## Decoder contract (`decodeToon`)

```typescript
decodeToon(content: string): string[][]
```

Input: UTF-8 string
Output: `string[][]` — one inner array per valid data line. The codec returns raw strings.
- Skip lines that are blank or start with `#`
- Split each line on ` | `; malformed lines (unexpected field count) skipped with `console.warn`
- Trim leading/trailing whitespace on each field
- Tolerate `\r\n` line endings
- **The caller is responsible for mapping string arrays to domain types.**

## CLI output line format (relic search)

When `relic search` outputs results (including `--deep` mode), it uses a unified **6-field**
toon line — the stored 4-field format plus computed `path` and `score` fields:

```
<source> | <name> | <path> | <tags> | <tldr> | <score>
```

| Field | Knowledge entry | Spec entry | Fix entry |
|---|---|---|---|
| `source` | `knowledge` | `spec` | `fix` |
| `name` | artifact name | spec title | fix title or stem |
| `path` | `shared/<subdir>/<file>` | `specs/<folder>/` | `fixes/<file>` |
| `tags` | space-separated keywords | space-separated keywords | space-separated keywords |
| `tldr` | one-sentence description | one-sentence description | one-sentence description |
| `score` | tag-overlap count | keyword match count | keyword match count |

`path` and `score` are computed at query time — they are **not stored** in `.toon` files.
`score` is `0` for `--deep` with no keywords (unscored/unranked mode).
The `source` prefix is **always present**, even for scoped output.
Parsers use a single code path regardless of which flag was used.

A comment header line is always the first line of output:
```
# relic search [--deep] [--flag]: <keywords>
# relic search --deep [--flag]
```

## Types

`@relic/utility/toon.ts` exports **no types**. The codec is a pure string-row serialiser.

Domain types live in `@relic/core`:

```typescript
// @relic/core/commands/toon-migrate.ts — universal stored entry for all three index spaces
type ManifestEntry = { name: string; file: string; tags: string[]; tldr: string };

// @relic/core/commands/search.ts — search result; returned by relic search --json
type SearchResultEntry = {
  source: "knowledge" | "spec" | "fix";
  name: string;
  path: string;
  tags: string[];
  tldr: string;
  score: number;
};
```

`ManifestEntry` is the universal stored type for all three index spaces — no separate
`SpecIndexEntry` or `FixIndexEntry` types. It is exported from `@relic/core`.

`SearchResultEntry` is exported from `@relic/core` — it is the type returned by `relic search --json`.

## Consumers
- `relic search` — reads `manifest.toon` files (scored or `--deep`); outputs 6-field toon lines
- `relic validate` — reads `manifest.toon` as the authoritative index; warns if json-only
- `relic toon-migrate` — writes all `manifest.toon` files from `manifest.json` sources;
  also generates `specs/manifest.toon` and `fixes/manifest.toon` via internal builders
- `relic init` / `relic upgrade` — auto-run toon migration and index generation
