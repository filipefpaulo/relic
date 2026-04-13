import { join } from "path";
import { ensureDir, writeText } from "@relic/utility";
import { ENGINE_TEMPLATES } from "../../generated/engine-templates.ts";

const PROMPT_NAMES = ["specify", "clarify", "plan", "analyse", "tasks", "implement", "fix", "use", "scan", "constitution"];

export function writeCopilot(projectDir: string): void {
  const githubDir = join(projectDir, ".github");
  ensureDir(githubDir);

  const sections = PROMPT_NAMES
    .map((name) => {
      const content = ENGINE_TEMPLATES[`prompts/${name}.md`];
      if (!content) return null;
      const heading = name.charAt(0).toUpperCase() + name.slice(1);
      return `## ${heading}\n\n${content}`;
    })
    .filter((s): s is string => s !== null);

  writeText(join(githubDir, "copilot-instructions.md"), sections.join("\n\n---\n\n"));

  console.log("Added Copilot engine hooks:");
  console.log("  .github/copilot-instructions.md");
  console.log("  (no permission config for Copilot)");
}
