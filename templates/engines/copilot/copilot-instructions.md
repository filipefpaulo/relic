# Relic — Workspace Instructions for GitHub Copilot

This project uses **Relic** for spec-driven development. The knowledge layer lives
in `.relic/`. Read `.relic/preamble.md` before acting on any spec — it defines the
hard architectural rules that govern every interaction.

---

## Core Invariant (never violate)

**Artifacts ALWAYS live in `.relic/shared/`. NEVER inside a spec folder.**

Spec folders (`specs/<spec-id>/`) hold exactly four files and nothing else:
- `spec.md` — feature intent and requirements
- `plan.md` — implementation decisions
- `tasks.md` — atomic task checklist
- `artifacts.json` — pointer file declaring `owns`, `reads`, `touches_files`

If you are about to create a fifth file inside a spec folder, stop. Whatever you
are creating belongs in `.relic/shared/` instead.

---

## `artifacts.json` Is a Pointer File

```json
{
  "owns": ["shared/contracts/checkout-api.md"],
  "reads": ["shared/domains/user.md"],
  "touches_files": ["src/checkout/handler.ts"]
}
```

- `owns` — this spec is the authoritative owner; only it may modify these artifacts
- `reads` — this spec depends on these but does not own or modify them
- `touches_files` — source files this spec creates or modifies

Paths in `owns` and `reads` MUST point into `shared/`. A path pointing into `specs/`
is invalid and breaks intersection detection.

---

## Before Any Relic Task — Run These First

```bash
# Always: resolve spec context
relic context --spec <spec-id>

# For plan / clarify / analyse: also validate integrity
relic validate

# Discover shared artifacts — always try search first:
# 1. Extract up to 10 keywords from the user's input or the active spec.
relic search <keyword1> <keyword2> ...   # targeted: returns scored candidates
# 2. Only if search results are insufficient, fall back to:
relic deep-search                        # returns all entries; read tldr only, load selectively
```

Do not proceed if `relic validate` reports `"valid": false`.

---

## Workflow Commands

### specify — Create a new spec

> Read `.relic/preamble.md` first. Violating those rules cannot be undone by a changelog entry.

Run before starting:
```bash
relic context --spec <your-spec-id>
```

You are helping create a new spec for this project.

**Before you begin:**
1. Read `.relic/constitution.md` — understand the governing rules.
2. Scan `.relic/specs/` to understand what specs already exist.
3. Scan `.relic/shared/` to understand what artifacts already exist.

**Your task:** The user will provide a PRD, user story, or verbal description of the feature.
Help them fill in `.relic/specs/{{SPEC_ID}}/spec.md`.

Steps:
1. Write a clear **Overview** paragraph: what this feature does and why it exists.
2. Extract **Functional Requirements** (what the system must do) and **Non-Functional Requirements**.
3. Write **User Stories** in the format: *As a [role], I want [capability] so that [benefit]*.
4. Define **Scope** — what is explicitly in scope and out of scope.
5. Identify **Shared Artifacts** this spec should own or read. Check `shared/domains/`,
   `shared/contracts/`, `shared/rules/` for existing artifacts. Propose new ones where needed.
   Do NOT claim ownership of an artifact already owned by another spec.
6. Update `artifacts.json` with the correct `owns`, `reads`, and `touches_files` arrays.
7. Flag any open questions in the **Open Questions** section.

**Intersection check:** Before writing `artifacts.json`, check if any existing
`specs/*/artifacts.json` claims `owns` of the same files or artifacts. If yes, flag
the conflict in Open Questions.

**What NOT to do:** Do not create `plan.md`. Do not write code. Do not modify shared
artifacts owned by another spec.

---

### clarify — Append details or change contracts for a spec

> Read `.relic/preamble.md` first. Violating those rules cannot be undone by a changelog entry.

Run before starting:
```bash
relic context --spec <your-spec-id>
relic validate
```

Do not proceed if `relic validate` reports `"valid": false`.

You are appending details, changing contracts, or adding behaviors to an existing spec.

**Before you begin:**
1. Read `.relic/constitution.md`.
2. Read `specs/{{SPEC_ID}}/spec.md` fully.
3. Read `specs/{{SPEC_ID}}/artifacts.json`.
4. Load all referenced shared artifacts.

**Intersection check (mandatory):** Before making any changes, check all other specs'
`artifacts.json` files. Does the change affect an artifact owned by another spec?
Does it add files to `touches_files` that another spec already owns?
If yes, flag the intersection explicitly and do not proceed until resolved.

**Your task:** Apply the user's clarification to `spec.md`. Update requirements, user
stories, scope, or decisions as needed. If a shared artifact changes, update it and
write a changelog entry. Update `artifacts.json` if ownership or file touches change.

**After changes:** Write a changelog entry to `.relic/changelog.md`:
```
[clarify] {{SPEC_ID}}: [description of what changed and why]
```

---

### plan — Create an implementation plan

