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
  test("has entries for all 10 prompts/*.md keys", () => {
    const promptKeys = Object.keys(ENGINE_TEMPLATES).filter((k) =>
      k.startsWith("prompts/")
    );
    expect(promptKeys.length).toBe(10);
  });
});

describe("Claude engine", () => {
  test("writes 10 command files to .claude/commands/", async () => {
    await runAddEngine({ engine: "claude", projectDir: dir });
    const commandsDir = join(dir, ".claude", "commands");
    expect(existsSync(commandsDir)).toBe(true);
    const files = (await import("fs")).readdirSync(commandsDir);
    expect(files.length).toBe(10);
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
  test("writes .github/copilot-instructions.md", async () => {
    await runAddEngine({ engine: "copilot", projectDir: dir });
    expect(existsSync(join(dir, ".github", "copilot-instructions.md"))).toBe(true);
  });

  test("content includes at least one prompt section header", async () => {
    await runAddEngine({ engine: "copilot", projectDir: dir });
    const content = readFileSync(
      join(dir, ".github", "copilot-instructions.md"),
      "utf8"
    );
    expect(content).toMatch(/^## \w+/m);
  });
});

describe("Codex engine", () => {
  test("writes .codex/instructions.md", async () => {
    await runAddEngine({ engine: "codex", projectDir: dir });
    expect(existsSync(join(dir, ".codex", "instructions.md"))).toBe(true);
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
