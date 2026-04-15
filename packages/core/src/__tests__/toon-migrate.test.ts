import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  readManifestToon,
  buildSpecIndex,
  buildFixIndex,
  runToonMigrate,
} from "../commands/toon-migrate.ts";

let dir: string;
let relicDir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-toon-migrate-test-"));
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

function writeToon(absPath: string, header: string, rows: string[][]) {
  const lines = [`# ${header}`];
  for (const row of rows) lines.push(row.join(" | "));
  writeFileSync(absPath, lines.join("\n") + "\n");
}

function writeJson(absPath: string, data: unknown) {
  writeFileSync(absPath, JSON.stringify(data));
}

describe("readManifestToon", () => {
  test("returns entries from .toon when it exists", () => {
    const subdirPath = join(relicDir, "shared", "domains");
    writeToon(join(subdirPath, "manifest.toon"), "domains manifest", [
      ["UserAuth", "UserAuth.md", "auth session", "Auth domain"],
    ]);
    const entries = readManifestToon(subdirPath, "domains manifest");
    expect(entries.length).toBe(1);
    expect(entries[0].name).toBe("UserAuth");
    expect(entries[0].tags).toEqual(["auth", "session"]);
  });

  test("falls back to .json when .toon absent; writes .toon; emits warn", () => {
    const subdirPath = join(relicDir, "shared", "domains");
    writeJson(join(subdirPath, "manifest.json"), [
      { name: "UserAuth", file: "UserAuth.md", tags: ["auth"], tldr: "Auth domain" },
    ]);

    const warnMessages: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnMessages.push(msg);

    const entries = readManifestToon(subdirPath, "domains manifest");
    console.warn = origWarn;

    expect(entries.length).toBe(1);
    expect(entries[0].name).toBe("UserAuth");
    expect(existsSync(join(subdirPath, "manifest.toon"))).toBe(true);
    expect(warnMessages.some((m) => m.includes("Auto-migrating"))).toBe(true);
  });

  test("returns [] when neither format exists", () => {
    const subdirPath = join(relicDir, "shared", "domains");
    const entries = readManifestToon(subdirPath, "domains manifest");
    expect(entries).toEqual([]);
  });
});

describe("buildSpecIndex", () => {
  test("2 spec dirs with spec.md files → correct ManifestEntry[]", () => {
    mkdirSync(join(relicDir, "specs", "001-auth"), { recursive: true });
    mkdirSync(join(relicDir, "specs", "002-payments"), { recursive: true });
    writeFileSync(join(relicDir, "specs", "001-auth", "spec.md"), "# Spec: User Authentication\nSome content");
    writeFileSync(join(relicDir, "specs", "002-payments", "spec.md"), "# Spec: Payment Flow\nSome content");

    const entries = buildSpecIndex(relicDir);
    expect(entries.length).toBe(2);
    const auth = entries.find((e) => e.file === "001-auth/");
    expect(auth).toBeDefined();
    expect(auth!.name).toBe("User Authentication");
    expect(auth!.tags).toEqual([]);
    expect(auth!.tldr).toBe("");
  });

  test("dir with no title line → falls back to folder name", () => {
    mkdirSync(join(relicDir, "specs", "001-auth"), { recursive: true });
    writeFileSync(join(relicDir, "specs", "001-auth", "spec.md"), "No title here\nJust content");

    const entries = buildSpecIndex(relicDir);
    expect(entries.length).toBe(1);
    expect(entries[0].name).toBe("001-auth");
    expect(entries[0].file).toBe("001-auth/");
  });
});

describe("buildFixIndex", () => {
  test("2 fix files with # Fix: title lines → correct entries", () => {
    writeFileSync(join(relicDir, "fixes", "2026-01-01-null-session.md"), "# Fix: Null Session Error\nContent");
    writeFileSync(join(relicDir, "fixes", "2026-01-02-timeout.md"), "# Fix: Request Timeout\nContent");

    const entries = buildFixIndex(relicDir);
    expect(entries.length).toBe(2);
    const nullSession = entries.find((e) => e.file === "2026-01-01-null-session.md");
    expect(nullSession).toBeDefined();
    expect(nullSession!.name).toBe("Null Session Error");
  });

  test("skips manifest.toon, manifest.json, and non-.md files", () => {
    writeFileSync(join(relicDir, "fixes", "manifest.toon"), "# fixes index\n");
    writeFileSync(join(relicDir, "fixes", "manifest.json"), "[]");
    writeFileSync(join(relicDir, "fixes", "somefile.txt"), "not a fix");
    writeFileSync(join(relicDir, "fixes", "2026-01-01-real.md"), "# Fix: Real Fix\nContent");

    const entries = buildFixIndex(relicDir);
    expect(entries.length).toBe(1);
    expect(entries[0].file).toBe("2026-01-01-real.md");
  });
});

describe("runToonMigrate", () => {
  test("converts manifest.json → writes manifest.toon, validates round-trip count", async () => {
    writeJson(join(relicDir, "shared", "domains", "manifest.json"), [
      { name: "UserAuth", file: "UserAuth.md", tags: ["auth"], tldr: "Auth domain" },
      { name: "Payment", file: "Payment.md", tags: ["payment"], tldr: "Payment domain" },
    ]);
    // Suppress output
    const origLog = console.log;
    const origWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};

    const result = await runToonMigrate({ relicDir });

    console.log = origLog;
    console.warn = origWarn;

    expect(existsSync(join(relicDir, "shared", "domains", "manifest.toon"))).toBe(true);
    expect(result.converted.some((c) => c.dir === "shared/domains")).toBe(true);
    const converted = result.converted.find((c) => c.dir === "shared/domains");
    expect(converted!.entries).toBe(2);
  });

  test("skips subdirs that already have manifest.toon", async () => {
    writeToon(join(relicDir, "shared", "domains", "manifest.toon"), "domains manifest", [
      ["UserAuth", "UserAuth.md", "auth", "Auth domain"],
    ]);
    writeJson(join(relicDir, "shared", "domains", "manifest.json"), [
      { name: "UserAuth", file: "UserAuth.md", tags: ["auth"], tldr: "Auth domain" },
      { name: "Extra", file: "Extra.md", tags: [], tldr: "" },
    ]);

    const origLog = console.log;
    const origWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};

    const result = await runToonMigrate({ relicDir });

    console.log = origLog;
    console.warn = origWarn;

    // Should not have converted domains since manifest.toon already existed
    expect(result.converted.some((c) => c.dir === "shared/domains")).toBe(false);
    // The existing toon still has 1 entry (not 2)
    const toonContent = readFileSync(join(relicDir, "shared", "domains", "manifest.toon"), "utf-8");
    expect(toonContent.split("\n").filter((l) => l && !l.startsWith("#")).length).toBe(1);
  });

  test("writes specs/manifest.toon and fixes/manifest.toon", async () => {
    mkdirSync(join(relicDir, "specs", "001-auth"), { recursive: true });
    writeFileSync(join(relicDir, "specs", "001-auth", "spec.md"), "# Spec: Auth\nContent");
    writeFileSync(join(relicDir, "fixes", "2026-01-01-fix.md"), "# Fix: My Fix\nContent");

    const origLog = console.log;
    const origWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};

    const result = await runToonMigrate({ relicDir });

    console.log = origLog;
    console.warn = origWarn;

    expect(existsSync(join(relicDir, "specs", "manifest.toon"))).toBe(true);
    expect(existsSync(join(relicDir, "fixes", "manifest.toon"))).toBe(true);
    expect(result.spec_entries).toBe(1);
    expect(result.fix_entries).toBe(1);
  });
});
