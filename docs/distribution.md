# Relic — Distribution Architecture

> This document covers how Relic is packaged, published, and versioned across npm and PyPI.
> Read `implementation.md` for the core CLI architecture; read this for the publishing pipeline.

---

## Overview

Relic ships via two channels from a single TypeScript source:

| Channel | Package | Binary type | Runtime required |
|---|---|---|---|
| npm | `relic-cli` | Node.js JS bundle (186 KB) | Node.js 18+ |
| PyPI / uv | `relic-cli` | Platform-compiled native binary | None |

Both use the same source (`packages/cli-node/src/bin.ts`). The build target differs.

---

## npm Distribution (`packages/cli-node/`)

### Build

```bash
bun run build:npm
```

Runs:
1. `scripts/embed-templates.ts` — bakes all `.md`/`.sh` templates into `generated/templates.ts`
2. `bun build --target node` — produces `packages/cli-node/dist/relic.js` (186 KB, pure JS)
3. `scripts/fix-shebang.mjs` — replaces the Bun shebang with `#!/usr/bin/env node`

The shebang fix is necessary because `bun build --target node` always injects `#!/usr/bin/env bun`
into the output regardless of target. Without the fix, tools that inspect shebangs treat the
bundle as a Bun package.

### Package structure

```
packages/cli-node/
  dist/relic.js       ← the Node.js bundle (built, gitignored)
  README.md           ← npm-specific README
  package.json        ← name: relic-cli, bin: ./dist/relic.js
```

`package.json` has no runtime `dependencies` — `@relic/core` and `commander` are inlined
by the bundler. They appear as `devDependencies` so `bun install` resolves them at build time.

### CI

`.github/workflows/publish-npm.yml` — triggers on `v*` tags (skips if tag ends in `-pypi`):

1. Install Bun + Node.js 20
2. `bun install`
3. `bun run build:npm`
4. `npm publish --access public` (uses `NPM_TOKEN` secret)

---

## PyPI Distribution (`packages/cli-python/`)

### Concept

A thin Python package (`relic-cli`) that ships a pre-compiled Bun binary as package data.
`relic/__main__.py` finds the binary, ensures it is executable, and `subprocess.run`s it
with forwarded argv. Zero Python business logic — the binary is the entire implementation.

### Build

```bash
bun run build:pypi:macos-arm64   # local (Apple Silicon)
bun run build:pypi:linux-x64     # cross-compile from any OS
```

Five platform targets:

| Script | Bun target | Output |
|---|---|---|
| `build:pypi:linux-x64` | `bun-linux-x64` | `packages/cli-python/relic/relic` |
| `build:pypi:linux-arm64` | `bun-linux-arm64` | `packages/cli-python/relic/relic` |
| `build:pypi:macos-x64` | `bun-darwin-x64` | `packages/cli-python/relic/relic` |
| `build:pypi:macos-arm64` | `bun-darwin-arm64` | `packages/cli-python/relic/relic` |
| `build:pypi:windows-x64` | `bun-windows-x64` | `packages/cli-python/relic/relic.exe` |

The binary is gitignored — it is placed here by the build step and included by hatchling
via the `artifacts` field in `pyproject.toml`.

### Package structure

```
packages/cli-python/
  pyproject.toml           ← hatchling build, name: relic-cli, scripts: relic = relic.__main__:main
  README.md                ← PyPI-specific README
  relic/
    __init__.py            ← __version__ only
    __main__.py            ← finds binary, ensures +x, subprocess.run(binary + sys.argv[1:])
    relic                  ← compiled binary (built, gitignored)
    relic.exe              ← Windows binary (built, gitignored)
```

### Wheel format

Wheels are platform-specific. `python -m build` produces a `py3-none-any.whl` (generic),
which CI renames to include the correct platform tag:

```
relic_cli-0.1.9-py3-none-macosx_11_0_arm64.whl
relic_cli-0.1.9-py3-none-manylinux_2_17_x86_64.whl
relic_cli-0.1.9-py3-none-win_amd64.whl
```

pip/uv selects the right wheel for the current platform automatically.

### macOS code signing

Bun compiled binaries on macOS must be ad-hoc signed or macOS Gatekeeper kills them
with SIGKILL (exit 247/137). The CI:

1. Compiles the binary on a `macos-latest` runner (required — `codesign` is macOS-only)
2. Removes any existing invalid signature: `codesign --remove-signature`
3. Applies ad-hoc signature: `codesign --force --sign - --timestamp=none`

Linux binaries are cross-compiled on `ubuntu-latest` (no signing needed).
Windows binaries are cross-compiled on `ubuntu-latest` (no signing needed).

### CI

`.github/workflows/publish-pypi.yml` — triggers on `v*` tags (skips if tag ends in `-npm`):

**Job 1 — `build-binaries`** (matrix, one per platform):
- darwin targets: `macos-latest` runner
- linux/windows: `ubuntu-latest` runner
- Compiles binary with Bun, ad-hoc signs darwin binaries, uploads as artifact

**Job 2 — `build-wheels`** (matrix, one per platform, depends on Job 1):
- Downloads compiled binary, places in `packages/cli-python/relic/`
- Builds wheel with `python -m build`
- Renames wheel file with platform tag
- Uploads wheel artifact

**Job 3 — `publish`** (depends on Job 2):
- Downloads all 5 wheel artifacts
- Publishes to PyPI via `pypa/gh-action-pypi-publish` (OIDC trusted publisher)

### PyPI trusted publisher setup

The PyPI project is configured with a GitHub OIDC trusted publisher (no API token needed):
- Project: `relic-cli`
- Owner: `filipefpaulo`
- Repository: `relic`
- Workflow: `publish-pypi.yml`

---

## Unified Publish Script (`scripts/publish.ts`)

```bash
bun run publish <version> [--repository npm|pypi]
```

What it does:
1. Validates semver format (`x.y.z`)
2. Bumps version in all 6 files:
   - `package.json` (root)
   - `packages/cli-node/package.json`
   - `packages/cli-node/src/bin.ts`
   - `packages/cli-node/src/bin.debug.ts`
   - `packages/cli-python/pyproject.toml`
   - `packages/cli-python/relic/__init__.py`
3. Commits with `chore: bump version to X.Y.Z`
4. Creates git tag (`v0.1.7`, `v0.1.7-npm`, or `v0.1.7-pypi`)
5. Pushes commit and tag

### Tag routing

| Tag | npm CI | PyPI CI |
|---|---|---|
| `v0.1.7` | ✅ runs | ✅ runs |
| `v0.1.7-npm` | ✅ runs | ⏭ skipped |
| `v0.1.7-pypi` | ⏭ skipped | ✅ runs |

CI conditions: `if: "!endsWith(github.ref_name, '-pypi')"` / `'-npm'`

---

## README structure

Three separate READMEs — each scoped to its audience:

| File | Shown on | Audience |
|---|---|---|
| `README.md` | GitHub repo | Project overview, both install methods |
| `packages/cli-node/README.md` | npmjs.com | Node.js users, `npm install` / `npx` |
| `packages/cli-python/README.md` | pypi.org | Python users, `uv tool install` / `pip install` |

---

*Document created: April 11, 2026.*
*Covers: npm + PyPI distribution, CI workflows, publish script, macOS signing.*
