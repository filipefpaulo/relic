import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runUse } from "../commands/use.ts";

let dir: string;
let relicDir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-test-"));
  relicDir = join(dir, ".relic");
  mkdirSync(join(relicDir, "specs", "001-auth"), { recursive: true });
  mkdirSync(join(relicDir, "specs", "002-payments"), { recursive: true });
  mkdirSync(join(relicDir, "fixes"), { recursive: true });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runUse — spec activation", () => {
  test("writes specId to session.json", async () => {
    await runUse({ specId: "001-auth", relicDir });
    const session = JSON.parse(readFileSync(join(relicDir, "session.json"), "utf8"));
    expect(session.spec).toBe("001-auth");
    expect(session.fix).toBeNull();
  });

  test("overwrites previous specId on second call", async () => {
    await runUse({ specId: "001-auth", relicDir });
    await runUse({ specId: "002-payments", relicDir });
    const session = JSON.parse(readFileSync(join(relicDir, "session.json"), "utf8"));
    expect(session.spec).toBe("002-payments");
  });

  test("preserves existing fix when switching spec", async () => {
    // Write a fix document first
    writeFileSync(join(relicDir, "fixes", "2026-04-13-some-bug.md"), "# Fix\n**Status:** pending\n");
    await runUse({ fix: "2026-04-13-some-bug", relicDir });
    await runUse({ specId: "001-auth", relicDir });
    const session = JSON.parse(readFileSync(join(relicDir, "session.json"), "utf8"));
    expect(session.spec).toBe("001-auth");
    expect(session.fix).toBe("2026-04-13-some-bug");
  });
});

describe("runUse — fix activation", () => {
  test("writes fix ID to session.json when fix doc exists", async () => {
    writeFileSync(join(relicDir, "fixes", "2026-04-13-some-bug.md"), "# Fix\n**Status:** pending\n");
    await runUse({ fix: "2026-04-13-some-bug", relicDir });
    const session = JSON.parse(readFileSync(join(relicDir, "session.json"), "utf8"));
    expect(session.fix).toBe("2026-04-13-some-bug");
  });

  test("exits with error if fix doc does not exist", async () => {
    let exited = false;
    const origExit = process.exit;
    process.exit = (() => { exited = true; throw new Error("exit"); }) as typeof process.exit;
    try {
      await runUse({ fix: "2026-04-13-nonexistent", relicDir });
    } catch {
      // expected
    } finally {
      process.exit = origExit;
    }
    expect(exited).toBe(true);
  });
});

describe("runUse — clear fix", () => {
  test("sets session.fix to null", async () => {
    writeFileSync(join(relicDir, "fixes", "2026-04-13-some-bug.md"), "# Fix\n**Status:** pending\n");
    await runUse({ fix: "2026-04-13-some-bug", relicDir });
    await runUse({ clearFix: true, relicDir });
    const session = JSON.parse(readFileSync(join(relicDir, "session.json"), "utf8"));
    expect(session.fix).toBeNull();
  });
});
