import { join } from "path";
import { dirExists, ensureDir, writeText } from "@relic/utility";
import { TEMPLATES } from "../generated/templates.ts";
import { runAddEngine, type Engine } from "@relic/engines";

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
  ];
  for (const d of dirs) ensureDir(d);

  writeText(join(relicDir, ".gitignore"), "current-spec\n");
  writeText(join(relicDir, "preamble.md"), TEMPLATES["preamble.md"] ?? "");
  writeText(join(relicDir, "constitution.md"), TEMPLATES["constitution.md"] ?? "");
  writeText(
    join(relicDir, "changelog.md"),
    "# Relic Changelog\n\n*All plan mutations and fix events are recorded here.*\n"
  );

  console.log("Relic initialised.");
  console.log("");
  console.log("Created:");
  console.log("  .relic/preamble.md     (Relic architectural invariants — do not edit)");
  console.log("  .relic/constitution.md");
  console.log("  .relic/changelog.md");
  console.log("  .relic/shared/  (domains/, contracts/, rules/, assumptions/)");
  console.log("  .relic/specs/");
  console.log("  .relic/.gitignore  (ignores current-spec — personal session state)");
  console.log("");

  // Write engine-specific hook files
  for (const engine of options.engines) {
    await runAddEngine({ engine, projectDir: options.dir });
  }

  console.log("");
  console.log("Next steps — open your AI agent and run:");
  console.log("");
  console.log("  Existing codebase:  /relic.scan  then  /relic.constitution");
  console.log("  New project:        /relic.constitution  then  /relic.specify");
}
