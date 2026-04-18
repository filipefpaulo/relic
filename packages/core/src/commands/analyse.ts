import { join } from "path";
import { execSync } from "child_process";
import { buildContext, renderContext } from "../core/context-builder.ts";
import { inferSpecFromBranch, availableSpecs, dirExists, readSession } from "@relic/utility";
import { runModel } from "../core/model-runner.ts";

export interface AnalyseOptions {
  relicDir: string;
  spec?: string;
  noStream?: boolean;
  resetContext?: boolean;
}

export async function runAnalyse(options: AnalyseOptions): Promise<void> {
  const { relicDir } = options;

  let specId = options.spec ?? process.env["RELIC_SPEC"];

  if (!specId) {
    specId = readSession(relicDir).spec ?? undefined;
  }

  if (!specId) {
    try {
      const branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
      specId = inferSpecFromBranch(branch) ?? undefined;
    } catch {
      // not in a git repo or git not available
    }
  }

  const specsDir = join(relicDir, "specs");

  if (!specId) {
    const available = availableSpecs(specsDir);
    console.error("Could not infer spec. Available specs:");
    for (const s of available) console.error(`  ${s}`);
    console.error("\nUse: relic analyse --spec <spec-id>");
    process.exit(1);
  }

  if (!dirExists(join(specsDir, specId))) {
    console.error(`Spec not found: ${specId}`);
    process.exit(1);
  }

  const ctx = buildContext(relicDir, specId);
  const renderedContext = renderContext(ctx);

  await runModel({
    command: "analyse",
    userMessage: renderedContext,
    relicDir,
    specId,
    noStream: options.noStream,
    resetContext: options.resetContext,
  });
}
