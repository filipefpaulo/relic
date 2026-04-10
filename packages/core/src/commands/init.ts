import { join } from "path";
import { dirExists, ensureDir, writeText, makeExecutable } from "../utils/fs.ts";
import { TEMPLATES } from "../generated/templates.ts";
import { runAddEngine, type Engine } from "./add-engine.ts";

export interface InitOptions {
  dir: string;
  force: boolean;
  engines: Engine[];
}

export async function runInit(options: InitOptions): Promise<void> {
  const relicDir = join(options.dir, ".relic");

  if (dirExists(relicDir) && !options.force) {
    console.error(`Error: .relic/ already exists in ${options.dir}`);
    console.error("Use --force to reinitialise.");
    process.exit(1);
  }

  const dirs = [
    relicDir,
    join(relicDir, "shared", "domains"),
    join(relicDir, "shared", "contracts"),
    join(relicDir, "shared", "rules"),
    join(relicDir, "shared", "assumptions"),
    join(relicDir, "specs"),
    join(relicDir, "prompts"),
    join(relicDir, "scripts"),
    join(relicDir, "templates"),
  ];
  for (const d of dirs) ensureDir(d);

  writeText(join(relicDir, "preamble.md"), TEMPLATES["preamble.md"] ?? "");
  writeText(join(relicDir, "constitution.md"), TEMPLATES["constitution.md"] ?? "");
  writeText(
    join(relicDir, "changelog.md"),
    "# Relic Changelog\n\n*All plan mutations and fix events are recorded here.*\n"
  );

  // Write all prompt files
  for (const [key, content] of Object.entries(TEMPLATES)) {
    if (key.startsWith("prompts/")) {
      const dest = join(relicDir, key);
      writeText(dest, content);
    }
  }

  // Write spec scaffolding templates (used by scaffold-spec.sh for sed substitution)
  for (const fname of ["spec.md", "plan.md", "tasks.md"]) {
    writeText(join(relicDir, "templates", fname), TEMPLATES[fname] ?? "");
  }

  // Write and chmod all bash scripts
  for (const [key, content] of Object.entries(TEMPLATES)) {
    if (key.startsWith("scripts/") && key.endsWith(".sh")) {
      const dest = join(relicDir, key);
      writeText(dest, content);
      makeExecutable(dest);
    }
  }

  console.log("Relic initialised.");
  console.log("");
  console.log("Created:");
  console.log("  .relic/preamble.md     (Relic architectural invariants — do not edit)");
  console.log("  .relic/constitution.md");
  console.log("  .relic/changelog.md");
  console.log("  .relic/shared/  (domains/, contracts/, rules/, assumptions/)");
  console.log("  .relic/specs/");
  console.log("  .relic/prompts/  (AI slash command prompts)");
  console.log("  .relic/scripts/  (bash utilities: check-context, scaffold-spec, validate-artifacts)");
  console.log("  .relic/templates/  (spec scaffolding templates for scaffold-spec.sh)");
  console.log("");

  // Write engine-specific hook files
  for (const engine of options.engines) {
    await runAddEngine({ engine, projectDir: options.dir });
  }

  console.log("");
  console.log("Next step: relic specify");
}
