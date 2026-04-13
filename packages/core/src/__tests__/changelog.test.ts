import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { appendChangelog, filterChangelog } from "../core/changelog.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("appendChangelog", () => {
  test("creates changelog.md on first call", () => {
    appendChangelog(dir, { specId: "001-auth", command: "plan", message: "initial plan" });
    const content = readFileSync(join(dir, "changelog.md"), "utf8");
    expect(content).toContain("001-auth");
    expect(content).toContain("plan");
    expect(content).toContain("initial plan");
  });

  test("appends a second entry without overwriting the first", () => {
    appendChangelog(dir, { specId: "001-auth", command: "plan", message: "first entry" });
    appendChangelog(dir, { specId: "001-auth", command: "clarify", message: "second entry" });
    const content = readFileSync(join(dir, "changelog.md"), "utf8");
    expect(content).toContain("first entry");
    expect(content).toContain("second entry");
  });

  test("entry includes ISO timestamp in heading", () => {
    appendChangelog(dir, { specId: "001-auth", command: "plan", message: "msg" });
    const content = readFileSync(join(dir, "changelog.md"), "utf8");
    expect(content).toMatch(/## \[\d{4}-\d{2}-\d{2}T/);
  });
});

describe("filterChangelog", () => {
  test("returns empty string when changelog.md does not exist", () => {
    expect(filterChangelog(dir, "001-auth")).toBe("");
  });

  test("returns only blocks containing the given specId", () => {
    appendChangelog(dir, { specId: "001-auth", command: "plan", message: "auth plan" });
    appendChangelog(dir, { specId: "002-payments", command: "plan", message: "payments plan" });
    const result = filterChangelog(dir, "001-auth");
    expect(result).toContain("001-auth");
    expect(result).not.toContain("002-payments");
  });

  test("returns empty string when specId has no matching entries", () => {
    appendChangelog(dir, { specId: "002-payments", command: "plan", message: "payments" });
    expect(filterChangelog(dir, "001-auth")).toBe("");
  });

  test("returns multiple matching blocks for the same specId", () => {
    appendChangelog(dir, { specId: "001-auth", command: "plan", message: "plan" });
    appendChangelog(dir, { specId: "001-auth", command: "clarify", message: "clarify" });
    const result = filterChangelog(dir, "001-auth");
    expect(result).toContain("plan");
    expect(result).toContain("clarify");
  });
});
