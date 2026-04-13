import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runInit } from "../commands/init.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runInit", () => {
  test("creates all expected shared/ subdirectories", async () => {
    await runInit({ dir, force: false, engines: [] });
    const relic = join(dir, ".relic");
    expect(existsSync(join(relic, "shared", "domains"))).toBe(true);
    expect(existsSync(join(relic, "shared", "contracts"))).toBe(true);
    expect(existsSync(join(relic, "shared", "rules"))).toBe(true);
    expect(existsSync(join(relic, "shared", "assumptions"))).toBe(true);
    expect(existsSync(join(relic, "specs"))).toBe(true);
  });

  test("writes preamble.md, constitution.md, changelog.md and .gitignore", async () => {
    await runInit({ dir, force: false, engines: [] });
    const relic = join(dir, ".relic");
    expect(existsSync(join(relic, "preamble.md"))).toBe(true);
    expect(existsSync(join(relic, "constitution.md"))).toBe(true);
    expect(existsSync(join(relic, "changelog.md"))).toBe(true);
    expect(existsSync(join(relic, ".gitignore"))).toBe(true);
  });

  test(".gitignore contains current-spec entry", async () => {
    await runInit({ dir, force: false, engines: [] });
    const gitignore = readFileSync(join(dir, ".relic", ".gitignore"), "utf8");
    expect(gitignore).toContain("current-spec");
  });

  test("re-init with --force succeeds and files remain present", async () => {
    await runInit({ dir, force: false, engines: [] });
    await runInit({ dir, force: true, engines: [] });
    expect(existsSync(join(dir, ".relic", "preamble.md"))).toBe(true);
  });
});
