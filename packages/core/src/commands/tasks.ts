import { join } from "path";
import { buildContext, renderContext } from "../core/context-builder.ts";
import { availableSpecs, dirExists, resolveSpec } from "@relic/utility";
import { runModel } from "../core/model-runner.ts";

export interface TasksOptions {
  relicDir: string;
  spec?: string;
  noStream?: boolean;
  resetContext?: boolean;
}

export async function runTasks(_options: TasksOptions): Promise<void> {
  console.log("relic tasks — not yet implemented.");
  console.log("Use the /relic.tasks prompt in your AI agent (.relic/prompts/tasks.md).");
}
