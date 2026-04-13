import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runSearch, runDeepSearch } from "../commands/search.ts";

let dir: string;
let relicDir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-test-"));
  relicDir = join(dir, ".relic");
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

function writeManifest(subdir: string, entries: object[]) {
  writeFileSync(
    join(relicDir, "shared", subdir, "manifest.json"),
    JSON.stringify(entries)
  );
}

describe("runSearch", () => {
  test("returns entries whose tags match keyword, score reflects tag hits", async () => {
    writeManifest("domains", [
      { name: "UserAuth", file: "UserAuth.md", tldr: "Auth domain", tags: ["auth", "session", "token"] },
      { name: "Payment", file: "Payment.md", tldr: "Payment domain", tags: ["payment", "billing"] },
    ]);

    const { logs, restore } = captureOutput();
    await runSearch({ keywords: ["auth", "session"], relicDir });
    restore();

    const results = JSON.parse(logs.join(""));
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("UserAuth");
    expect(results[0].score).toBe(2);
  });

  test("sorted descending by score", async () => {
    writeManifest("domains", [
      { name: "LowScore", file: "LowScore.md", tldr: "Low", tags: ["auth"] },
      { name: "HighScore", file: "HighScore.md", tldr: "High", tags: ["auth", "session", "token"] },
    ]);

    const { logs, restore } = captureOutput();
    await runSearch({ keywords: ["auth", "session", "token"], relicDir });
    restore();

    const results = JSON.parse(logs.join(""));
    expect(results[0].name).toBe("HighScore");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  test("returns empty array when no tags match", async () => {
    writeManifest("domains", [
      { name: "UserAuth", file: "UserAuth.md", tldr: "Auth domain", tags: ["auth", "session"] },
    ]);

    const { logs, restore } = captureOutput();
    await runSearch({ keywords: ["payment"], relicDir });
    restore();

    const results = JSON.parse(logs.join(""));
    expect(results).toEqual([]);
  });

  test("missing manifest for a subdir is silently skipped", async () => {
    // Only domains has a manifest — contracts, rules, assumptions do not
    writeManifest("domains", [
      { name: "UserAuth", file: "UserAuth.md", tldr: "Auth domain", tags: ["auth"] },
    ]);

    const { logs, restore } = captureOutput();
    await runSearch({ keywords: ["auth"], relicDir });
    restore();

    const results = JSON.parse(logs.join(""));
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("UserAuth");
  });
});

describe("runDeepSearch", () => {
  test("returns all entries across all manifest subdirs with name, tldr, tags, path", async () => {
    writeManifest("domains", [
      { name: "UserAuth", file: "UserAuth.md", tldr: "Auth domain", tags: ["auth"] },
    ]);
    writeManifest("contracts", [
      { name: "AuthAPI", file: "AuthAPI.md", tldr: "Auth API contract", tags: ["api", "auth"] },
    ]);

    const { logs, restore } = captureOutput();
    await runDeepSearch({ relicDir });
    restore();

    const results = JSON.parse(logs.join(""));
    expect(results.length).toBe(2);

    const domain = results.find((r: { name: string }) => r.name === "UserAuth");
    expect(domain).toBeDefined();
    expect(domain.path).toBe("shared/domains/UserAuth.md");
    expect(domain.tldr).toBe("Auth domain");
    expect(Array.isArray(domain.tags)).toBe(true);

    const contract = results.find((r: { name: string }) => r.name === "AuthAPI");
    expect(contract).toBeDefined();
    expect(contract.path).toBe("shared/contracts/AuthAPI.md");
  });

  test("missing manifest for a subdir is silently skipped", async () => {
    writeManifest("domains", [
      { name: "UserAuth", file: "UserAuth.md", tldr: "Auth domain", tags: ["auth"] },
    ]);
    // No other manifests

    const { logs, restore } = captureOutput();
    await runDeepSearch({ relicDir });
    restore();

    const results = JSON.parse(logs.join(""));
    expect(results.length).toBe(1);
  });
});
