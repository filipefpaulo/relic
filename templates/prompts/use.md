# /relic.use

> **Before proceeding:** Read `.relic/preamble.md`. It defines where artifacts belong.
> Violating those rules cannot be undone by a changelog entry.

Switch the active spec for this session. Works from any AI session — including remote
sessions (Claude.ai, Copilot Chat) where the user has no terminal access.

## Your task

The user will say something like:
- "switch to spec 002-payments"
- "use spec 001-auth"
- "I want to work on the payments spec"

Extract the spec ID (in `NNN-slug` format) from the user's message and run:

```bash
bash .relic/scripts/scaffold-spec.sh --spec <spec-id> --json
```

This updates `.relic/current-spec` so all subsequent Relic commands resolve to the
spec you just activated.

## After switching

Report back to the user:
- **Active spec:** the `spec_id` from the JSON output
- **Title:** derived from the spec ID
- **Files ready:** which of `spec.md`, `plan.md`, `tasks.md` exist (from `files_created` — empty means all existed)
- **Suggested next step:** based on what exists
  - If `spec.md` is empty or new → `/relic.specify`
  - If `plan.md` is empty or new → `/relic.plan`
  - If `tasks.md` is empty or new → `/relic.tasks`
  - If all exist → `/relic.implement` or `/relic.fix`

## If spec ID not found

If the user gives an ambiguous name (not in `NNN-slug` format), list available specs first:

```bash
ls .relic/specs/
```

Then ask the user to confirm which one they mean before switching.
