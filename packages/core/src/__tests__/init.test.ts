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
    expect(existsSync(join(relic, "fixes"))).toBe(true);
  });

  test("writes preamble.md, constitution.md, changelog.md and .gitignore", async () => {
    await runInit({ dir, force: false, engines: [] });
    const relic = join(dir, ".relic");
    expect(existsSync(join(relic, "preamble.md"))).toBe(true);
    expect(existsSync(join(relic, "constitution.md"))).toBe(true);
    expect(existsSync(join(relic, "changelog.md"))).toBe(true);
    expect(existsSync(join(relic, ".gitignore"))).toBe(true);
  });

  test(".gitignore contains session.json entry", async () => {
    await runInit({ dir, force: false, engines: [] });
    const gitignore = readFileSync(join(dir, ".relic", ".gitignore"), "utf8");
    expect(gitignore).toContain("session.json");
  });

  test("creates session.json with null spec and fix", async () => {
    await runInit({ dir, force: false, engines: [] });
    const session = JSON.parse(readFileSync(join(dir, ".relic", "session.json"), "utf8"));
    expect(session.spec).toBeNull();
    expect(session.fix).toBeNull();
  });

  test("creates fixes/manifest.json as empty array", async () => {
    await runInit({ dir, force: false, engines: [] });
    const manifest = JSON.parse(readFileSync(join(dir, ".relic", "fixes", "manifest.json"), "utf8"));
    expect(Array.isArray(manifest)).toBe(true);
    expect(manifest.length).toBe(0);
  });

  test("re-init with --force succeeds and files remain present", async () => {
    await runInit({ dir, force: false, engines: [] });
    await runInit({ dir, force: true, engines: [] });
    expect(existsSync(join(dir, ".relic", "preamble.md"))).toBe(true);
  });
});
