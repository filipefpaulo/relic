import { join } from "path";
import { readdirSync, statSync } from "fs";
import { fileExists, dirExists } from "../utils/fs.ts";

export interface ScanOptions {
  projectDir: string;
  relicDir: string;
  json: boolean;
}

interface KeyFile {
  path: string;
  role: string;
}

interface Manifest {
  project_dir: string;
  relic_dir: string;
  tech_stack: string[];
  key_files: KeyFile[];
  file_tree: string;
  existing_artifacts: {
    domains: string[];
    contracts: string[];
    rules: string[];
    assumptions: string[];
  };
  stats: {
    total_files: number;
    excluded: string[];
  };
}

const EXCLUDED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", "__pycache__",
  ".next", ".nuxt", "coverage", ".turbo", ".cache", "vendor",
]);

const EXCLUDED_FILES = new Set([
  "package-lock.json", "yarn.lock", "bun.lockb", "pnpm-lock.yaml",
  ".DS_Store", "Thumbs.db",
]);

const STACK_MARKERS: Array<{ file: string; stack: string }> = [
  { file: "package.json", stack: "node" },
  { file: "tsconfig.json", stack: "typescript" },
  { file: "pyproject.toml", stack: "python" },
  { file: "setup.py", stack: "python" },
  { file: "go.mod", stack: "go" },
  { file: "Cargo.toml", stack: "rust" },
  { file: "pom.xml", stack: "java" },
  { file: "build.gradle", stack: "java" },
  { file: "Gemfile", stack: "ruby" },
  { file: "schema.graphql", stack: "graphql" },
];

const STACK_GLOB_MARKERS: Array<{ pattern: RegExp; stack: string }> = [
  { pattern: /^next\.config\.(js|ts|mjs)$/, stack: "nextjs" },
  { pattern: /^vite\.config\.(js|ts)$/, stack: "vite" },
  { pattern: /^openapi\.(yaml|yml|json)$/, stack: "openapi" },
  { pattern: /^swagger\.(yaml|yml|json)$/, stack: "openapi" },
  { pattern: /^Dockerfile$/, stack: "docker" },
];

const KEY_FILE_ROLES: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /^(main|index|app|server|entry)\.(ts|js|py|go|rs|rb)$/, role: "entry_point" },
  { pattern: /^(main|app)\.(py)$/, role: "entry_point" },
  { pattern: /types?\.(ts|d\.ts)$/, role: "types" },
  { pattern: /interfaces?\.(ts)$/, role: "types" },
  { pattern: /\.graphql$/, role: "schema" },
  { pattern: /^openapi\.(yaml|yml|json)$/, role: "schema" },
  { pattern: /^swagger\.(yaml|yml|json)$/, role: "schema" },
  { pattern: /\.env\.example$/, role: "config" },
  { pattern: /^config\.(ts|js|json|yaml)$/, role: "config" },
];

const KEY_DIR_ROLES: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /^(routes?|pages?|api|controllers?)$/i, role: "routes" },
  { pattern: /^(middleware|middlewares)$/i, role: "middleware" },
  { pattern: /^(migrations?|db|database)$/i, role: "migrations" },
  { pattern: /^(models?|entities|domain)$/i, role: "domain" },
  { pattern: /^(services?|usecases?|use-cases?)$/i, role: "services" },
];

function detectStack(projectDir: string): string[] {
  const stack: string[] = [];

  for (const { file, stack: s } of STACK_MARKERS) {
    if (fileExists(join(projectDir, file)) && !stack.includes(s)) {
      stack.push(s);
    }
  }

  // Check top-level files against glob patterns
  try {
    const entries = readdirSync(projectDir);
    for (const entry of entries) {
      for (const { pattern, stack: s } of STACK_GLOB_MARKERS) {
        if (pattern.test(entry) && !stack.includes(s)) {
          stack.push(s);
        }
      }
    }
  } catch {}

  return stack;
}

