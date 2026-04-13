import { execSync } from "child_process";
import { join } from "path";
import { findRelicDir, fileExists, dirExists, readJson, readSession } from "@relic/utility";
import { inferSpecFromBranch, availableSpecs } from "@relic/utility";
import type { ArtifactsJson } from "../types.ts";

export interface ContextOptions {
  spec?: string;
  text?: boolean;
  relicDir?: string;
}

interface SharedArtifactRef {
  path: string;
  role: "owns" | "reads";
  exists: boolean;
}

interface ContextResult {
  relic_dir: string;
  spec_id: string;
  active_spec_source: "arg" | "env" | "session" | "git-branch";
  spec_dir: string;
  current_fix: string | null;
  files: {
    preamble: boolean;
    constitution: boolean;
    spec: boolean;
    plan: boolean;
    tasks: boolean;
    artifacts_json: boolean;
    changelog: boolean;
  };
  shared_artifacts: SharedArtifactRef[];
}

function resolveSpec(
  relicDir: string,
  specArg?: string
): { specId: string; source: ContextResult["active_spec_source"] } | null {
  // 1. --spec arg
  if (specArg) return { specId: specArg, source: "arg" };

  // 2. RELIC_SPEC env
  const envSpec = process.env["RELIC_SPEC"];
  if (envSpec) return { specId: envSpec, source: "env" };

  // 3. session.json
  const sessionSpec = readSession(relicDir).spec;
  if (sessionSpec) return { specId: sessionSpec, source: "session" };

  // 4. Git branch inference
  try {
    const branch = execSync("git branch --show-current", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    const inferred = inferSpecFromBranch(branch);
    if (inferred) return { specId: inferred, source: "git-branch" };
  } catch {
    // not a git repo or git not available
  }

  return null;
}

export async function runContext(options: ContextOptions): Promise<void> {
  const relicDir = options.relicDir ?? findRelicDir(process.cwd());
  if (!relicDir) {
    console.error("Error: not in a Relic project. Run: relic init");
    process.exit(1);
  }

  const resolved = resolveSpec(relicDir, options.spec);
  if (!resolved) {
    const specs = availableSpecs(join(relicDir, "specs"));
    console.error("Error: could not resolve spec. Use --spec <id>, set RELIC_SPEC, or run: relic use <spec-id>");
    if (specs.length > 0) console.error("Available specs: " + specs.join(", "));
    process.exit(1);
  }

  const { specId, source } = resolved;
  const currentFix = readSession(relicDir).fix ?? null;
  const specDir = join(relicDir, "specs", specId);

  if (!dirExists(specDir)) {
    console.error(`Error: spec directory not found for "${specId}".`);
    console.error(`Run: relic scaffold --spec ${specId}`);
    process.exit(1);
  }

  const artifactsPath = join(specDir, "artifacts.json");

  // Check shared artifacts if artifacts.json exists
  const sharedArtifacts: SharedArtifactRef[] = [];
  if (fileExists(artifactsPath)) {
    try {
      const art = readJson<ArtifactsJson>(artifactsPath);
      for (const p of art.owns) {
        sharedArtifacts.push({ path: p, role: "owns", exists: fileExists(join(relicDir, p)) });
      }
      for (const p of art.reads) {
        sharedArtifacts.push({ path: p, role: "reads", exists: fileExists(join(relicDir, p)) });
      }
    } catch {
      // malformed artifacts.json — skip artifact refs
    }
  }

  const result: ContextResult = {
    relic_dir: relicDir,
    spec_id: specId,
    active_spec_source: source,
    spec_dir: specDir,
    current_fix: currentFix,
    files: {
      preamble: fileExists(join(relicDir, "preamble.md")),
      constitution: fileExists(join(relicDir, "constitution.md")),
      spec: fileExists(join(specDir, "spec.md")),
      plan: fileExists(join(specDir, "plan.md")),
      tasks: fileExists(join(specDir, "tasks.md")),
      artifacts_json: fileExists(artifactsPath),
      changelog: fileExists(join(relicDir, "changelog.md")),
    },
    shared_artifacts: sharedArtifacts,
  };

  if (options.text) {
    console.log(`Spec:    ${specId}  (resolved from: ${source})`);
    console.log(`Fix:     ${currentFix ?? "(none)"}`);
    console.log(`Dir:     ${specDir}`);
    console.log(`Relic:   ${relicDir}`);
    console.log("");
    console.log("Files:");
    for (const [key, exists] of Object.entries(result.files)) {
      console.log(`  ${exists ? "✓" : "✗"} ${key}`);
    }
    if (sharedArtifacts.length > 0) {
      console.log("");
      console.log("Shared artifacts:");
      for (const a of sharedArtifacts) {
        console.log(`  [${a.role}] ${a.path}  ${a.exists ? "(exists)" : "(MISSING)"}`);
      }
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
