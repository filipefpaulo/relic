# /relic.fix

> **Before proceeding:** Read `.relic/preamble.md`. It defines where artifacts belong.
> Violating those rules cannot be undone by a changelog entry.

## Before you begin — run this first

```bash
bash .relic/scripts/check-context.sh --spec <your-spec-id> --json
```

This returns all file paths and loaded context. Use it to know exactly which shared artifacts apply to this spec.

You are fixing a bug in code that was built from a spec. The spec context has been assembled
for you by `relic fix`. Use it as a **constraint** — not just background reading.

## Context already loaded

The following context has been assembled and is in your context window:
- **Constitution** — the governing rules for this project
- **Spec** — the original intent for the feature
- **Plan** — the architectural decisions that led to this implementation
- **Shared artifacts** — the contracts and domains the fix must respect
- **Changelog** — why things are the way they are

## Your process

### 1. Understand the bug in spec context
Do not just read the error and the code. Ask:
- What was this code supposed to do, according to the spec?
- Does the bug represent a gap in the spec, a wrong assumption, or a pure code error?
- Does the bug suggest a shared artifact is stale or wrong?

### 2. Check the fix against contracts
Before applying a fix, verify:
- Does the fix respect every contract in the loaded shared artifacts?
- Does the fix contradict any requirement in the spec?
- Does the fix violate any rule in the loaded shared rules?

If any of the above is violated, flag it before fixing. The fix may require a `clarify` first.

### 3. Apply the fix
Constrained by the above. If the fix requires a small deviation from the plan, document it.

### 4. Determine if a contract changed

**If NO contract changed:**
Write a brief entry to `.relic/changelog.md`:
```
[fix] {{SPEC_ID}}: Fixed [brief description]. No contract changes required.
```

**If a contract DID change:**
1. Update the relevant file in `shared/contracts/` or `shared/domains/`.
2. Write a detailed entry to `.relic/changelog.md` describing what changed and why.
3. Identify all specs whose `artifacts.json` has the changed artifact in `reads`.
4. For each affected spec, add a note in their `spec.md` Open Questions:
   `[!] Shared artifact [name] was changed by fix in {{SPEC_ID}}. Review required.`
5. Tell the user: *"This fix changed [artifact]. Run /relic.clarify on [affected specs]."*

### 5. Check for stale assumptions
If the fix reveals that an entry in `shared/assumptions/` is now outdated, flag it explicitly.

## What you must NOT do

- Do not fix the bug in a way that silently violates a contract.
- Do not modify a shared artifact without a changelog entry.
- Do not modify a shared artifact owned by a different spec without explicit flagging.
- Do not assume the spec is wrong — if spec and code disagree, raise it.

## Output format

After fixing, report:
1. **Root cause** — what caused the bug.
2. **Fix applied** — what was changed and why.
3. **Contract impact** — yes/no, and which artifacts if yes.
4. **Affected specs** — any other specs that need review.
5. **Changelog entry** — paste the entry you wrote.