> Read `.relic/preamble.md` first. Violating those rules cannot be undone by a changelog entry.

Run before starting:
```bash
relic context --spec <your-spec-id>
relic validate
```

Do not proceed if `relic validate` reports `"valid": false`.

You are creating an implementation plan for this spec.

**Before writing the plan:**
1. Read `.relic/constitution.md`.
2. Read `specs/{{SPEC_ID}}/spec.md` fully.
3. Load ALL other specs' `artifacts.json` files from `specs/*/artifacts.json`.
4. Run an intersection check: which shared artifacts does this plan need to create or modify?
   Which files does this plan touch? Compare against all other specs' `owns` and `touches_files`.
5. Report any conflicts BEFORE writing the plan. Conflicts must be resolved first.

**Writing the plan:** Fill in `specs/{{SPEC_ID}}/plan.md`:
- Architecture Overview — high-level approach.
- Implementation Phases — concrete ordered steps.
- File Changes table — every file to be created or modified.
- Shared Artifact Changes — new artifacts to create, existing ones to update.
- Intersection Notes — any intersections detected and how they are resolved.

**After the plan is written:** Write a changelog entry to `.relic/changelog.md`:
```
[plan] {{SPEC_ID}}: Plan created. Touches: [list key files]. Intersections: [none | describe].
```

**What NOT to do:** Do not write a plan that claims ownership of an artifact already owned
by another spec. Do not skip the intersection check. Do not write code.

---

### analyse — Non-destructive consistency check

> Read `.relic/preamble.md` first. Violating those rules cannot be undone by a changelog entry.

Run before starting:
```bash
relic context --spec <your-spec-id>
relic validate
```

Report the `relic validate` output as your first finding, then continue with manual checks.

You are performing a non-destructive consistency check. You must NOT modify any files.

**What to check:**
1. Spec completeness — does `spec.md` have all required sections filled in?
2. Artifact freshness — do the files listed in `artifacts.json` actually exist in `shared/`?
3. Ownership consistency — is every artifact in `reads` owned by exactly one spec?
4. Plan alignment — does `plan.md` reflect the current `spec.md`? Flag divergences.
5. Cross-spec coherence — are there any undeclared intersections between specs?

**Output format:**
- ✅ [check]: [result]
- ⚠️ [check]: [issue found]
- ❌ [check]: [blocking issue found]

Do not make any changes. Suggest what to run to resolve each issue.

---

### tasks — Generate tasks from the current plan

> Read `.relic/preamble.md` first. Violating those rules cannot be undone by a changelog entry.

Run before starting:
```bash
relic context --spec <your-spec-id>
```

You are generating a task list from the current implementation plan.

**Before you begin:**
1. Read `.relic/constitution.md`.
2. Read `specs/{{SPEC_ID}}/spec.md`.
3. Read `specs/{{SPEC_ID}}/plan.md` — this is your source of truth.
4. Check other specs' `tasks.md` files for overlap (same files being modified in parallel).

**Task overlap check:** If another spec's tasks touch the same files, flag the overlap
explicitly in the Notes section of `tasks.md`. Do not block progress — flag it so the
implementer is aware.

**Writing tasks:** Fill in `specs/{{SPEC_ID}}/tasks.md`:
- Break each implementation phase into concrete, atomic tasks.
- Each task should be independently completable (one file or one concern).
- Order tasks so dependencies come first.
- Prefix tasks that depend on other specs with `[blocked by: <spec-id>]`.

**What NOT to do:** Do not write code. Do not modify `plan.md`.

---

### implement — Build the plan

> Read `.relic/preamble.md` first. Violating those rules cannot be undone by a changelog entry.

Run before starting:
```bash
relic context --spec <your-spec-id>
```

You are implementing the tasks from the current plan.

**Before you begin:**
1. Read `.relic/constitution.md`.
2. Read `specs/{{SPEC_ID}}/spec.md`.
3. Read `specs/{{SPEC_ID}}/plan.md`.
4. Read `specs/{{SPEC_ID}}/tasks.md` — work through tasks in order.

**Constraints:**
- Implement exactly what the plan describes. Do not add features not in scope.
- If you discover the plan is wrong or incomplete, stop and run the plan workflow to update it first.
- If your implementation requires changing a shared artifact, check ownership in `artifacts.json`
  before modifying it. If you do not own it, flag it and do not modify.
- Write a changelog entry for every significant architectural decision made during implementation.

**When a task is done,** check it off in `tasks.md`:
```
- [x] Task description
```

**When all tasks are done,** write a final changelog entry:
```
[implement] {{SPEC_ID}}: Implementation complete. [brief summary]
```

---

### fix — Fix a bug using the spec as context

> Read `.relic/preamble.md` first. Violating those rules cannot be undone by a changelog entry.

Run before starting:
```bash
relic context --spec <your-spec-id>
```

You are fixing a bug in code that was built from a spec. Use the spec context as a
**constraint** — not just background reading.

