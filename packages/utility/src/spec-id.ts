import { execSync } from "child_process";
import { join } from "path";
import { listDirs, fileExists, readText } from "./fs.ts";
import { readSession } from "./session.ts";

export function nextSpecId(specsDir: string, slug: string): string {
  const existing = listDirs(specsDir);
  const max = existing.reduce((acc, name) => {
    const n = parseInt(name.slice(0, 3), 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  const padded = String(max + 1).padStart(3, "0");
  return `${padded}-${slug}`;
}

export function inferSpecFromBranch(branch: string): string | null {
  const match = branch.match(/(\d{3}-[a-z0-9-]+)/);
  return match?.[1] ?? null;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function availableSpecs(specsDir: string): string[] {
  return listDirs(specsDir).filter((name) => /^\d{3}-/.test(name));
}

/**
 * Canonical five-step spec resolution chain used by all workflow commands:
 *   1. explicit --spec arg
 *   2. active fix → owning spec (from session.fix → fix document **Owning spec:** field)
 *   3. RELIC_SPEC env var
 *   4. session.json (spec field)
 *   5. git branch name inference
 *
 * Step 2 ensures commands like clarify and analyse automatically use the fix's owning
 * spec when a fix is active, without requiring the user to also set session.spec.
 *
 * Returns undefined if no step resolves — callers are responsible for the error/exit.
 */
export function resolveSpec(arg: string | undefined, relicDir: string): string | undefined {
  if (arg) return arg;

  const session = readSession(relicDir);

  // Step 2: active fix → owning spec
  if (session.fix) {
    const fixPath = join(relicDir, "fixes", `${session.fix}.md`);
    if (fileExists(fixPath)) {
      const content = readText(fixPath);
      const match = content.match(/\*\*Owning spec:\*\*\s*([^\n]+)/);
      const owningSpec = match?.[1]?.trim();
      if (owningSpec) return owningSpec;
    }
  }

  if (process.env["RELIC_SPEC"]) return process.env["RELIC_SPEC"];
  if (session.spec) return session.spec;
  try {
    const branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
    const inferred = inferSpecFromBranch(branch);
    if (inferred) return inferred;
  } catch {
    // not in a git repo or git not available
  }
  return undefined;
}

/**
 * Canonical two-step fix resolution chain:
 *   1. explicit --fix arg
 *   2. session.json (fix field)
 *
 * Returns undefined if neither resolves — callers are responsible for the error/exit.
 */
export function resolveFix(arg: string | undefined, relicDir: string): string | undefined {
  if (arg) return arg;
  return readSession(relicDir).fix ?? undefined;
}
