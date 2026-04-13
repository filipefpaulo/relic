import { join } from "path";
import { execSync } from "child_process";
import { buildContext, renderContext } from "../core/context-builder.ts";
import { inferSpecFromBranch, availableSpecs } from "@relic/utility";
import { dirExists, readSession } from "@relic/utility";

export interface FixOptions {
  spec?: string;
  issue?: string;
  relicDir: string;
}

export async function runFix(options: FixOptions): Promise<void> {
  let specId = options.spec ?? process.env["RELIC_SPEC"];

  if (!specId) {
    specId = readSession(options.relicDir).spec ?? undefined;
  }

  if (!specId) {
    try {
      const branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
      specId = inferSpecFromBranch(branch) ?? undefined;
    } catch {
      // not in a git repo or git not available
    }
  }

  const specsDir = join(options.relicDir, "specs");

  if (!specId) {
    const available = availableSpecs(specsDir);
    console.error("Could not infer spec from branch. Available specs:");
    for (const s of available) console.error(`  ${s}`);
    console.error("\nUse: relic fix --spec <spec-id>");
    console.error("Or set RELIC_SPEC=<spec-id> in your environment.");
    process.exit(1);
  }

  const specDir = join(specsDir, specId);
  if (!dirExists(specDir)) {
    console.error(`Spec not found: ${specId}`);
    console.error(`Expected: .relic/specs/${specId}/`);
    process.exit(1);
  }

  const ctx = buildContext(options.relicDir, specId);
  const rendered = renderContext(ctx);

  console.log(rendered);

  if (options.issue) {
    console.log("\n---\n\n# Issue\n\n" + options.issue);
  }
}
