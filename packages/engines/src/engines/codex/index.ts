import { join } from "path";
import { ensureDir, writeText, fileExists, readText } from "@relic/utility";
import { ENGINE_TEMPLATES } from "../../generated/engine-templates.ts";

const PROMPT_NAMES = ["specify", "clarify", "plan", "analyse", "tasks", "implement", "fix", "solve", "use", "scan", "constitution"];

const CODEX_CONFIG_BLOCK = `[rules]
prefix_rules = [
  { pattern = ["relic"], decision = "allow" }
]
`;

export function writeCodex(projectDir: string): void {
  const commandsDir = join(projectDir, ".codex", "commands");
  ensureDir(commandsDir);

  const written: string[] = [];
  for (const name of PROMPT_NAMES) {
    const content = ENGINE_TEMPLATES[`prompts/${name}.md`];
    if (!content) continue;
    writeText(join(commandsDir, `relic.${name}.md`), content);
    written.push(`.codex/commands/relic.${name}.md`);
  }

  const configPath = join(projectDir, ".codex", "config.toml");
  const alreadyConfigured =
    fileExists(configPath) && readText(configPath).includes('["relic"]');
  if (!alreadyConfigured) {
    writeText(configPath, CODEX_CONFIG_BLOCK);
  }

  console.log("Added Codex engine hooks:");
  for (const f of written) console.log(`  ${f}`);
  console.log("  .codex/config.toml  (relic prefix_rules allow)");
}
