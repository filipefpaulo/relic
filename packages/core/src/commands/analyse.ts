import { join } from "path";
import { buildContext, renderContext } from "../core/context-builder.ts";
import { availableSpecs, dirExists, resolveSpec } from "@relic/utility";
import { runModel } from "../core/model-runner.ts";

export interface AnalyseOptions {
  relicDir: string;
  spec?: string;
  noStream?: boolean;
  resetContext?: boolean;
}

export async function runAnalyse(options: AnalyseOptions): Promise<void> {
  const { relicDir } = options;
  const specsDir = join(relicDir, "specs");

  const specId = resolveSpec(options.spec, relicDir);

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