function findKeyFiles(projectDir: string): KeyFile[] {
  const results: KeyFile[] = [];
  const seen = new Set<string>();

  function walk(dir: string, depth: number): void {
    if (depth > 3) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (EXCLUDED_FILES.has(entry)) continue;
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }

      const rel = full.slice(projectDir.length + 1);

      if (stat.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry)) continue;
        // Check dir role
        for (const { pattern, role } of KEY_DIR_ROLES) {
          if (pattern.test(entry) && !seen.has(rel)) {
            seen.add(rel);
            results.push({ path: rel + "/", role });
          }
        }
        walk(full, depth + 1);
      } else {
        for (const { pattern, role } of KEY_FILE_ROLES) {
          if (pattern.test(entry) && !seen.has(rel)) {
            seen.add(rel);
            results.push({ path: rel, role });
          }
        }
      }
    }
  }

  walk(projectDir, 0);
  return results;
}

function buildFileTree(projectDir: string): { tree: string; totalFiles: number } {
  const lines: string[] = [];
  let totalFiles = 0;
  const MAX_ENTRIES = 200;

  function walk(dir: string, prefix: string, depth: number): void {
    if (depth > 4 || lines.length >= MAX_ENTRIES) return;
    let entries: string[];
    try {
      entries = readdirSync(dir).filter((e) => !EXCLUDED_FILES.has(e));
    } catch {
      return;
    }

    const dirs = entries.filter((e) => {
      try { return statSync(join(dir, e)).isDirectory(); } catch { return false; }
    });
    const files = entries.filter((e) => {
      try { return statSync(join(dir, e)).isFile(); } catch { return false; }
    });

    for (const d of dirs) {
      if (EXCLUDED_DIRS.has(d)) continue;
      if (lines.length >= MAX_ENTRIES) { lines.push(`${prefix}... (truncated)`); return; }
      lines.push(`${prefix}${d}/`);
      walk(join(dir, d), prefix + "  ", depth + 1);
    }

    for (const f of files) {
      totalFiles++;
      if (lines.length >= MAX_ENTRIES) { lines.push(`${prefix}... (truncated)`); return; }
      lines.push(`${prefix}${f}`);
    }
  }

  walk(projectDir, "", 0);
  return { tree: lines.join("\n"), totalFiles };
}

function listArtifacts(relicDir: string, subdir: string): string[] {
  const dir = join(relicDir, "shared", subdir);
  if (!dirExists(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => `shared/${subdir}/${f}`);
  } catch {
    return [];
  }
}

export async function runScan(options: ScanOptions): Promise<void> {
  const { projectDir, relicDir, json } = options;

  const techStack = detectStack(projectDir);
  const keyFiles = findKeyFiles(projectDir);
  const { tree, totalFiles } = buildFileTree(projectDir);

  const existingArtifacts = {
    domains: listArtifacts(relicDir, "domains"),
    contracts: listArtifacts(relicDir, "contracts"),
    rules: listArtifacts(relicDir, "rules"),
    assumptions: listArtifacts(relicDir, "assumptions"),
  };

  const manifest: Manifest = {
    project_dir: projectDir,
    relic_dir: relicDir,
    tech_stack: techStack,
    key_files: keyFiles,
    file_tree: tree,
    existing_artifacts: existingArtifacts,
    stats: {
      total_files: totalFiles,
      excluded: Array.from(EXCLUDED_DIRS),
    },
  };

  if (json) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  // Human-readable output
  console.log(`Project:      ${projectDir}`);
  console.log(`Tech stack:   ${techStack.length > 0 ? techStack.join(", ") : "(none detected)"}`);
  console.log("");

  if (keyFiles.length > 0) {
    console.log("Key files:");
    for (const f of keyFiles) {
      console.log(`  [${f.role}] ${f.path}`);
    }
    console.log("");
  }

  const totalArtifacts =
    existingArtifacts.domains.length +
    existingArtifacts.contracts.length +
    existingArtifacts.rules.length +
    existingArtifacts.assumptions.length;

  console.log(`Existing artifacts: ${totalArtifacts}`);
  if (totalArtifacts > 0) {
    for (const [type, list] of Object.entries(existingArtifacts)) {
      for (const a of list) console.log(`  [${type}] ${a}`);
    }
    console.log("");
  }

  console.log(`File tree (${totalFiles} files):`);
  console.log(tree);
  console.log("");
  console.log("Next step: run /relic.scan inside your AI agent to generate shared artifacts.");
}
