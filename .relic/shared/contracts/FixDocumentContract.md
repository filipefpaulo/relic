# FixDocumentContract

**Type:** contract
**Owned by:** 003-fix-solve-workflow
**Confidence:** high

## Description

Schema for `.relic/fixes/<fix-id>.md` — the fix document written by `/relic.fix` and
consumed by `/relic.solve`. These files are committed to version control.

## Schema

```markdown
# Fix: <fix-id>

**Date:** YYYY-MM-DD
**Owning spec:** <spec-id>
**Status:** pending-approval | approved | solved

---

## Issue

<The original issue description as reported by the user — verbatim or paraphrased.>

## Root Cause

**Classification:** code-bug | misspecification | misunderstanding | wrong-spec

<Explanation of why this classification was chosen, grounded in the spec context.>

## Proposed Changes

### Code changes
<List of files and what changes are needed. Not the actual code — the description.>

### Spec amendments
<Only present if classification is misspecification, misunderstanding, or wrong-spec.
Describe what needs to change in spec.md and/or plan.md.>

### Shared artifact changes
<Only present if a contract or domain artifact needs updating. List which artifacts
and what changes. Identify all specs in reads[] that will be affected.>

## Changelog entry (draft)
<Draft changelog entry for .relic/changelog.md. /relic.solve will write this verbatim.>
```

## Status Transition Rules

- `/relic.fix` creates the document with `status: pending-approval`
- The human reviewer sets `status: approved` to unblock `/relic.solve`
- `/relic.solve` sets `status: solved` on completion
- `/relic.solve` will refuse to run if status is not `approved`
