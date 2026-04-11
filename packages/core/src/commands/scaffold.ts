import { execSync } from "child_process";
import { join } from "path";
import {
  findRelicDir,
  fileExists,
  dirExists,
  ensureDir,
  readText,
  writeText,
  writeJson,
} from "../utils/fs.ts";
import {
  nextSpecId,
  slugify,
  inferSpecFromBranch,
  availableSpecs,
} from "../utils/spec-id.ts";
import { TEMPLATES } from "../generated/templates.ts";

export interface ScaffoldOptions {
  title?: string;
  spec?: string;
  relicDir?: string;
}

interface ScaffoldResult {
  spec_id: string;
  spec_dir: string;
  title: string;
  date: string;
  was_new: boolean;
  current_spec_updated: boolean;
  files_created: string[];
}

function resolveExistingSpec(relicDir: string, specArg?: string): string | null {
  if (specArg) return specArg;
  const envSpec = process.env["RELIC_SPEC"];
  if (envSpec) return envSpec;
  const currentSpecPath = join(relicDir, "current-spec");
  if (fileExists(currentSpecPath)) {
    const id = readText(currentSpecPath).trim();
    if (id) return id;
  }
  try {
    const branch = execSync("git branch --show-current", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    const inferred = inferSpecFromBranch(branch);
    if (inferred) return inferred;
  } catch {
    // not a git repo
  }
  return null;
}

function applyTemplate(template: string, specId: string, title: string, date: string): string {
  return template
    .replace(/\{\{SPEC_ID\}\}/g, specId)
    .replace(/\{\{TITLE\}\}/g, title)
    .replace(/\{\{DATE\}\}/g, date);
}

export async function runScaffold(options: ScaffoldOptions): Promise<void> {
  const relicDir = options.relicDir ?? findRelicDir(process.cwd());
  if (!relicDir) {
    console.error("Error: not in a Relic project. Run: relic init");
    process.exit(1);
  }

  const specsDir = join(relicDir, "specs");
  const date = new Date().toISOString().slice(0, 10);
  const filesCreated: string[] = [];

  let specId: string;
  let title: string;
  let wasNew: boolean;

  if (options.title) {
    // New spec mode — generate ID from title
    const slug = slugify(options.title);
    specId = nextSpecId(specsDir, slug);
    title = options.title;
    wasNew = true;
  } else {
    // Existing spec mode — resolve ID
    const resolved = resolveExistingSpec(relicDir, options.spec);
    if (!resolved) {
      const specs = availableSpecs(specsDir);
      console.error("Error: could not resolve spec. Use --title <title> for new specs or --spec <id> for existing ones.");
      if (specs.length > 0) console.error("Available specs: " + specs.join(", "));
      process.exit(1);
    }
    specId = resolved;
    wasNew = !dirExists(join(specsDir, specId));
    // Derive title from spec ID (NNN-slug → Title Case)
    title = specId.slice(4).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const specDir = join(specsDir, specId);
  ensureDir(specDir);

  // Create spec files from templates (only if missing)
  const specFiles: Array<{ file: string; templateKey: string }> = [
    { file: "spec.md", templateKey: "spec.md" },
    { file: "plan.md", templateKey: "plan.md" },
    { file: "tasks.md", templateKey: "tasks.md" },
  ];

  for (const { file, templateKey } of specFiles) {
    const dest = join(specDir, file);
    if (!fileExists(dest)) {
      const raw = TEMPLATES[templateKey] ?? `# ${file}\n`;
      writeText(dest, applyTemplate(raw, specId, title, date));
      filesCreated.push(file);
    }
  }

  // Create empty artifacts.json if missing
  const artifactsPath = join(specDir, "artifacts.json");
  if (!fileExists(artifactsPath)) {
    writeJson(artifactsPath, { owns: [], reads: [], touches_files: [] });
    filesCreated.push("artifacts.json");
  }

  // Update current-spec
  writeText(join(relicDir, "current-spec"), specId + "\n");

  const result: ScaffoldResult = {
    spec_id: specId,
    spec_dir: specDir,
    title,
    date,
    was_new: wasNew,
    current_spec_updated: true,
    files_created: filesCreated,
  };

  console.log(JSON.stringify(result, null, 2));
}
