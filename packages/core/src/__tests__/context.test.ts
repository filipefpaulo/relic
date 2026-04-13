import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runContext } from "../commands/context.ts";

let dir: string;
let relicDir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-test-"));
  relicDir = join(dir, ".relic");
  mkdirSync(join(relicDir, "specs"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "domains"), { recursive: true });
  writeFileSync(join(relicDir, "preamble.md"), "");
  writeFileSync(join(relicDir, "constitution.md"), "");
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

function makeSpec(id: string, withFiles = false) {
  const specDir = join(relicDir, "specs", id);
  mkdirSync(specDir, { recursive: true });
  if (withFiles) {
    writeFileSync(join(specDir, "spec.md"), "# Spec\n");
    writeFileSync(join(specDir, "artifacts.json"), JSON.stringify({ owns: [], reads: [], touches_files: [] }));
  }
}

describe("runContext — spec resolved from --spec arg", () => {
  test("returns spec_id and active_spec_source: arg", async () => {
    makeSpec("001-auth");

    const { logs, restore } = captureOutput();
    await runContext({ spec: "001-auth", relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.spec_id).toBe("001-auth");
    expect(result.active_spec_source).toBe("arg");
    expect("current_fix" in result).toBe(true);
  });
});

describe("runContext — spec resolved from session.json", () => {
  test("returns active_spec_source: session", async () => {
    makeSpec("001-auth");
    writeFileSync(join(relicDir, "session.json"), JSON.stringify({ spec: "001-auth", fix: null }));

    const { logs, restore } = captureOutput();
    await runContext({ relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.spec_id).toBe("001-auth");
    expect(result.active_spec_source).toBe("session");
  });

  test("current_fix is null when no fix active", async () => {
    makeSpec("001-auth");
    writeFileSync(join(relicDir, "session.json"), JSON.stringify({ spec: "001-auth", fix: null }));

    const { logs, restore } = captureOutput();
    await runContext({ relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.current_fix).toBeNull();
  });

  test("current_fix is populated when fix is active in session.json", async () => {
    makeSpec("001-auth");
    writeFileSync(join(relicDir, "session.json"), JSON.stringify({ spec: "001-auth", fix: "2026-04-13-some-bug" }));

    const { logs, restore } = captureOutput();
    await runContext({ relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.current_fix).toBe("2026-04-13-some-bug");
  });
});

describe("runContext — file existence flags", () => {
  test("spec: true when spec.md exists", async () => {
    makeSpec("001-auth", true);

    const { logs, restore } = captureOutput();
    await runContext({ spec: "001-auth", relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.files.spec).toBe(true);
  });

  test("spec: false when spec.md does not exist", async () => {
    makeSpec("001-auth", false);

    const { logs, restore } = captureOutput();
    await runContext({ spec: "001-auth", relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.files.spec).toBe(false);
  });

  test("preamble: true when preamble.md exists", async () => {
    makeSpec("001-auth");

    const { logs, restore } = captureOutput();
    await runContext({ spec: "001-auth", relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    expect(result.files.preamble).toBe(true);
  });
});

describe("runContext — shared artifact refs", () => {
  test("owns and reads entries appear in shared_artifacts with correct exists flags", async () => {
    const specDir = join(relicDir, "specs", "001-auth");
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(relicDir, "shared", "domains", "UserAuth.md"), "# UserAuth\n");
    writeFileSync(join(specDir, "artifacts.json"), JSON.stringify({
      owns: ["shared/domains/UserAuth.md"],
      reads: ["shared/domains/Missing.md"],
      touches_files: [],
    }));

    const { logs, restore } = captureOutput();
    await runContext({ spec: "001-auth", relicDir });
    restore();

    const result = JSON.parse(logs.join(""));
    const owned = result.shared_artifacts.find((a: { path: string }) => a.path === "shared/domains/UserAuth.md");
    const missing = result.shared_artifacts.find((a: { path: string }) => a.path === "shared/domains/Missing.md");

    expect(owned).toBeDefined();
    expect(owned.role).toBe("owns");
    expect(owned.exists).toBe(true);

    expect(missing).toBeDefined();
    expect(missing.role).toBe("reads");
    expect(missing.exists).toBe(false);
  });
});