**Context to load:**
- Constitution — the governing rules for this project
- Spec — the original intent for the feature
- Plan — the architectural decisions that led to this implementation
- Shared artifacts — the contracts and domains the fix must respect
- Changelog — why things are the way they are

**Your process:**

1. **Understand the bug in spec context.** Ask: What was this code supposed to do, according to
   the spec? Does the bug represent a gap in the spec, a wrong assumption, or a pure code error?
   Does the bug suggest a shared artifact is stale or wrong?

2. **Check the fix against contracts.** Before applying a fix, verify: Does the fix respect every
   contract in the loaded shared artifacts? Does the fix contradict any requirement in the spec?
   If any of the above is violated, flag it before fixing. The fix may require a clarify first.

3. **Apply the fix.** Constrained by the above. If the fix requires a small deviation from the
   plan, document it.

4. **Determine if a contract changed.**

   If NO contract changed: Write a brief entry to `.relic/changelog.md`:
   ```
   [fix] {{SPEC_ID}}: Fixed [brief description]. No contract changes required.
   ```

   If a contract DID change:
   1. Update the relevant file in `shared/contracts/` or `shared/domains/`.
   2. Write a detailed entry to `.relic/changelog.md` describing what changed and why.
   3. Identify all specs whose `artifacts.json` has the changed artifact in `reads`.
   4. For each affected spec, add a note in their `spec.md` Open Questions.

5. **Check for stale assumptions.** If the fix reveals that an entry in `shared/assumptions/`
   is now outdated, flag it explicitly.

**What you must NOT do:**
- Do not fix the bug in a way that silently violates a contract.
- Do not modify a shared artifact without a changelog entry.
- Do not assume the spec is wrong — if spec and code disagree, raise it.

**Output format after fixing:**
1. Root cause — what caused the bug.
2. Fix applied — what was changed and why.
3. Contract impact — yes/no, and which artifacts if yes.
4. Affected specs — any other specs that need review.
5. Changelog entry — paste the entry you wrote.

---

### use — Switch the active spec

The user will say something like "switch to spec 002-payments" or "use spec 001-auth".
Extract the spec ID and run:

```bash
relic scaffold --spec <spec-id>
```

This updates `.relic/current-spec` so all subsequent Relic commands resolve to that spec.

After switching, confirm to the user:
- Which spec is now active and its title
- Which files exist for it (spec.md, plan.md, tasks.md)
- Suggested next step

---

### scan — Bootstrap shared artifacts from existing codebase

Run this **once** when adopting Relic on a project that already has code.

```bash
relic scan --json
```

Use the manifest to read files selectively — do not explore the filesystem manually.

**Workflow:**
1. Read `key_files` with role `entry_point`, `types`, `schema` → identify domain language and contracts.
2. Read `routes`, `services`, `middleware` files → identify the API surface.
3. Sample 5–10 business logic files → identify rules and assumptions.
4. Write artifacts to `.relic/shared/{domains,contracts,rules,assumptions}/`.
5. Write a changelog entry summarising what was generated.

**Artifact format** (apply to all four types):
```markdown
# <Name>

**Type:** domain | contract | rule | assumption
**Inferred from:** <file paths>
**Confidence:** high | medium | low

## Description
...

## Owned by
(unowned — assign when a spec takes responsibility)
```

**What NOT to do:**
- Do not create a spec or plan — this is discovery only.
- Do not write inside `specs/` — all output goes into `shared/`.
- Do not modify artifacts that already have an owner.
- Mark confidence as `medium` for inferences — they need human review.

---

### constitution — Extract project-specific principles from the codebase

Run this **once** when adopting Relic. Run after `/relic.scan` for existing codebases,
or standalone for new projects.

**Detect mode:**
```bash
relic scan --json
```
- `total_files > 10` and `tech_stack` non-empty → existing codebase (extract from code)
- Otherwise → new project (ask user for project name, framework, testing approach)

**Existing codebase workflow:**
1. Read config files: `tsconfig.json`, `.eslintrc*`, `jest.config.*` / `vitest.config.*`, `package.json`
2. Read 5–10 test files — testing approach, framework, mocking strategy
3. Read architecture files — layering, naming conventions, error handling patterns
4. Read `README.md`, `CONTRIBUTING.md`, any ADRs — explicit decisions are high confidence
5. Extract 3–7 project-specific principles (verifiable, specific, non-trivial)
6. Write to `.relic/constitution.md` — mark each principle as `(explicit)`, `(inferred)`, or `(assumed)`
7. Report to user with opportunity to correct

**New project workflow:**
Ask for: project name, language/framework, testing approach, key architecture decisions.
Fill the template. Set today's date as the ratification date.

**What NOT to do:**
- Do not copy code into constitution.md — only principles
- Do not make up principles not evidenced in the codebase
- Do not create specs or plans — this is governance only
- Do not modify `.relic/preamble.md` — it is not amendable
