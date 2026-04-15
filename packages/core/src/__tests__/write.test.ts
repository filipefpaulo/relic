import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runWrite } from "../commands/write.ts";
import { appendChangelogEntry } from "../core/changelog.ts";

let dir: string;
let relicDir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-write-test-"));
  relicDir = join(dir, ".relic");
  mkdirSync(join(relicDir, "specs"), { recursive: true });
  mkdirSync(join(relicDir, "fixes"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "domains"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "contracts"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "rules"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "assumptions"), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Helper: mock process.exit to throw so execution stops cleanly
function mockExitThrows() {
  return spyOn(process, "exit").mockImplementation((code?: number) => {
    throw new Error(`process.exit(${code ?? 0})`);
  });
}

// Helper: capture a single console.log call during fn()
async function captureLog(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (msg: string) => lines.push(String(msg));
  try {
    await fn();
  } finally {
    console.log = orig;
  }
  return lines.join("\n");
}

// Helper: write a minimal toon file
function writeToon(relPath: string, header: string, rows: [string, string, string, string][] = []) {
  const lines = [`# ${header}`, ...rows.map((r) => r.join(" | "))];
  writeFileSync(join(relicDir, relPath), lines.join("\n") + "\n");
}

// ─── appendChangelogEntry ────────────────────────────────────────────────────

describe("appendChangelogEntry", () => {
  test("creates changelog.md on first call with new-format heading", () => {
    appendChangelogEntry(relicDir, { name: "MySpec: contract added", description: "Added field X." });
    const content = readFileSync(join(relicDir, "changelog.md"), "utf8");
    expect(content).toMatch(/## \[\d{4}-\d{2}-\d{2}T[\d:.Z]+\] \/relic\.write — MySpec: contract added/);
    expect(content).toContain("Added field X.");
  });

  test("appends second block without overwriting the first", () => {
    appendChangelogEntry(relicDir, { name: "First", description: "first body" });
    appendChangelogEntry(relicDir, { name: "Second", description: "second body" });
    const content = readFileSync(join(relicDir, "changelog.md"), "utf8");
    expect(content).toContain("first body");
    expect(content).toContain("second body");
    const headings = content.match(/^## \[/gm);
    expect(headings?.length).toBe(2);
  });

  test("uses slash_command in heading when provided", () => {
    appendChangelogEntry(relicDir, {
      name: "001-auth: spec amended",
      description: "Fixed contract.",
      slash_command: "/relic.fix",
    });
    const content = readFileSync(join(relicDir, "changelog.md"), "utf8");
    expect(content).toContain("/relic.fix — 001-auth: spec amended");
  });

  test("appends metadata as a second paragraph when provided", () => {
    appendChangelogEntry(relicDir, {
      name: "Test",
      description: "Primary body.",
      metadata: "Extra context here.",
    });
    const content = readFileSync(join(relicDir, "changelog.md"), "utf8");
    expect(content).toContain("Primary body.");
    expect(content).toContain("Extra context here.");
    // metadata should appear after a blank line
    expect(content).toMatch(/Primary body\.\n\nExtra context here\./);
  });
});

// ─── runWrite — validation errors ────────────────────────────────────────────

describe("runWrite — validation errors", () => {
  test("exits 1 on invalid JSON payload", async () => {
    const mockExit = mockExitThrows();
    await expect(
      runWrite({ target: "changelog", payload: "not-json", relicDir })
    ).rejects.toThrow("process.exit(1)");
    mockExit.mockRestore();
  });

  test("exits 1 when name is missing from payload", async () => {
    const mockExit = mockExitThrows();
    await expect(
      runWrite({ target: "changelog", payload: '{"description":"x"}', relicDir })
    ).rejects.toThrow("process.exit(1)");
    mockExit.mockRestore();
  });

  test("exits 1 when description is missing from payload", async () => {
    const mockExit = mockExitThrows();
    await expect(
      runWrite({ target: "changelog", payload: '{"name":"x"}', relicDir })
    ).rejects.toThrow("process.exit(1)");
    mockExit.mockRestore();
  });
});

// ─── runWrite --changelog ─────────────────────────────────────────────────────

describe("runWrite --changelog", () => {
  test("creates changelog.md with correct new-format heading", async () => {
    await runWrite({
      target: "changelog",
      payload: JSON.stringify({ name: "spec-id: something changed", description: "Why it changed." }),
      relicDir,
    });
    const content = readFileSync(join(relicDir, "changelog.md"), "utf8");
    expect(content).toMatch(/## \[.*\] \/relic\.write — spec-id: something changed/);
    expect(content).toContain("Why it changed.");
  });

  test("returns JSON with action: appended", async () => {
    const output = await captureLog(() =>
      runWrite({
        target: "changelog",
        payload: JSON.stringify({ name: "N", description: "D" }),
        relicDir,
      })
    );
    const result = JSON.parse(output);
    expect(result.target).toBe("changelog");
    expect(result.action).toBe("appended");
    expect(result.name).toBe("N");
  });

  test("second call appends — file has two blocks, not overwritten", async () => {
    const payload1 = JSON.stringify({ name: "First", description: "first body" });
    const payload2 = JSON.stringify({ name: "Second", description: "second body" });
    await runWrite({ target: "changelog", payload: payload1, relicDir });
    await runWrite({ target: "changelog", payload: payload2, relicDir });
    const content = readFileSync(join(relicDir, "changelog.md"), "utf8");
    expect(content).toContain("first body");
    expect(content).toContain("second body");
  });
});

// ─── runWrite --specs ─────────────────────────────────────────────────────────

describe("runWrite --specs", () => {
  test("appends new entry to empty manifest; returns action: appended", async () => {
    writeToon("specs/manifest.toon", "specs index");
    const output = await captureLog(() =>
      runWrite({
        target: "specs",
        payload: JSON.stringify({ name: "Auth", file: "001-auth/", description: "Auth spec.", tags: ["auth"] }),
        relicDir,
      })
    );
    const result = JSON.parse(output);
    expect(result.action).toBe("appended");
    expect(result.name).toBe("Auth");

    const toon = readFileSync(join(relicDir, "specs", "manifest.toon"), "utf8");
    expect(toon).toContain("Auth");
    expect(toon).toContain("001-auth/");
  });

  test("upserts existing entry by name; returns action: upserted", async () => {
    writeToon("specs/manifest.toon", "specs index", [
      ["Auth", "001-auth/", "auth", "Old tldr."],
    ]);
    const output = await captureLog(() =>
      runWrite({
        target: "specs",
        payload: JSON.stringify({ name: "Auth", file: "001-auth/", description: "New tldr.", tags: ["auth", "login"] }),
        relicDir,
      })
    );
    const result = JSON.parse(output);
    expect(result.action).toBe("upserted");

    const toon = readFileSync(join(relicDir, "specs", "manifest.toon"), "utf8");
    expect(toon).toContain("New tldr.");
    expect(toon).not.toContain("Old tldr.");
    // Only one entry
    const dataLines = toon.split("\n").filter((l) => l.includes(" | "));
    expect(dataLines.length).toBe(1);
  });

  test("on upsert, preserves existing file field when payload omits it", async () => {
    writeToon("specs/manifest.toon", "specs index", [
      ["Auth", "001-auth/", "auth", "Old tldr."],
    ]);
    await runWrite({
      target: "specs",
      payload: JSON.stringify({ name: "Auth", description: "Updated tldr." }),
      relicDir,
    });
    const toon = readFileSync(join(relicDir, "specs", "manifest.toon"), "utf8");
    expect(toon).toContain("001-auth/");
  });

  test("exits 1 when file is missing for a new entry", async () => {
    writeToon("specs/manifest.toon", "specs index");
    const mockExit = mockExitThrows();
    await expect(
      runWrite({
        target: "specs",
        payload: JSON.stringify({ name: "NewSpec", description: "No file field." }),
        relicDir,
      })
    ).rejects.toThrow("process.exit(1)");
    mockExit.mockRestore();
  });
});

// ─── runWrite — all toon targets route to correct file ───────────────────────

describe("runWrite — toon target routing", () => {
  const targets = [
    { target: "fixes" as const, toonRel: "fixes/manifest.toon", header: "fixes index" },
    { target: "knowledge-domains" as const, toonRel: "shared/domains/manifest.toon", header: "domains manifest" },
    { target: "knowledge-contracts" as const, toonRel: "shared/contracts/manifest.toon", header: "contracts manifest" },
    { target: "knowledge-rules" as const, toonRel: "shared/rules/manifest.toon", header: "rules manifest" },
    { target: "knowledge-assumptions" as const, toonRel: "shared/assumptions/manifest.toon", header: "assumptions manifest" },
  ] as const;

  for (const { target, toonRel, header } of targets) {
    test(`--${target} writes to ${toonRel}`, async () => {
      writeToon(toonRel, header);
      await runWrite({
        target,
        payload: JSON.stringify({ name: "TestEntry", file: "TestEntry.md", description: "A test entry.", tags: ["test"] }),
        relicDir,
      });
      const toon = readFileSync(join(relicDir, toonRel), "utf8");
      expect(toon).toContain("TestEntry");
    });
  }
});

// ─── runWrite — metadata in toon tldr ────────────────────────────────────────

describe("runWrite — metadata merged into tldr for toon targets", () => {
  test("description and metadata are joined with ' — ' in tldr", async () => {
    writeToon("specs/manifest.toon", "specs index");
    await runWrite({
      target: "specs",
      payload: JSON.stringify({
        name: "Meta Spec",
        file: "007-meta/",
        description: "Core description.",
        metadata: "Extra context.",
        tags: [],
      }),
      relicDir,
    });
    const toon = readFileSync(join(relicDir, "specs", "manifest.toon"), "utf8");
    expect(toon).toContain("Core description. — Extra context.");
  });
});
