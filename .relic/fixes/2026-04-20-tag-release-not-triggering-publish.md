# Fix: 2026-04-20-tag-release-not-triggering-publish

**Date:** 2026-04-20
**Owning spec:** 004-cli-self-upgrade
**Status:** solved

---

## Issue

The `tag-release.yml` workflow creates and pushes a `vX.Y.Z` tag after a PR merges to `main`,
but `publish-npm.yml` and `publish-pypi.yml` never fire. The publish CI is silent.

## Root Cause

**Classification:** code-bug

GitHub Actions enforces that events triggered by the built-in `GITHUB_TOKEN` do not cascade to
other workflows. This prevents recursive runs. `tag-release.yml` uses the default `GITHUB_TOKEN`
to push the tag — so although the tag exists in the repo, the `push: tags: v*` trigger in the
publish workflows is never fired.

This is a documented GitHub limitation, not a configuration error in the publish workflows
themselves. The `tag-release.yml` workflow was written without accounting for it.

## Proposed Changes

### Code changes

**1. `.github/workflows/publish-npm.yml`** — add `workflow_dispatch` as a second trigger
alongside the existing `push: tags: v*`. No inputs required; the workflow already reads the
version from `github.ref_name`, which is set correctly when dispatched at a tag ref.

**2. `.github/workflows/publish-pypi.yml`** — same: add `workflow_dispatch` trigger.

**3. `.github/workflows/tag-release.yml`** — after pushing the tag, explicitly dispatch the
publish workflows:
- Add `actions: write` to the job's permissions (required to dispatch workflows via API).
- After `git push origin "$tag"`, run:
  `gh workflow run publish-npm.yml --ref "refs/tags/${tag}"`
  `gh workflow run publish-pypi.yml --ref "refs/tags/${tag}"`
- The `gh` CLI is available in all GitHub-hosted runners and uses `GITHUB_TOKEN` automatically.

**4. `.relic/specs/004-cli-self-upgrade/artifacts.json`** — add `tag-release.yml` and
`publish-npm.yml` to `touches_files` (both are unowned and directly related to the publish flow
owned by spec 004).

### Spec amendments

None. The spec describes the correct end-to-end publish behaviour. The GitHub Actions cascade
limitation is an infrastructure detail not covered at the spec level.

### Shared artifact changes

None.

## Changelog entry (draft)

```
### Fixed
- Release tag push (via `tag-release.yml`) now correctly triggers the npm and PyPI publish
  workflows. Previously the tag was created with GITHUB_TOKEN, which GitHub does not cascade
  to other workflow triggers. Both publish workflows now also accept `workflow_dispatch`, and
  `tag-release.yml` dispatches them explicitly after pushing the tag.
  (Fix: 2026-04-20-tag-release-not-triggering-publish)
```
