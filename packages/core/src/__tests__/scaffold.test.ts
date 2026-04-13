import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runScaffold } from "../commands/scaffold.ts";

let dir: string;
let relicDir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-test-"));
  relicDir = join(dir, ".relic");
  mkdirSync(join(relicDir, "specs"), { recursive: true });
  // Write minimal preamble so TEMPLATES-based writes work
  writeFileSync(join(relicDir, "preamble.md"), "");
  writeFileSync(join(relicDir, "constitution.md"), "");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runScaffold --title", () => {
  test("creates spec dir with correct 001-slug ID", async () => {
    await runScaffold({ title: "User Auth", relicDir });
    expect(existsSync(join(relicDir, "specs", "001-user-auth"))).toBe(true);
  });

  test("creates spec.md, plan.md, tasks.md, and artifacts.json", async () => {
    await runScaffold({ title: "User Auth", relicDir });
    const specDir = join(relicDir, "specs", "001-user-auth");
    expect(existsSync(join(specDir, "spec.md"))).toBe(true);
    expect(existsSync(join(specDir, "plan.md"))).toBe(true);
    expect(existsSync(join(specDir, "tasks.md"))).toBe(true);
    expect(existsSync(join(specDir, "artifacts.json"))).toBe(true);
  });

  test("writes spec ID to current-spec", async () => {
    await runScaffold({ title: "User Auth", relicDir });
    const content = readFileSync(join(relicDir, "current-spec"), "utf8").trim();
    expect(content).toBe("001-user-auth");
  });

  test("second call with different title increments to 002-slug", async () => {
    await runScaffold({ title: "User Auth", relicDir });
    await runScaffold({ title: "Payments", relicDir });
    expect(existsSync(join(relicDir, "specs", "002-payments"))).toBe(true);
  });

  test("output is valid JSON matching ScaffoldResult shape", async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (msg: string) => logs.push(msg);
    await runScaffold({ title: "User Auth", relicDir });
    console.log = orig;

    const result = JSON.parse(logs.join(""));
    expect(result.spec_id).toBe("001-user-auth");
    expect(result.was_new).toBe(true);
    expect(result.current_spec_updated).toBe(true);
    expect(Array.isArray(result.files_created)).toBe(true);
  });
});

describe("runScaffold --spec on existing spec", () => {
  test("does not recreate existing files", async () => {
    // Create spec first
    await runScaffold({ title: "User Auth", relicDir });
    // Overwrite spec.md with custom content to verify it's not overwritten
    writeFileSync(join(relicDir, "specs", "001-user-auth", "spec.md"), "custom content");

    await runScaffold({ spec: "001-user-auth", relicDir });
    const content = readFileSync(join(relicDir, "specs", "001-user-auth", "spec.md"), "utf8");
    expect(content).toBe("custom content");
  });

  test("still updates current-spec", async () => {
    await runScaffold({ title: "User Auth", relicDir });
    await runScaffold({ title: "Payments", relicDir });
    // Switch back to first spec
    await runScaffold({ spec: "001-user-auth", relicDir });
    const content = readFileSync(join(relicDir, "current-spec"), "utf8").trim();
    expect(content).toBe("001-user-auth");
  });
});
