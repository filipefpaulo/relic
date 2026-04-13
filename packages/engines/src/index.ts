import { writeClaude } from "./engines/claude/index.ts";
import { writeCopilot } from "./engines/copilot/index.ts";
import { writeCodex } from "./engines/codex/index.ts";

export type Engine = "claude" | "copilot" | "codex";

export const SUPPORTED_ENGINES: Engine[] = ["claude", "copilot", "codex"];

export interface AddEngineOptions {
  engine: Engine;
  projectDir: string;
}

export async function runAddEngine(options: AddEngineOptions): Promise<void> {
  const { engine, projectDir } = options;

  switch (engine) {
    case "claude":
      writeClaude(projectDir);
      break;
    case "copilot":
      writeCopilot(projectDir);
      break;
    case "codex":
      writeCodex(projectDir);
      break;
    default: {
      const _exhaustive: never = engine;
      console.error(`Unknown engine: ${engine}. Supported: ${SUPPORTED_ENGINES.join(", ")}`);
      process.exit(1);
    }
  }
}
