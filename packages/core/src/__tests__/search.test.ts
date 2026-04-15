import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runSearch } from "../commands/search.ts";

let dir: string;
let relicDir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-search-test-"));
  relicDir = join(dir, ".relic");
  mkdirSync(join(relicDir, "shared", "domains"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "contracts"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "rules"), { recursive: true });
  mkdirSync(join(relicDir, "shared", "assumptions"), { recursive: true });
  mkdirSync(join(relicDir, "specs"), { recursive: true });
  mkdirSync(join(relicDir, "fixes"), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function captureLogs(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (msg: string) => lines.push(String(msg));
  console.error = (msg: string) => lines.push(String(msg));
  return {
    lines,
    restore: () => {
      console.log = origLog;
      console.error = origError;
    },
  };
}

function writeToon(rel: string, header: string, rows: string[][]) {
  const lines = [`# ${header}`];
  for (const row of rows) lines.push(row.join(" | "));
  writeFileSync(join(relicDir, rel), lines.join("\n") + "\n");
}

function writeJson(rel: string, data: unknown) {
  writeFileSync(join(relicDir, rel), JSON.stringify(data));
}

describe("runSearch — error cases", () => {
  test("no keywords + no --deep → exits with error", async () => {
    const { lines, restore } = captureLogs();
    const mockExit = spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await runSearch({ keywords: [], deep: false, knowledge: false, spec: false, fix: false, json: false, relicDir });
    restore();
    mockExit.mockRestore();
    expect(lines.some((l) => l.includes("requires keywords or --deep"))).toBe(true);
  });
});

describe("runSearch — --deep with no keywords", () => {
  test("returns all entries with score 0", async () => {
    writeToon("shared/domains/manifest.toon", "domains manifest", [
      ["UserAuth", "UserAuth.md", "auth session", "Handles auth"],
      ["Payment", "Payment.md", "payment billing", "Handles payments"],
    ]);
    writeToon("specs/manifest.toon", "specs index", [
      ["001-auth/", "001-auth/", "", ""],
    ]);
    writeToon("fixes/manifest.toon", "fixes index", []);

    const { lines, restore } = captureLogs();
    await runSearch({ keywords: [], deep: true, knowledge: false, spec: false, fix: false, json: false, relicDir });
    restore();

    const dataLines = lines.filter((l) => !l.startsWith("#"));
    expect(dataLines.length).toBeGreaterThanOrEqual(2);
    for (const line of dataLines) {
      const fields = line.split(" | ");
      expect(fields[5]).toBe("0"); // score = 0
    }
  });
});

describe("runSearch — scope flags", () => {
  beforeEach(() => {
    writeToon("shared/domains/manifest.toon", "domains manifest", [
      ["UserAuth", "UserAuth.md", "auth", "Auth domain"],
    ]);
    writeToon("specs/manifest.toon", "specs index", [
      ["Auth Spec", "001-auth/", "auth", "Auth feature spec"],
    ]);
    writeToon("fixes/manifest.toon", "fixes index", [
      ["Fix null session", "2026-01-01-null-session.md", "auth session", "Fix for null session"],
    ]);
  });

  test("--knowledge returns only knowledge entries", async () => {
    const { lines, restore } = captureLogs();
    await runSearch({ keywords: ["auth"], deep: false, knowledge: true, spec: false, fix: false, json: false, relicDir });
    restore();
    const dataLines = lines.filter((l) => !l.startsWith("#") && l.trim());
    expect(dataLines.every((l) => l.startsWith("knowledge"))).toBe(true);
  });

  test("--spec returns only spec entries", async () => {
    const { lines, restore } = captureLogs();
    await runSearch({ keywords: ["auth"], deep: false, knowledge: false, spec: true, fix: false, json: false, relicDir });
    restore();
    const dataLines = lines.filter((l) => !l.startsWith("#") && l.trim());
    expect(dataLines.every((l) => l.startsWith("spec"))).toBe(true);
  });

  test("--fix returns only fix entries", async () => {
    const { lines, restore } = captureLogs();
    await runSearch({ keywords: ["auth"], deep: false, knowledge: false, spec: false, fix: true, json: false, relicDir });
    restore();
    const dataLines = lines.filter((l) => !l.startsWith("#") && l.trim());
    expect(dataLines.every((l) => l.startsWith("fix"))).toBe(true);
  });
});

describe("runSearch — scoring and filtering", () => {
  test("knowledge entries scored by tag overlap", async () => {
    writeToon("shared/domains/manifest.toon", "domains manifest", [
      ["UserAuth", "UserAuth.md", "auth session token", "Auth domain"],
      ["Payment", "Payment.md", "payment billing", "Payment domain"],
    ]);
    writeToon("specs/manifest.toon", "specs index", []);
    writeToon("fixes/manifest.toon", "fixes index", []);

    const { lines, restore } = captureLogs();
    await runSearch({ keywords: ["auth", "session"], deep: false, knowledge: false, spec: false, fix: false, json: false, relicDir });
    restore();

    const dataLines = lines.filter((l) => !l.startsWith("#") && l.trim());
    expect(dataLines.length).toBe(1);
    expect(dataLines[0]).toContain("UserAuth");
    const score = parseInt(dataLines[0].split(" | ")[5], 10);
    expect(score).toBe(2);
  });

  test("spec/fix entries scored by substring match in name+tldr", async () => {
    writeToon("specs/manifest.toon", "specs index", [
      ["Auth Feature", "001-auth/", "auth", "Implements user authentication"],
      ["Payment Flow", "002-payment/", "payment", "Handles payment checkout"],
    ]);
    writeToon("fixes/manifest.toon", "fixes index", []);
    for (const subdir of ["domains", "contracts", "rules", "assumptions"]) {
      writeToon(`shared/${subdir}/manifest.toon`, `${subdir} manifest`, []);
    }

    const { lines, restore } = captureLogs();
    await runSearch({ keywords: ["auth"], deep: false, knowledge: false, spec: true, fix: false, json: false, relicDir });
    restore();

    const dataLines = lines.filter((l) => !l.startsWith("#") && l.trim());
    expect(dataLines.length).toBe(1);
    expect(dataLines[0]).toContain("Auth Feature");
  });

  test("results sorted by score descending", async () => {
    writeToon("shared/domains/manifest.toon", "domains manifest", [
      ["Low", "low.md", "auth", "Low score entry"],
      ["High", "high.md", "auth session token", "High score entry"],
    ]);
    writeToon("specs/manifest.toon", "specs index", []);
    writeToon("fixes/manifest.toon", "fixes index", []);

    const { lines, restore } = captureLogs();
    await runSearch({ keywords: ["auth", "session", "token"], deep: false, knowledge: false, spec: false, fix: false, json: false, relicDir });
    restore();

    const dataLines = lines.filter((l) => !l.startsWith("#") && l.trim());
    expect(dataLines.length).toBe(2);
    const scores = dataLines.map((l) => parseInt(l.split(" | ")[5], 10));
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });
});

describe("runSearch — output format", () => {
  beforeEach(() => {
    writeToon("shared/domains/manifest.toon", "domains manifest", [
      ["UserAuth", "UserAuth.md", "auth session", "Auth domain"],
    ]);
    writeToon("specs/manifest.toon", "specs index", []);
    writeToon("fixes/manifest.toon", "fixes index", []);
  });

  test("default output: comment header + 6-field toon lines", async () => {
    const { lines, restore } = captureLogs();
    await runSearch({ keywords: ["auth"], deep: false, knowledge: false, spec: false, fix: false, json: false, relicDir });
    restore();

    expect(lines[0].startsWith("#")).toBe(true);
    const dataLines = lines.filter((l) => !l.startsWith("#") && l.trim());
    expect(dataLines.length).toBe(1);
    expect(dataLines[0].split(" | ")).toHaveLength(6);
  });

  test("--json output: valid JSON array with all SearchResultEntry fields", async () => {
    const { lines, restore } = captureLogs();
    await runSearch({ keywords: ["auth"], deep: false, knowledge: false, spec: false, fix: false, json: true, relicDir });
    restore();

    const results = JSON.parse(lines.join(""));
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    const entry = results[0];
    expect(typeof entry.source).toBe("string");
    expect(typeof entry.name).toBe("string");
    expect(typeof entry.path).toBe("string");
    expect(Array.isArray(entry.tags)).toBe(true);
    expect(typeof entry.tldr).toBe("string");
    expect(typeof entry.score).toBe("number");
  });
});

describe("runSearch — auto-migration", () => {
  test("JSON-only manifest is transparently converted during search", async () => {
    writeJson("shared/domains/manifest.json", [
      { name: "UserAuth", file: "UserAuth.md", tags: ["auth"], tldr: "Auth domain" },
    ]);
    writeToon("specs/manifest.toon", "specs index", []);
    writeToon("fixes/manifest.toon", "fixes index", []);

    const { lines, restore } = captureLogs();
    await runSearch({ keywords: ["auth"], deep: false, knowledge: false, spec: false, fix: false, json: false, relicDir });
    restore();

    const dataLines = lines.filter((l) => !l.startsWith("#") && l.trim());
    expect(dataLines.some((l) => l.includes("UserAuth"))).toBe(true);
  });
});
