import { join } from "path";
import { ensureDir, writeText } from "@relic/utility";
import { ENGINE_TEMPLATES } from "../../generated/engine-templates.ts";

const PROMPT_NAMES = ["specify", "clarify", "plan", "analyse", "tasks", "implement", "fix", "solve", "use", "scan", "constitution"];

export function writeCopilot(projectDir: string): void {
  const promptsDir = join(projectDir, ".github", "prompts");
  ensureDir(promptsDir);

  const written: string[] = [];
  for (const name of PROMPT_NAMES) {
    const content = ENGINE_TEMPLATES[`prompts/${name}.md`];
    if (!content) continue;
    const frontmatter = `---\ndescription: Relic ${name} command\n---\n\n`;
    writeText(join(promptsDir, `relic.${name}.prompt.md`), frontmatter + content);
    written.push(`.github/prompts/relic.${name}.prompt.md`);
  }

  console.log("Added Copilot engine hooks:");
  for (const f of written) console.log(`  ${f}`);
  console.log("  (no permission config for Copilot)");
}
