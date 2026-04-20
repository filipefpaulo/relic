# Fix: 2026-04-20-npm-publish-404-missing-token

**Date:** 2026-04-20
**Owning spec:** 004-cli-self-upgrade
**Status:** solved

---

## Issue

`publish-npm.yml` fails with `E404 Not Found - PUT https://registry.npmjs.org/relic-cli`:

```
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/relic-cli - Not found
npm error 404  'relic-cli@0.8.4' is not in this registry.
```

Additionally, two warnings appear before the error:
- `"bin[relic]" script name was cleaned` — npm is auto-correcting the bin key name
- `"repository.url" was normalized to "git+https://github.com/filipefpaulo/relic.git"` — the
  URL format in `package.json` is wrong (missing `git+` prefix and `.git` suffix)

## Root Cause

**Classification:** code-bug

**Primary (E404):** The `NPM_TOKEN` secret is missing or invalid in the repository's GitHub
Actions secrets. When `NODE_AUTH_TOKEN` is empty, npm sends the `PUT` unauthenticated and the
npm registry returns 404. The workflow has no pre-check step — it runs `npm publish` directly,
producing a cryptic 404 instead of a clear "token not configured" error.

The user must create a new npm automation token at npmjs.com and store it as `NPM_TOKEN` in the
repository's GitHub Actions secrets (`Settings → Secrets and variables → Actions`).

**Secondary (package.json warnings):** `packages/cli-node/package.json` has:
```json
"repository": { "type": "git", "url": "https://github.com/filipefpaulo/relic" }
```
npm expects `git+https://github.com/filipefpaulo/relic.git`. The auto-correction is harmless
but generates noise on every publish and is a sign the file is not in its canonical form.

## Proposed Changes

### Code changes

**1. `.github/workflows/publish-npm.yml`** — add a token pre-check step before `npm publish`:
```
- name: Verify npm token is configured
  run: |
    if [ -z "$NODE_AUTH_TOKEN" ]; then
      echo "Error: NPM_TOKEN secret is not configured."
      echo "Create an automation token at npmjs.com and add it as NPM_TOKEN in repo secrets."
      exit 1
    fi
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```
This gives an actionable error instead of a cryptic 404.

**2. `packages/cli-node/package.json`** — fix `repository.url` to the canonical npm format:
```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/filipefpaulo/relic.git"
}
```
Eliminates the auto-correction warning on every publish.

### Spec amendments

None. The spec correctly requires publishing via `npm publish --access public` with
`NODE_AUTH_TOKEN`. The token setup is user infrastructure, not a spec concern.

### Shared artifact changes

None.

## Changelog entry (draft)

```
### Fixed
- `publish-npm.yml` now validates that the NPM_TOKEN secret is configured before running
  `npm publish`, giving a clear actionable error instead of a cryptic E404.
- `packages/cli-node/package.json` `repository.url` corrected to the canonical
  `git+https://...git` format, eliminating the "repository.url was normalized" warning on
  every publish.
  (Fix: 2026-04-20-npm-publish-404-missing-token)
```
