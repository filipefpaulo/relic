import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runValidate } from "../commands/validate.ts";

let dir: string;
let relicDir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-test-"));
  relicDir = join(dir, ".relic");
  mkdirSync(join(relicDir, "specs"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "domains"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "contracts"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "rules"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "assumptions"), { recursive: true });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function captureOutput(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (msg: string) => logs.push(msg);
  return { logs, restore: () => { console.log = orig; } };
}

function makeSpec(id: string, artifacts: { owns?: string[]; reads?: string[]; touches_files?: string[] }) {
  const specDir = join(relicDir, "specs", id);
  mkdirSync(specDir, { recursive: true });
  writeFileSync(join(specDir, "artifacts.json"), JSON.stringify({
    owns: artifacts.owns ?? [],
    reads: artifacts.reads ?? [],
    touches_files: artifacts.touches_files ?? [],
  }));
}

describe("runValidate — valid setup", () => {
  test("returns valid: true for a clean project", async () => {
    // Spec owns an artifact that exists and is registered in manifest
    makeSpec("001-auth", { owns: ["shared/domains/UserAuth.md"] });
    writeFileSync(join(relicDir, "shared", "domains", "UserAuth.md"), "# UserAuth\n");
    writeFileSync(join(relicDir, "shared", "domains", "manifest.json"), JSON.stringify([
      { name: "UserAuth", file: "UserAuth.md", tldr: "Auth domain", tags: ["auth"] },
    ]));

    const { logs, restore } = captureOutput();
    await runValidate({ relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.valid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.missing_owned).toHaveLength(0);
  });
});

describe("runValidate — missing manifest", () => {
  test("reports missing_manifests when .md file exists but manifest.json is absent", async () => {
    writeFileSync(join(relicDir, "shared", "domains", "UserAuth.md"), "# UserAuth\n");
    // No manifest.json written

    const { logs, restore } = captureOutput();
    await runValidate({ relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.valid).toBe(false);
    expect(result.missing_manifests.some((m: { subdir: string }) => m.subdir === "domains")).toBe(true);
  });
});

describe("runValidate — unregistered file", () => {
  test("reports unregistered_files when .md is not in manifest", async () => {
    writeFileSync(join(relicDir, "shared", "domains", "UserAuth.md"), "# UserAuth\n");
    writeFileSync(join(relicDir, "shared", "domains", "manifest.json"), JSON.stringify([]));

    const { logs, restore } = captureOutput();
    await runValidate({ relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.valid).toBe(false);
    expect(result.unregistered_files.some((u: { file: string }) => u.file === "UserAuth.md")).toBe(true);
  });
});

describe("runValidate — ownership conflict", () => {
  test("reports conflicts when two specs own the same artifact", async () => {
    writeFileSync(join(relicDir, "shared", "domains", "UserAuth.md"), "# UserAuth\n");
    writeFileSync(join(relicDir, "shared", "domains", "manifest.json"), JSON.stringify([
      { name: "UserAuth", file: "UserAuth.md", tldr: "Auth", tags: ["auth"] },
    ]));
    makeSpec("001-auth", { owns: ["shared/domains/UserAuth.md"] });
    makeSpec("002-other", { owns: ["shared/domains/UserAuth.md"] });

    const { logs, restore } = captureOutput();
    await runValidate({ relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.valid).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].artifact).toBe("shared/domains/UserAuth.md");
  });
});

describe("runValidate — missing owned artifact", () => {
  test("reports missing_owned when owns path does not exist on disk", async () => {
    makeSpec("001-auth", { owns: ["shared/domains/Missing.md"] });

    const { logs, restore } = captureOutput();
    await runValidate({ relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.valid).toBe(false);
    expect(result.missing_owned.some((m: { artifact: string }) => m.artifact === "shared/domains/Missing.md")).toBe(true);
  });
});

describe("runValidate — illegal file in spec dir", () => {
  test("reports illegal_files when spec dir contains a file outside the allowlist", async () => {
    const specDir = join(relicDir, "specs", "001-auth");
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, "artifacts.json"), JSON.stringify({ owns: [], reads: [], touches_files: [] }));
    writeFileSync(join(specDir, "illegal.md"), "should not be here");

    const { logs, restore } = captureOutput();
    await runValidate({ relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.valid).toBe(false);
    expect(result.illegal_files.some((f: { file: string }) => f.file === "illegal.md")).toBe(true);
  });
});
