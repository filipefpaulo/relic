import { join } from "path";
import { buildContext, renderContext } from "../core/context-builder.ts";
import { availableSpecs, dirExists, fileExists, resolveSpec } from "@relic/utility";
import { runModel } from "../core/model-runner.ts";

export interface FixOptions {
  spec?: string;
  issue?: string;
  relicDir: string;
  noStream?: boolean;
  resetContext?: boolean;
}

export async function runFix(options: FixOptions): Promise<void> {
  const { relicDir } = options;
  const specsDir = join(relicDir, "specs");

  const specId = resolveSpec(options.spec, relicDir);

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

  const ctx = buildContext(relicDir, specId);
  const rendered = renderContext(ctx);

  const userMessage = options.issue
    ? rendered + "\n\n---\n\n# Issue\n\n" + options.issue
    : rendered;

  // If models.json exists, call the model; otherwise print context (legacy behaviour)
  const modelsJsonPath = join(relicDir, "models.json");
  if (fileExists(modelsJsonPath)) {
    await runModel({
      command: "fix",
      userMessage,
      relicDir,
      specId,
      noStream: options.noStream,
      resetContext: options.resetContext,
    });
  } else {
    console.log(rendered);
    if (options.issue) {
      console.log("\n---\n\n# Issue\n\n" + options.issue);
    }
  }
}
