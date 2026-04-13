import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Stub runAddEngine before importing upgrade so the mock is in place at module load.
const runAddEngineMock = mock(async () => {});
mock.module("@relic/engines", () => ({
  runAddEngine: runAddEngineMock,
  SUPPORTED_ENGINES: ["claude", "copilot", "codex"],
}));

// Import after mock is registered.
const { runUpgrade } = await import("../commands/upgrade.ts");

let dir: string;
let relicDir: string;
let output: string[];
let consoleLogSpy: ReturnType<typeof spyOn>;
let consoleErrorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-upgrade-test-"));
  relicDir = join(dir, ".relic");
  mkdirSync(relicDir, { recursive: true });
  output = [];
  runAddEngineMock.mockClear();
  consoleLogSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    output.push(args.map(String).join(" "));
  });
  consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

describe("FR-4: dev channel", () => {
  test("outputs warning when channel is dev (default in test env)", async () => {
    await runUpgrade({
      check: false,
      promptsOnly: false,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
    });
    const joined = output.join("\n");
    expect(joined).toContain("INSTALL_CHANNEL");
  });

  test("does not call fetch when channel is dev", async () => {
    const fetchSpy = spyOn(globalThis, "fetch");
    await runUpgrade({
      check: false,
      promptsOnly: false,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("FR-14: missing engines.json", () => {
  test("--prompts emits FR-14 warning when engines.json is absent", async () => {
    await runUpgrade({
      check: false,
      promptsOnly: true,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
      _channel: "npm",
    });
    const result = JSON.parse(output[0]!);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("engines.json");
  });

  test("--prompts does not throw when engines.json is absent", async () => {
    await expect(
      runUpgrade({
        check: false,
        promptsOnly: true,
        text: false,
        currentVersion: "0.5.1",
        relicDir,
        _channel: "npm",
      })
    ).resolves.toBeUndefined();
  });

  test("--prompts does not call runAddEngine when engines.json is absent", async () => {
    await runUpgrade({
      check: false,
      promptsOnly: true,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
      _channel: "npm",
    });
    expect(runAddEngineMock).not.toHaveBeenCalled();
  });
});

describe("--check", () => {
  test("returns correct UpgradeCheckResult shape for npm channel", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "0.6.0" }), { status: 200 })
    );
    await runUpgrade({
      check: true,
      promptsOnly: false,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
      _channel: "npm",
    });
    fetchSpy.mockRestore();
    const result = JSON.parse(output[0]!);
    expect(result.current).toBe("0.5.1");
    expect(result.latest).toBe("0.6.0");
    expect(result.update_available).toBe(true);
    expect(result.channel).toBe("npm");
  });

  test("returns correct UpgradeCheckResult shape for pypi channel", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ info: { version: "0.6.0" } }), { status: 200 })
    );
    await runUpgrade({
      check: true,
      promptsOnly: false,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
      _channel: "pypi",
    });
    fetchSpy.mockRestore();
    const result = JSON.parse(output[0]!);
    expect(result.current).toBe("0.5.1");
    expect(result.latest).toBe("0.6.0");
    expect(result.update_available).toBe(true);
    expect(result.channel).toBe("pypi");
  });

  test("update_available is false when already at latest", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "0.5.1" }), { status: 200 })
    );
    await runUpgrade({
      check: true,
      promptsOnly: false,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
      _channel: "npm",
    });
    fetchSpy.mockRestore();
    const result = JSON.parse(output[0]!);
    expect(result.update_available).toBe(false);
    expect(result.latest).toBe("0.5.1");
  });

  test("update_available is false when installed version is ahead (pre-release)", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "0.5.1" }), { status: 200 })
    );
    await runUpgrade({
      check: true,
      promptsOnly: false,
      text: false,
      currentVersion: "0.6.0",
      relicDir,
      _channel: "npm",
    });
    fetchSpy.mockRestore();
    const result = JSON.parse(output[0]!);
    expect(result.update_available).toBe(false);
  });
});

describe("--prompts with populated engines.json", () => {
  test("calls runAddEngine for each registered engine", async () => {
    writeFileSync(join(relicDir, "engines.json"), JSON.stringify(["claude", "copilot"]));
    await runUpgrade({
      check: false,
      promptsOnly: true,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
      _channel: "npm",
    });
    expect(runAddEngineMock).toHaveBeenCalledTimes(2);
    expect(runAddEngineMock).toHaveBeenCalledWith(
      expect.objectContaining({ engine: "claude" })
    );
    expect(runAddEngineMock).toHaveBeenCalledWith(
      expect.objectContaining({ engine: "copilot" })
    );
  });

  test("hooks_refreshed lists all registered engines", async () => {
    writeFileSync(join(relicDir, "engines.json"), JSON.stringify(["claude", "copilot"]));
    await runUpgrade({
      check: false,
      promptsOnly: true,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
      _channel: "npm",
    });
    const result = JSON.parse(output[0]!);
    expect(result.hooks_refreshed).toEqual(["claude", "copilot"]);
    expect(result.warnings).toEqual([]);
  });

  test("unknown engine in engines.json emits warning and skips runAddEngine", async () => {
    writeFileSync(join(relicDir, "engines.json"), JSON.stringify(["claude", "unknown-bot"]));
    await runUpgrade({
      check: false,
      promptsOnly: true,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
      _channel: "npm",
    });
    const result = JSON.parse(output[0]!);
    expect(result.hooks_refreshed).toEqual(["claude"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("unknown-bot");
    expect(runAddEngineMock).toHaveBeenCalledTimes(1);
  });

  test("--prompts with missing engines.json: warnings contain engines.json message, hooks_refreshed is empty", async () => {
    await runUpgrade({
      check: false,
      promptsOnly: true,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
      _channel: "npm",
    });
    const result = JSON.parse(output[0]!);
    expect(result.hooks_refreshed).toEqual([]);
    expect(result.warnings.some((w: string) => w.includes("engines.json"))).toBe(true);
  });
});

describe("already up to date — consistent UpgradeResult shape", () => {
  test("returns full UpgradeResult shape (not ad-hoc) when already at latest", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "0.5.1" }), { status: 200 })
    );
    await runUpgrade({
      check: false,
      promptsOnly: false,
      text: false,
      currentVersion: "0.5.1",
      relicDir,
      _channel: "npm",
    });
    fetchSpy.mockRestore();
    const result = JSON.parse(output[0]!);
    expect(result).toHaveProperty("check");
    expect(result).toHaveProperty("binary_upgraded", false);
    expect(result).toHaveProperty("hooks_refreshed");
    expect(result).toHaveProperty("preamble_updated");
    expect(result).toHaveProperty("warnings");
  });
});
