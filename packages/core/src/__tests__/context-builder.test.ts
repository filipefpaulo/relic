import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { buildContext, renderContext } from "../core/context-builder.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-test-"));
  mkdirSync(join(dir, "shared", "domains"), { recursive: true });
  mkdirSync(join(dir, "specs"), { recursive: true });
  writeFileSync(join(dir, "preamble.md"), "# Preamble\npreamble content\n");
  writeFileSync(join(dir, "constitution.md"), "# Constitution\nconstitution content\n");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("buildContext", () => {
  test("loads preamble and constitution when specId is null", () => {
    const ctx = buildContext(dir, null);
    expect(ctx.preamble).toContain("preamble content");
    expect(ctx.constitution).toContain("constitution content");
    expect(ctx.spec).toBeNull();
    expect(ctx.plan).toBeNull();
    expect(ctx.changelogExcerpt).toBeNull();
    expect(Object.keys(ctx.artifacts)).toHaveLength(0);
  });

  test("loads spec.md and plan.md when they exist", () => {
    const specDir = join(dir, "specs", "001-auth");
    mkdirSync(specDir);
    writeFileSync(join(specDir, "spec.md"), "# Spec\nspec content\n");
    writeFileSync(join(specDir, "plan.md"), "# Plan\nplan content\n");
    writeFileSync(join(specDir, "artifacts.json"), JSON.stringify({ owns: [], reads: [], touches_files: [] }));

    const ctx = buildContext(dir, "001-auth");
    expect(ctx.spec).toContain("spec content");
    expect(ctx.plan).toContain("plan content");
  });

  test("spec and plan are null when files are missing", () => {
    const specDir = join(dir, "specs", "001-auth");
    mkdirSync(specDir);
    writeFileSync(join(specDir, "artifacts.json"), JSON.stringify({ owns: [], reads: [], touches_files: [] }));

    const ctx = buildContext(dir, "001-auth");
    expect(ctx.spec).toBeNull();
    expect(ctx.plan).toBeNull();
  });

  test("loads artifacts referenced in artifacts.json owns array", () => {
    const specDir = join(dir, "specs", "001-auth");
    mkdirSync(specDir);
    writeFileSync(join(dir, "shared", "domains", "UserAuth.md"), "# UserAuth\nuser auth content\n");
    writeFileSync(join(specDir, "artifacts.json"), JSON.stringify({
      owns: ["shared/domains/UserAuth.md"],
      reads: [],
      touches_files: [],
    }));

    const ctx = buildContext(dir, "001-auth");
    expect(ctx.artifacts["shared/domains/UserAuth.md"]).toContain("user auth content");
  });

  test("loads artifacts referenced in artifacts.json reads array", () => {
    const specDir = join(dir, "specs", "001-auth");
    mkdirSync(specDir);
    writeFileSync(join(dir, "shared", "domains", "UserAuth.md"), "# UserAuth\nread artifact\n");
    writeFileSync(join(specDir, "artifacts.json"), JSON.stringify({
      owns: [],
      reads: ["shared/domains/UserAuth.md"],
      touches_files: [],
    }));

    const ctx = buildContext(dir, "001-auth");
    expect(ctx.artifacts["shared/domains/UserAuth.md"]).toContain("read artifact");
  });

  test("silently skips missing artifact files", () => {
    const specDir = join(dir, "specs", "001-auth");
    mkdirSync(specDir);
    writeFileSync(join(specDir, "artifacts.json"), JSON.stringify({
      owns: ["shared/domains/Missing.md"],
      reads: [],
      touches_files: [],
    }));

    const ctx = buildContext(dir, "001-auth");
    expect(ctx.artifacts["shared/domains/Missing.md"]).toBeUndefined();
  });
});

describe("renderContext", () => {
  test("sections appear in correct order: Preamble → Constitution → Spec → Plan", () => {
    const ctx = {
      preamble: "p",
      constitution: "c",
      spec: "s",
      plan: "pl",
      artifacts: {},
      changelogExcerpt: null,
    };
    const rendered = renderContext(ctx);
    const idx = (h: string) => rendered.indexOf(h);
    expect(idx("# Preamble")).toBeGreaterThan(-1);
    expect(idx("# Constitution")).toBeGreaterThan(idx("# Preamble"));
    expect(idx("# Spec")).toBeGreaterThan(idx("# Constitution"));
    expect(idx("# Plan")).toBeGreaterThan(idx("# Spec"));
  });

  test("artifact sections use the '# Shared Artifact:' prefix", () => {
    const ctx = {
      preamble: "",
      constitution: "",
      spec: null,
      plan: null,
      artifacts: { "shared/domains/Foo.md": "foo content" },
      changelogExcerpt: null,
    };
    const rendered = renderContext(ctx);
    expect(rendered).toContain("# Shared Artifact: shared/domains/Foo.md");
    expect(rendered).toContain("foo content");
  });

  test("changelog section included when changelogExcerpt is present", () => {
    const ctx = {
      preamble: "",
      constitution: "",
      spec: null,
      plan: null,
      artifacts: {},
      changelogExcerpt: "some changelog text",
    };
    const rendered = renderContext(ctx);
    expect(rendered).toContain("# Relevant Changelog");
    expect(rendered).toContain("some changelog text");
  });

  test("null fields are omitted from output", () => {
    const ctx = {
      preamble: "",
      constitution: "",
      spec: null,
      plan: null,
      artifacts: {},
      changelogExcerpt: null,
    };
    const rendered = renderContext(ctx);
    expect(rendered).not.toContain("# Spec");
    expect(rendered).not.toContain("# Plan");
    expect(rendered).not.toContain("# Relevant Changelog");
  });
});
