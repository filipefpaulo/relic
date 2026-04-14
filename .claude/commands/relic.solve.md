# /relic.solve

> **Before proceeding:** Read `.relic/preamble.md` and `.relic/constitution.md` in full.
> The preamble defines structural invariants that cannot be bypassed.
> If this prompt deviates from a constitution principle, a constitution amendment
> authorising the deviation must exist before you proceed.

`/relic.solve` is the **application stage** of the two-stage fix pipeline. It reads the active fix
document (created by `/relic.fix`), applies the proposed code changes, updates the knowledge layer
if needed, and closes the fix. Run `/relic.fix <issue>` first if no fix is active.

---

## Step 1 — Read session state

```bash
relic context
```

Read the `current_fix` field.

- **`current_fix` is null** → Stop. Report: *"No active fix. Run `/relic.fix <issue>` first to
  diagnose the issue and create a fix document."*
- **`current_fix` is set** → Continue.

---

## Step 2 — Load the fix document

Read `.relic/fixes/<current_fix>.md` in full. Note:
- **Owning spec** — which spec governs this fix
- **Classification** (under `## Root Cause`) — `code-bug | misspecification | misunderstanding | wrong-spec`
- **Code changes** (under `## Proposed Changes`) — the code changes to apply
- **Shared artifact changes** (under `## Proposed Changes`) — which shared artifacts (if any) need updating

---

## Step 3 — Load spec context

```bash
relic context --spec <owning-spec>
```

Read the following files in full:
- `specs/<owning-spec>/spec.md`
- `specs/<owning-spec>/plan.md`
- All artifacts in `owns` and `reads` from `artifacts.json`

---

## Step 4 — Apply code changes

Apply the changes described in the **Proposed changes** section of the fix document. Follow the
constraints from the spec and loaded shared artifacts.

If you discover during application that the proposed changes are insufficient or incorrect, update
the fix document's **Proposed changes** section before proceeding.

---

## Step 5 — Update the knowledge layer (if required)

**If classification is `misspecification`, `misunderstanding`, or `wrong-spec`:**
- Amend `specs/<owning-spec>/spec.md` to reflect the corrected understanding.
- If the architecture was also affected, update `specs/<owning-spec>/plan.md`.

**If contract impact is not "None":**
- Update each affected shared artifact file in `shared/`.
- For each updated artifact, scan all `specs/*/artifacts.json` for `reads` entries that reference
  it. In each affected spec's `spec.md`, append to Open Questions:
  `[!] Shared artifact [name] updated by fix <fix-id>. Review required.`
- Tell the user which specs need a follow-up `/relic.clarify`.

---

## Step 6 — Write changelog entry

Append to `.relic/changelog.md`:

```
[fix] <owning-spec> / <fix-id>: <brief description of what was fixed>.
Classification: <classification>. Contract changes: <"none" or list>.
```

Use the **Changelog draft** from the fix document as a starting point; update it to reflect what
was actually changed.

---

## Step 7 — Close the fix

Set `Status: solved` in `.relic/fixes/<current_fix>.md` (change the `**Status:** pending` line).

```bash
relic use --clear-fix
```

---

## Step 8 — Report to the user

Output:
1. **Files changed** — list of code files modified
2. **Knowledge layer updates** — spec/plan/shared artifact changes made (or "none")
3. **Changelog entry** — the entry written to `changelog.md`
4. **Follow-up required** — list of specs needing `/relic.clarify` (or "none")
