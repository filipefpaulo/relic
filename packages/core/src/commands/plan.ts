import { join } from "path";
import { buildContext, renderContext } from "../core/context-builder.ts";
import { availableSpecs, dirExists, resolveSpec } from "@relic/utility";
import { runModel } from "../core/model-runner.ts";

export interface PlanOptions {
  relicDir: string;
  spec?: string;
  noStream?: boolean;
  resetContext?: boolean;
}

export async function runPlan(_options: PlanOptions): Promise<void> {
  console.log("relic plan — not yet implemented.");
  console.log("Use the /relic.plan prompt in your AI agent (.relic/prompts/plan.md).");
}
