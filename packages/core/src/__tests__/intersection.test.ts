import { describe, test, expect } from "bun:test";
import { detectIntersections, formatIntersectionReport } from "../core/intersection.ts";
import type { SpecMeta } from "../types.ts";

function makeSpec(id: string, owns: string[], touches: string[]): SpecMeta {
  return { id, path: `/fake/${id}`, artifacts: { owns, reads: [], touches_files: touches } };
}

describe("detectIntersections", () => {
  test("empty registry produces no conflicts or warnings", () => {
    const result = detectIntersections([]);
    expect(result.conflicts).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test("single spec produces no conflicts or warnings", () => {
    const result = detectIntersections([
      makeSpec("001", ["shared/domains/Foo.md"], ["src/foo.ts"]),
    ]);
    expect(result.conflicts).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test("two specs with distinct owned artifacts produce no conflicts", () => {
    const result = detectIntersections([
      makeSpec("001", ["shared/domains/Foo.md"], []),
      makeSpec("002", ["shared/domains/Bar.md"], []),
    ]);
    expect(result.conflicts).toEqual([]);
  });

  test("two specs owning the same artifact produces a conflict", () => {
    const result = detectIntersections([
      makeSpec("001", ["shared/domains/Foo.md"], []),
      makeSpec("002", ["shared/domains/Foo.md"], []),
    ]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.artifact).toBe("shared/domains/Foo.md");
    expect(result.conflicts[0]!.specs).toEqual(["001", "002"]);
  });

  test("two specs touching the same file produces a warning", () => {
    const result = detectIntersections([
      makeSpec("001", [], ["src/auth.ts"]),
      makeSpec("002", [], ["src/auth.ts"]),
    ]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.file).toBe("src/auth.ts");
    expect(result.warnings[0]!.specs).toEqual(["001", "002"]);
  });

  test("trailing slash on touches_files is normalised", () => {
    const result = detectIntersections([
      makeSpec("001", [], ["src/auth/"]),
      makeSpec("002", [], ["src/auth/"]),
    ]);
    expect(result.warnings).toHaveLength(1);
  });

  test("reads are not subject to conflict detection", () => {
    const s1: SpecMeta = { id: "001", path: "/fake/001", artifacts: { owns: [], reads: ["shared/domains/Foo.md"], touches_files: [] } };
    const s2: SpecMeta = { id: "002", path: "/fake/002", artifacts: { owns: [], reads: ["shared/domains/Foo.md"], touches_files: [] } };
    const result = detectIntersections([s1, s2]);
    expect(result.conflicts).toEqual([]);
  });
});

describe("formatIntersectionReport", () => {
  test("returns empty string for empty report", () => {
    expect(formatIntersectionReport({ conflicts: [], warnings: [] })).toBe("");
  });

  test("includes OWNERSHIP CONFLICTS section with artifact and spec names", () => {
    const report = formatIntersectionReport({
      conflicts: [{ artifact: "shared/domains/Foo.md", specs: ["001", "002"] }],
      warnings: [],
    });
    expect(report).toContain("OWNERSHIP CONFLICTS");
    expect(report).toContain("shared/domains/Foo.md");
    expect(report).toContain("001");
    expect(report).toContain("002");
  });

  test("includes FILE OVERLAP WARNINGS section with file and spec names", () => {
    const report = formatIntersectionReport({
      conflicts: [],
      warnings: [{ file: "src/auth.ts", specs: ["001", "002"] }],
    });
    expect(report).toContain("FILE OVERLAP WARNINGS");
    expect(report).toContain("src/auth.ts");
  });
});
