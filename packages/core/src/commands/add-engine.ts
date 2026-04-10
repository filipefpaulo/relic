import { join } from "path";
import { ensureDir, writeText } from "../utils/fs.ts";
import { TEMPLATES } from "../generated/templates.ts";

export type Engine = "claude" | "copilot" | "codex";

export const SUPPORTED_ENGINES: Engine[] = ["claude", "copilot", "codex"];

export interface AddEngineOptions {
  engine: Engine;
  projectDir: string;
}

const PROMPT_NAMES = ["specify", "clarify", "plan", "analyse", "tasks", "implement", "fix", "use", "scan"];

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

function writeClaude(projectDir: string): void {
  const commandsDir = join(projectDir, ".claude", "commands");
  ensureDir(commandsDir);

  for (const name of PROMPT_NAMES) {
    const content = TEMPLATES[`prompts/${name}.md`];
    if (!content) continue;
    writeText(join(commandsDir, `relic.${name}.md`), content);
  }

  console.log("Added Claude engine hooks:");
  console.log(`  .claude/commands/relic.*.md  (${PROMPT_NAMES.length} slash commands)`);
  console.log("  Usage inside Claude Code: /relic.specify, /relic.plan, /relic.fix, ...");
}

function writeCopilot(projectDir: string): void {
  const githubDir = join(projectDir, ".github");
  ensureDir(githubDir);

  const content = TEMPLATES["engines/copilot/copilot-instructions.md"];
  if (!content) {
    console.error("Copilot template missing — try reinstalling Relic.");
    process.exit(1);
  }
  writeText(join(githubDir, "copilot-instructions.md"), content);

  console.log("Added Copilot engine hooks:");
  console.log("  .github/copilot-instructions.md");
}

function writeCodex(projectDir: string): void {
  const codexDir = join(projectDir, ".codex");
  ensureDir(codexDir);

  const content = TEMPLATES["engines/codex/instructions.md"];
  if (!content) {
    console.error("Codex template missing — try reinstalling Relic.");
    process.exit(1);
  }
  writeText(join(codexDir, "instructions.md"), content);

  console.log("Added Codex engine hooks:");
  console.log("  .codex/instructions.md");
}
