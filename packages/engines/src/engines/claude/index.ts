import { join } from "path";
import { ensureDir, writeText, fileExists, readJson, writeJson } from "@relic/utility";
import { ENGINE_TEMPLATES } from "../../generated/engine-templates.ts";

const PROMPT_NAMES = ["specify", "clarify", "plan", "analyse", "tasks", "implement", "fix", "use", "scan", "constitution"];

export function writeClaude(projectDir: string): void {
  const commandsDir = join(projectDir, ".claude", "commands");
  ensureDir(commandsDir);

  for (const name of PROMPT_NAMES) {
    const content = ENGINE_TEMPLATES[`prompts/${name}.md`];
    if (!content) continue;
    writeText(join(commandsDir, `relic.${name}.md`), content);
  }

  const settingsPath = join(projectDir, ".claude", "settings.json");
  type ClaudeSettings = { permissions?: { allow?: string[] } };
  const settings: ClaudeSettings = fileExists(settingsPath)
    ? readJson<ClaudeSettings>(settingsPath)
    : {};
  settings.permissions ??= {};
  settings.permissions.allow ??= [];
  if (!settings.permissions.allow.includes("Bash(relic *)")) {
    settings.permissions.allow.push("Bash(relic *)");
  }
  writeJson(settingsPath, settings);

  console.log("Added Claude engine hooks:");
  console.log(`  .claude/commands/relic.*.md  (${PROMPT_NAMES.length} slash commands)`);
  console.log("  .claude/settings.json  (Bash(relic *) allow rule)");
  console.log("  Usage inside Claude Code: /relic.specify, /relic.plan, /relic.fix, ...");
}
