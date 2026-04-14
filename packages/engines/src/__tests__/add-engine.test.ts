import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runAddEngine } from "../index.ts";
import { ENGINE_TEMPLATES } from "../generated/engine-templates.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-engines-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("ENGINE_TEMPLATES", () => {
  test("has entries for all 11 prompts/*.md keys", () => {
    const promptKeys = Object.keys(ENGINE_TEMPLATES).filter((k) =>
      k.startsWith("prompts/")
    );
    expect(promptKeys.length).toBe(11);
  });
});

describe("Claude engine", () => {
  test("writes 11 command files to .claude/commands/", async () => {
    await runAddEngine({ engine: "claude", projectDir: dir });
    const commandsDir = join(dir, ".claude", "commands");
    expect(existsSync(commandsDir)).toBe(true);
    const files = (await import("fs")).readdirSync(commandsDir);
    expect(files.length).toBe(11);
  });

  test("writes .claude/settings.json with Bash(relic *) allow rule", async () => {
    await runAddEngine({ engine: "claude", projectDir: dir });
    const settingsPath = join(dir, ".claude", "settings.json");
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(settings.permissions.allow).toContain("Bash(relic *)");
  });

  test("idempotency: calling twice keeps exactly one Bash(relic *) entry", async () => {
    await runAddEngine({ engine: "claude", projectDir: dir });
    await runAddEngine({ engine: "claude", projectDir: dir });
    const settings = JSON.parse(
      readFileSync(join(dir, ".claude", "settings.json"), "utf8")
    );
    const count = settings.permissions.allow.filter(
      (e: string) => e === "Bash(relic *)"
    ).length;
    expect(count).toBe(1);
  });
});

describe("Copilot engine", () => {
  test("writes one .github/prompts/relic.*.prompt.md per prompt", async () => {
    await runAddEngine({ engine: "copilot", projectDir: dir });
    const promptsDir = join(dir, ".github", "prompts");
    expect(existsSync(promptsDir)).toBe(true);
    const files = (await import("fs")).readdirSync(promptsDir);
    expect(files.length).toBe(11);
    expect(files.every((f: string) => f.startsWith("relic.") && f.endsWith(".prompt.md"))).toBe(true);
  });

  test("each file contains YAML frontmatter and prompt body", async () => {
    await runAddEngine({ engine: "copilot", projectDir: dir });
    const content = readFileSync(
      join(dir, ".github", "prompts", "relic.specify.prompt.md"),
      "utf8"
    );
    expect(content).toMatch(/^---\ndescription: Relic specify command\n---/);
  });

  test("does NOT write .github/copilot-instructions.md", async () => {
    await runAddEngine({ engine: "copilot", projectDir: dir });
    expect(existsSync(join(dir, ".github", "copilot-instructions.md"))).toBe(false);
  });
});

describe("Codex engine", () => {
  test("writes one .codex/commands/relic.*.md per prompt", async () => {
    await runAddEngine({ engine: "codex", projectDir: dir });
    const commandsDir = join(dir, ".codex", "commands");
    expect(existsSync(commandsDir)).toBe(true);
    const files = (await import("fs")).readdirSync(commandsDir);
    expect(files.length).toBe(11);
    expect(files.every((f: string) => f.startsWith("relic.") && f.endsWith(".md"))).toBe(true);
  });

  test("does NOT write .codex/instructions.md", async () => {
    await runAddEngine({ engine: "codex", projectDir: dir });
    expect(existsSync(join(dir, ".codex", "instructions.md"))).toBe(false);
  });

  test("writes .codex/config.toml with [\"relic\"] pattern", async () => {
    await runAddEngine({ engine: "codex", projectDir: dir });
    const configPath = join(dir, ".codex", "config.toml");
    expect(existsSync(configPath)).toBe(true);
    expect(readFileSync(configPath, "utf8")).toContain('["relic"]');
  });

  test("idempotency: calling twice keeps exactly one [\"relic\"] occurrence", async () => {
    await runAddEngine({ engine: "codex", projectDir: dir });
    await runAddEngine({ engine: "codex", projectDir: dir });
    const content = readFileSync(
      join(dir, ".codex", "config.toml"),
      "utf8"
    );
    const occurrences = content.split('["relic"]').length - 1;
    expect(occurrences).toBe(1);
  });
});
