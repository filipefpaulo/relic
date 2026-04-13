import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { fileExists, dirExists, findRelicDir } from "../fs.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("fileExists", () => {
  test("returns true for an existing file", () => {
    writeFileSync(join(dir, "foo.txt"), "content");
    expect(fileExists(join(dir, "foo.txt"))).toBe(true);
  });
  test("returns false for a directory", () => {
    expect(fileExists(dir)).toBe(false);
  });
  test("returns false for a nonexistent path", () => {
    expect(fileExists(join(dir, "nope.txt"))).toBe(false);
  });
});

describe("dirExists", () => {
  test("returns true for an existing directory", () => {
    expect(dirExists(dir)).toBe(true);
  });
  test("returns false for a file", () => {
    writeFileSync(join(dir, "foo.txt"), "content");
    expect(dirExists(join(dir, "foo.txt"))).toBe(false);
  });
  test("returns false for a nonexistent path", () => {
    expect(dirExists(join(dir, "nope"))).toBe(false);
  });
});

describe("findRelicDir", () => {
  test("finds .relic/ in the starting directory", () => {
    mkdirSync(join(dir, ".relic"));
    expect(findRelicDir(dir)).toBe(join(dir, ".relic"));
  });
  test("finds .relic/ from a nested subdirectory", () => {
    mkdirSync(join(dir, ".relic"));
    mkdirSync(join(dir, "src", "nested"), { recursive: true });
    expect(findRelicDir(join(dir, "src", "nested"))).toBe(join(dir, ".relic"));
  });
  test("returns null when no .relic/ exists in the tree", () => {
    // dir has no .relic/ — walk will reach filesystem root and return null
    // Use a nested path inside dir to avoid finding this repo's own .relic/
    mkdirSync(join(dir, "orphan", "deep"), { recursive: true });
    expect(findRelicDir(join(dir, "orphan", "deep"))).toBeNull();
  });
});
