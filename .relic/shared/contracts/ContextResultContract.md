# ContextResultContract

**Type:** contract
**Inferred from:** packages/core/src/commands/context.ts
**Confidence:** high

## Description
The JSON output of `relic context`. Used by AI agents to determine which spec is active, which files exist, and which shared artifacts are referenced — before executing any workflow command.

## Shape
```json
{
  "relic_dir": "<absolute path>",
  "spec_id": "001-auth",
  "active_spec_source": "arg|env|session|current-spec|git-branch",
  "spec_dir": "<absolute path>",
  "files": {
    "preamble": true,
    "constitution": true,
    "spec": true,
    "plan": false,
    "tasks": false,
    "artifacts_json": true,
    "changelog": true
  },
  "shared_artifacts": [
    { "path": "shared/domains/UserAuth.md", "role": "owns|reads", "exists": true }
  ],
  "current_fix": "2026-04-13-null-session-crash"
}
```

`current_fix` is `null` when no fix is active; the fix ID string when `session.fix` is set
in `.relic/session.json`. `active_spec_source` reports `session` when the spec was resolved
from `session.json`. AI commands use these fields to detect fix/spec context and switch
behaviour accordingly.

## Consumers
- All AI workflow commands (`/relic.specify`, `/relic.plan`, `/relic.fix`, etc.) — call `relic context` first to orient themselves
- `relic validate` — uses context to locate the spec
- `/relic.clarify` and `/relic.analyse` — check `current_fix` to determine which context to operate in

## Owned by
003-fix-solve-workflow
