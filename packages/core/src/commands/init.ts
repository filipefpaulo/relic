import { join } from "path";
import { dirExists, ensureDir, writeText, writeJson, writeEnginesRegistry } from "@relic/utility";
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
    join(relicDir, "fixes"),
  ];
  for (const d of dirs) ensureDir(d);

  // Write empty toon index files for each index space
  const TOON_INIT_FILES: Array<[string, string]> = [
    ["shared/domains/manifest.toon", "# domains manifest\n"],
    ["shared/contracts/manifest.toon", "# contracts manifest\n"],
    ["shared/rules/manifest.toon", "# rules manifest\n"],
    ["shared/assumptions/manifest.toon", "# assumptions manifest\n"],
    ["specs/manifest.toon", "# specs index\n"],
    ["fixes/manifest.toon", "# fixes index\n"],
  ];
  for (const [rel, content] of TOON_INIT_FILES) {
    writeText(join(relicDir, rel), content);
  }

  writeJson(join(relicDir, "session.json"), { spec: null, fix: null });
  writeText(join(relicDir, ".gitignore"), "session.json\nmodels.json\nspecs/**/history.json\n");
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
  console.log("  .relic/fixes/");
  console.log("  .relic/shared/domains/manifest.toon");
  console.log("  .relic/shared/contracts/manifest.toon");
  console.log("  .relic/shared/rules/manifest.toon");
  console.log("  .relic/shared/assumptions/manifest.toon");
  console.log("  .relic/specs/manifest.toon");
  console.log("  .relic/fixes/manifest.toon");
  console.log("  .relic/session.json  (gitignored — personal session state)");
  console.log("  .relic/.gitignore  (ignores session.json — personal session state)");
  console.log("");

  // Write engine-specific hook files
  for (const engine of options.engines) {
    await runAddEngine({ engine, projectDir: options.dir });
  }

  if (options.engines.length > 0) {
    writeEnginesRegistry(relicDir, options.engines.map(String));
    console.log(`  .relic/engines.json  (registered engines: ${options.engines.join(", ")})`);
  }

  console.log("");
  console.log("Next steps — open your AI agent and run:");
  console.log("");
  console.log("  Existing codebase:  /relic.scan  then  /relic.constitution");
  console.log("  New project:        /relic.constitution  then  /relic.specify");
}
