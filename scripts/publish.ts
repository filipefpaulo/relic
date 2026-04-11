#!/usr/bin/env bun
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

// --- arg parsing ---
const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith("--"));
const repoIdx = args.indexOf("--repository");
const repository = repoIdx !== -1 ? args[repoIdx + 1] : null;

if (!version) {
  console.error("Error: version is required");
  console.error("");
  console.error("Usage:");
  console.error("  bun run publish <version>                     # publish to npm + pypi");
  console.error("  bun run publish <version> --repository npm    # npm only");
  console.error("  bun run publish <version> --repository pypi   # pypi only");
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Error: '${version}' is not valid semver (expected x.y.z)`);
  process.exit(1);
}

if (repository && !["npm", "pypi"].includes(repository)) {
  console.error(`Error: --repository must be 'npm' or 'pypi', got '${repository}'`);
  process.exit(1);
}

const tag = repository ? `v${version}-${repository}` : `v${version}`;

console.log(`Version : ${version}`);
console.log(`Tag     : ${tag}`);
console.log(`Target  : ${repository ?? "npm + pypi"}`);
console.log("");

// --- version bump helpers ---
function bumpJson(path: string) {
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  pkg.version = version;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`  bumped ${path}`);
}

function bumpRegex(path: string, pattern: RegExp, replacement: string) {
  const src = readFileSync(path, "utf8");
  writeFileSync(path, src.replace(pattern, replacement));
  console.log(`  bumped ${path}`);
}

// --- bump all 6 files ---
bumpJson("package.json");
bumpJson("packages/cli-node/package.json");
bumpRegex("packages/cli-node/src/bin.ts", /\.version\("[^"]+"\)/, `.version("${version}")`);
bumpRegex("packages/cli-node/src/bin.debug.ts", /\.version\("[^"]+"\)/, `.version("${version}")`);
bumpRegex("packages/cli-python/pyproject.toml", /^version = "[^"]+"/m, `version = "${version}"`);
bumpRegex("packages/cli-python/relic/__init__.py", /__version__ = "[^"]+"/, `__version__ = "${version}"`);

console.log("");

// --- commit, tag, push ---
execSync(
  `git add package.json packages/cli-node/package.json packages/cli-node/src/bin.ts packages/cli-node/src/bin.debug.ts packages/cli-python/pyproject.toml packages/cli-python/relic/__init__.py`,
  { stdio: "inherit" }
);
execSync(`git commit -m "chore: bump version to ${version}"`, { stdio: "inherit" });
execSync(`git tag ${tag}`, { stdio: "inherit" });
execSync(`git push`, { stdio: "inherit" });
execSync(`git push origin ${tag}`, { stdio: "inherit" });

console.log("");
console.log(`Done — CI publishing to: ${repository ?? "npm + pypi"}`);
