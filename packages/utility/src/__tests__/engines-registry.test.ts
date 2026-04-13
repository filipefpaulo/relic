import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readEnginesRegistry, writeEnginesRegistry } from "../engines-registry.ts";

let relicDir: string;
beforeEach(() => {
  relicDir = mkdtempSync(join(tmpdir(), "relic-engines-test-"));
});
afterEach(() => {
  rmSync(relicDir, { recursive: true, force: true });
});

describe("readEnginesRegistry", () => {
  test("returns [] when engines.json is absent", () => {
    expect(readEnginesRegistry(relicDir)).toEqual([]);
  });

  test("returns correct values when engines.json exists", () => {
    writeFileSync(join(relicDir, "engines.json"), JSON.stringify(["claude", "copilot"]));
    expect(readEnginesRegistry(relicDir)).toEqual(["claude", "copilot"]);
  });

  test("returns [] when engines.json is malformed JSON", () => {
    writeFileSync(join(relicDir, "engines.json"), "not-json");
    expect(readEnginesRegistry(relicDir)).toEqual([]);
  });

  test("returns [] when engines.json is not an array", () => {
    writeFileSync(join(relicDir, "engines.json"), JSON.stringify({ engine: "claude" }));
    expect(readEnginesRegistry(relicDir)).toEqual([]);
  });
});

describe("writeEnginesRegistry", () => {
  test("creates engines.json with sorted, deduplicated entries", () => {
    writeEnginesRegistry(relicDir, ["copilot", "claude", "claude"]);
    expect(readEnginesRegistry(relicDir)).toEqual(["claude", "copilot"]);
  });

  test("deduplicates when same engine added twice", () => {
    writeEnginesRegistry(relicDir, ["claude", "claude"]);
    expect(readEnginesRegistry(relicDir)).toEqual(["claude"]);
  });

  test("sorts entries alphabetically", () => {
    writeEnginesRegistry(relicDir, ["codex", "claude", "copilot"]);
    expect(readEnginesRegistry(relicDir)).toEqual(["claude", "codex", "copilot"]);
  });
});

describe("round-trip", () => {
  test("write then read preserves values exactly", () => {
    writeEnginesRegistry(relicDir, ["claude", "copilot"]);
    expect(readEnginesRegistry(relicDir)).toEqual(["claude", "copilot"]);
  });

  test("appending an engine and rewriting is idempotent", () => {
    writeEnginesRegistry(relicDir, ["claude"]);
    const engines = readEnginesRegistry(relicDir);
    writeEnginesRegistry(relicDir, [...engines, "claude"]);
    expect(readEnginesRegistry(relicDir)).toEqual(["claude"]);
  });
});
