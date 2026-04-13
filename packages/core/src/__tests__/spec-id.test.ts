import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { slugify, nextSpecId, inferSpecFromBranch, availableSpecs } from "../utils/spec-id.ts";

describe("slugify", () => {
  test("lowercases and hyphenates spaces", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  test("collapses multiple non-alphanumeric chars into one hyphen", () => {
    expect(slugify("hello--world!!")).toBe("hello-world");
  });
  test("strips leading and trailing hyphens", () => {
    expect(slugify("  --hello--  ")).toBe("hello");
  });
  test("preserves numbers", () => {
    expect(slugify("Auth2 Test")).toBe("auth2-test");
  });
  test("handles already-clean slug", () => {
    expect(slugify("user-auth")).toBe("user-auth");
  });
});

describe("inferSpecFromBranch", () => {
  test("returns spec ID from exact NNN-slug branch", () => {
    expect(inferSpecFromBranch("001-auth")).toBe("001-auth");
  });
  test("returns full NNN-slug match from longer branch name", () => {
    expect(inferSpecFromBranch("feature/001-auth-improvements")).toBe("001-auth-improvements");
  });
  test("returns null for non-matching branch", () => {
    expect(inferSpecFromBranch("feature/auth")).toBeNull();
  });
  test("returns null for main", () => {
    expect(inferSpecFromBranch("main")).toBeNull();
  });
  test("returns null for release branch", () => {
    expect(inferSpecFromBranch("release/v0.3.0")).toBeNull();
  });
});

describe("nextSpecId and availableSpecs", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "relic-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("nextSpecId returns 001-slug when directory is empty", () => {
    expect(nextSpecId(dir, "auth")).toBe("001-auth");
  });

  test("nextSpecId increments from the highest existing prefix", () => {
    mkdirSync(join(dir, "001-foo"));
    mkdirSync(join(dir, "002-bar"));
    expect(nextSpecId(dir, "baz")).toBe("003-baz");
  });

  test("nextSpecId handles non-contiguous numbers", () => {
    mkdirSync(join(dir, "001-foo"));
    mkdirSync(join(dir, "005-bar"));
    expect(nextSpecId(dir, "next")).toBe("006-next");
  });

  test("availableSpecs returns only NNN-slug directories", () => {
    mkdirSync(join(dir, "001-foo"));
    mkdirSync(join(dir, "002-bar"));
    mkdirSync(join(dir, "not-a-spec"));
    mkdirSync(join(dir, "abc-def"));
    const specs = availableSpecs(dir);
    expect(specs).toContain("001-foo");
    expect(specs).toContain("002-bar");
    expect(specs).not.toContain("not-a-spec");
    expect(specs).not.toContain("abc-def");
  });

  test("availableSpecs returns empty array when directory is empty", () => {
    expect(availableSpecs(dir)).toEqual([]);
  });
});
