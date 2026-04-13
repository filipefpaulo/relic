import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from "fs";
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
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runUse", () => {
  test("writes specId to current-spec file", async () => {
    await runUse({ specId: "001-auth", relicDir });
    const content = readFileSync(join(relicDir, "current-spec"), "utf8");
    expect(content).toBe("001-auth");
  });

  test("overwrites previous specId on second call", async () => {
    await runUse({ specId: "001-auth", relicDir });
    await runUse({ specId: "002-payments", relicDir });
    const content = readFileSync(join(relicDir, "current-spec"), "utf8");
    expect(content).toBe("002-payments");
  });
});
