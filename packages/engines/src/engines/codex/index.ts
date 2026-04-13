import { join } from "path";
import { ensureDir, writeText, fileExists, readText } from "@relic/utility";
import { ENGINE_TEMPLATES } from "../../generated/engine-templates.ts";

const PROMPT_NAMES = ["specify", "clarify", "plan", "analyse", "tasks", "implement", "fix", "use", "scan", "constitution"];

const CODEX_CONFIG_BLOCK = `[rules]
prefix_rules = [
  { pattern = ["relic"], decision = "allow" }
]
`;

export function writeCodex(projectDir: string): void {
  const codexDir = join(projectDir, ".codex");
  ensureDir(codexDir);

  const sections = PROMPT_NAMES
    .map((name) => {
      const content = ENGINE_TEMPLATES[`prompts/${name}.md`];
      if (!content) return null;
      const heading = name.charAt(0).toUpperCase() + name.slice(1);
      return `## ${heading}\n\n${content}`;
    })
    .filter((s): s is string => s !== null);

  writeText(join(codexDir, "instructions.md"), sections.join("\n\n---\n\n"));

  const configPath = join(codexDir, "config.toml");
  const alreadyConfigured =
    fileExists(configPath) && readText(configPath).includes('["relic"]');
  if (!alreadyConfigured) {
    writeText(configPath, CODEX_CONFIG_BLOCK);
  }

  console.log("Added Codex engine hooks:");
  console.log("  .codex/instructions.md");
  console.log("  .codex/config.toml  (relic prefix_rules allow)");
}
