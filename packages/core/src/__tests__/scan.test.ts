import { describe, test, expect } from "bun:test";
import { join } from "path";
import { runScan } from "../commands/scan.ts";

// Smoke test against the real project directory.
// This test reads the actual codebase — it will reflect whatever exists on disk.

const projectDir = join(import.meta.dir, "..", "..", "..", "..");
const relicDir = join(projectDir, ".relic");

describe("runScan — smoke test", () => {
  test("output parses as valid JSON", async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (msg: string) => logs.push(msg);
    await runScan({ projectDir, relicDir, json: true });
    console.log = orig;

    expect(() => JSON.parse(logs.join(""))).not.toThrow();
  });

  test("top-level keys are present", async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (msg: string) => logs.push(msg);
    await runScan({ projectDir, relicDir, json: true });
    console.log = orig;

    const result = JSON.parse(logs.join(""));
    expect(typeof result.project_dir).toBe("string");
    expect(Array.isArray(result.tech_stack)).toBe(true);
    expect(Array.isArray(result.key_files)).toBe(true);
    expect(typeof result.file_tree).toBe("string");
    expect(typeof result.existing_artifacts).toBe("object");
    expect(typeof result.stats).toBe("object");
  });

  test("tech_stack is non-empty", async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (msg: string) => logs.push(msg);
    await runScan({ projectDir, relicDir, json: true });
    console.log = orig;

    const result = JSON.parse(logs.join(""));
    expect(result.tech_stack.length).toBeGreaterThan(0);
  });

  test("key_files contains at least one entry", async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (msg: string) => logs.push(msg);
    await runScan({ projectDir, relicDir, json: true });
    console.log = orig;

    const result = JSON.parse(logs.join(""));
    expect(result.key_files.length).toBeGreaterThan(0);
  });
});
