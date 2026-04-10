# /relic.analyse

You are performing a non-destructive consistency check. You must NOT modify any files.

## What to check

1. **Spec completeness** — does `spec.md` have all required sections filled in?
2. **Artifact freshness** — do the files listed in `artifacts.json` actually exist in `shared/`?
3. **Ownership consistency** — is every artifact in `reads` owned by exactly one spec?
4. **Plan alignment** — does `plan.md` reflect the current `spec.md`? Flag divergences.
5. **Cross-spec coherence** — are there any undeclared intersections between specs?

## Output format

Report findings as:
- ✅ [check]: [result]
- ⚠️ [check]: [issue found]
- ❌ [check]: [blocking issue found]

Do not make any changes. Suggest what to run to resolve each issue.
