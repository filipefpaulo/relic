import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Capture the messages array sent on each callModel invocation.
// Must be declared before mock.module so the factory closure can reference it.
let capturedMessages: Array<{ role: string; content: string }>[] = [];

mock.module("@relic/engines", () => ({
  getPromptTemplate: (_name: string) => "# Mock system prompt",
  runAddEngine: () => {},
  SUPPORTED_ENGINES: [] as const,
}));

mock.module("../core/model-client.ts", () => ({
  callModel: async function* (opts: { messages: Array<{ role: string; content: string }> }) {
    capturedMessages.push(opts.messages);
    yield "mock response";
  },
}));

import { loadModelConfig, runModel } from "../core/model-runner.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockExitThrows() {
  return spyOn(process, "exit").mockImplementation((code?: number) => {
    throw new Error(`process.exit(${code ?? 0})`);
  }) as unknown as ReturnType<typeof spyOn>;
}

function silenceStderr() {
  return spyOn(console, "error").mockImplementation(() => {});
}

function silenceStdout() {
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  return () => { process.stdout.write = orig; };
}

function writeModelsJson(relicDir: string, config: Record<string, unknown>) {
  writeFileSync(join(relicDir, "models.json"), JSON.stringify(config));
}

function writeValidModelsJson(relicDir: string, overrides: Record<string, unknown> = {}) {
  writeModelsJson(relicDir, {
    baseUrl: "http://localhost:11434",
    model: "llama3",
    ...overrides,
  });
}

async function callRunModel(relicDir: string, extra: Partial<Parameters<typeof runModel>[0]> = {}) {
  writeValidModelsJson(relicDir);
  const restoreStdout = silenceStdout();
  try {
    await runModel({
      command: "specify",
      userMessage: "test message",
      relicDir,
      ...extra,
    });
  } finally {
    restoreStdout();
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let dir: string;
let relicDir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "relic-model-runner-test-"));
  relicDir = join(dir, ".relic");
  mkdirSync(join(relicDir, "specs"), { recursive: true });
  mkdirSync(join(relicDir, "fixes"), { recursive: true });
  capturedMessages = [];
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env["RELIC_MODEL_BASE_URL"];
  delete process.env["RELIC_MODEL_MODEL"];
  delete process.env["RELIC_MODEL_API_KEY"];
});

// ---------------------------------------------------------------------------
// loadModelConfig — config error UX
// ---------------------------------------------------------------------------

describe("loadModelConfig — config error UX", () => {
  test("exits when models.json is absent and no env vars are set", () => {
    const exit = mockExitThrows();
    const err = silenceStderr();
    try {
      expect(() => loadModelConfig(relicDir)).toThrow("process.exit(1)");
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });

  test("exits and names 'baseUrl' when field is missing", () => {
    writeModelsJson(relicDir, { model: "llama3" });
    const exit = mockExitThrows();
    const errors: string[] = [];
    const err = spyOn(console, "error").mockImplementation((msg: string) => errors.push(String(msg)));
    try {
      expect(() => loadModelConfig(relicDir)).toThrow("process.exit(1)");
      expect(errors.join(" ")).toContain("baseUrl");
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });

  test("exits and names 'model' when field is missing", () => {
    writeModelsJson(relicDir, { baseUrl: "http://localhost:11434" });
    const exit = mockExitThrows();
    const errors: string[] = [];
    const err = spyOn(console, "error").mockImplementation((msg: string) => errors.push(String(msg)));
    try {
      expect(() => loadModelConfig(relicDir)).toThrow("process.exit(1)");
      expect(errors.join(" ")).toContain("model");
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });

  test("includes models.json path in error output", () => {
    writeModelsJson(relicDir, { model: "llama3" });
    const exit = mockExitThrows();
    const errors: string[] = [];
    const err = spyOn(console, "error").mockImplementation((msg: string) => errors.push(String(msg)));
    try {
      expect(() => loadModelConfig(relicDir)).toThrow();
      expect(errors.join(" ")).toContain("models.json");
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// loadModelConfig — env var overrides
// ---------------------------------------------------------------------------

describe("loadModelConfig — env var overrides", () => {
  test("RELIC_MODEL_BASE_URL overrides baseUrl from file", () => {
    writeModelsJson(relicDir, { baseUrl: "http://file-value:11434", model: "llama3" });
    process.env["RELIC_MODEL_BASE_URL"] = "http://env-value:11434";
    const config = loadModelConfig(relicDir);
    expect(config.baseUrl).toBe("http://env-value:11434");
  });

  test("RELIC_MODEL_MODEL overrides model from file", () => {
    writeModelsJson(relicDir, { baseUrl: "http://localhost:11434", model: "llama3" });
    process.env["RELIC_MODEL_MODEL"] = "mistral";
    const config = loadModelConfig(relicDir);
    expect(config.model).toBe("mistral");
  });

  test("RELIC_MODEL_API_KEY overrides apiKey from file", () => {
    writeModelsJson(relicDir, { baseUrl: "http://localhost:11434", model: "llama3", apiKey: "file-key" });
    process.env["RELIC_MODEL_API_KEY"] = "env-key";
    const config = loadModelConfig(relicDir);
    expect(config.apiKey).toBe("env-key");
  });

  test("env vars satisfy missing file fields (no models.json required)", () => {
    // No models.json — env vars alone should suffice
    process.env["RELIC_MODEL_BASE_URL"] = "http://env-only:11434";
    process.env["RELIC_MODEL_MODEL"] = "gemma";
    const config = loadModelConfig(relicDir);
    expect(config.baseUrl).toBe("http://env-only:11434");
    expect(config.model).toBe("gemma");
  });
});

// ---------------------------------------------------------------------------
// loadModelConfig — numeric field validation
// ---------------------------------------------------------------------------

describe("loadModelConfig — numeric field validation", () => {
  test("maxHistoryMessages: 0 exits with error naming the field and constraint", () => {
    writeModelsJson(relicDir, { baseUrl: "http://localhost:11434", model: "llama3", maxHistoryMessages: 0 });
    const exit = mockExitThrows();
    const errors: string[] = [];
    const err = spyOn(console, "error").mockImplementation((msg: string) => errors.push(String(msg)));
    try {
      expect(() => loadModelConfig(relicDir)).toThrow("process.exit(1)");
      const combined = errors.join(" ");
      expect(combined).toContain("maxHistoryMessages");
      expect(combined).toContain("0");
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });

  test("maxHistoryMessages: -5 exits with error", () => {
    writeModelsJson(relicDir, { baseUrl: "http://localhost:11434", model: "llama3", maxHistoryMessages: -5 });
    const exit = mockExitThrows();
    const err = silenceStderr();
    try {
      expect(() => loadModelConfig(relicDir)).toThrow("process.exit(1)");
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });

  test("maxHistoryMessages: 1.5 (non-integer) exits with error", () => {
    writeModelsJson(relicDir, { baseUrl: "http://localhost:11434", model: "llama3", maxHistoryMessages: 1.5 });
    const exit = mockExitThrows();
    const err = silenceStderr();
    try {
      expect(() => loadModelConfig(relicDir)).toThrow("process.exit(1)");
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });

  test("recentFullMessages: -1 exits with error", () => {
    writeModelsJson(relicDir, { baseUrl: "http://localhost:11434", model: "llama3", recentFullMessages: -1 });
    const exit = mockExitThrows();
    const err = silenceStderr();
    try {
      expect(() => loadModelConfig(relicDir)).toThrow("process.exit(1)");
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });

  test("recentFullMessages > maxHistoryMessages exits with error", () => {
    writeModelsJson(relicDir, {
      baseUrl: "http://localhost:11434", model: "llama3",
      maxHistoryMessages: 5, recentFullMessages: 10,
    });
    const exit = mockExitThrows();
    const errors: string[] = [];
    const err = spyOn(console, "error").mockImplementation((msg: string) => errors.push(String(msg)));
    try {
      expect(() => loadModelConfig(relicDir)).toThrow("process.exit(1)");
      expect(errors.join(" ")).toContain("recentFullMessages");
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });

  test("timeoutMs: 0 exits with error", () => {
    writeModelsJson(relicDir, { baseUrl: "http://localhost:11434", model: "llama3", timeoutMs: 0 });
    const exit = mockExitThrows();
    const err = silenceStderr();
    try {
      expect(() => loadModelConfig(relicDir)).toThrow("process.exit(1)");
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });

  test("timeoutMs: -1000 exits with error", () => {
    writeModelsJson(relicDir, { baseUrl: "http://localhost:11434", model: "llama3", timeoutMs: -1000 });
    const exit = mockExitThrows();
    const err = silenceStderr();
    try {
      expect(() => loadModelConfig(relicDir)).toThrow("process.exit(1)");
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// loadModelConfig — defaults
// ---------------------------------------------------------------------------

describe("loadModelConfig — optional field defaults", () => {
  test("returns correct defaults for all optional fields", () => {
    writeValidModelsJson(relicDir);
    const config = loadModelConfig(relicDir);
    expect(config.maxHistoryMessages).toBe(20);
    expect(config.recentFullMessages).toBe(2);
    expect(config.timeoutMs).toBe(300_000);
    expect(config.apiKey).toBe("");
  });
});

// ---------------------------------------------------------------------------
// runModel — history persistence
// ---------------------------------------------------------------------------

describe("runModel — history persistence", () => {
  test("writes history.json after a call with specId", async () => {
    const specId = "001-test";
    mkdirSync(join(relicDir, "specs", specId), { recursive: true });
    await callRunModel(relicDir, { specId });

    const histPath = join(relicDir, "specs", specId, "history.json");
    expect(existsSync(histPath)).toBe(true);
    const history = JSON.parse(readFileSync(histPath, "utf8"));
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toBe("test message");
    expect(history[1].role).toBe("assistant");
    expect(history[1].content).toBe("mock response");
  });

  test("accumulates history across calls", async () => {
    const specId = "001-test";
    mkdirSync(join(relicDir, "specs", specId), { recursive: true });
    await callRunModel(relicDir, { specId, userMessage: "first call" });
    await callRunModel(relicDir, { specId, userMessage: "second call" });

    const history = JSON.parse(readFileSync(join(relicDir, "specs", specId, "history.json"), "utf8"));
    expect(history).toHaveLength(4); // 2 turns × 2 calls
    expect(history[0].content).toBe("first call");
    expect(history[2].content).toBe("second call");
  });

  test("resetContext clears history before the call", async () => {
    const specId = "001-test";
    mkdirSync(join(relicDir, "specs", specId), { recursive: true });
    // First call accumulates history
    await callRunModel(relicDir, { specId, userMessage: "pre-reset" });
    // Second call with resetContext clears before running
    await callRunModel(relicDir, { specId, userMessage: "post-reset", resetContext: true });

    const history = JSON.parse(readFileSync(join(relicDir, "specs", specId, "history.json"), "utf8"));
    expect(history).toHaveLength(2); // only the post-reset turn
    expect(history[0].content).toBe("post-reset");
  });

  test("does not write history.json when neither specId nor fixId is provided", async () => {
    // constitution / scan use case — no context ID
    await callRunModel(relicDir);
    expect(existsSync(join(relicDir, "history.json"))).toBe(false);
    // Verify no history.json was created anywhere under specs/
    const specsHasHistory = existsSync(join(relicDir, "specs"));
    if (specsHasHistory) {
      // specs dir exists but should have no subdirs with history files
      const { readdirSync } = await import("fs");
      const specDirs = readdirSync(join(relicDir, "specs"));
      for (const d of specDirs) {
        expect(existsSync(join(relicDir, "specs", d, "history.json"))).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// runModel — compression and trimming (in-flight messages)
// ---------------------------------------------------------------------------

describe("runModel — compression sent to model", () => {
  test("compresses entries older than recentFullMessages before sending to model", async () => {
    const specId = "001-test";
    mkdirSync(join(relicDir, "specs", specId), { recursive: true });
    // Seed 2 history entries
    const seed = [
      { role: "user", content: "First sentence. This second sentence should be dropped after compression." },
      { role: "assistant", content: "# Heading\nFull response body." },
    ];
    writeFileSync(join(relicDir, "specs", specId, "history.json"), JSON.stringify(seed));

    // recentFullMessages=0 → all existing history is "old" and will be compressed
    writeValidModelsJson(relicDir, { recentFullMessages: 0 });
    const restoreStdout = silenceStdout();
    try {
      await runModel({ command: "specify", userMessage: "new message", relicDir, specId });
    } finally {
      restoreStdout();
    }

    // messages: [system, compressed-user, compressed-assistant, new-user]
    const messages = capturedMessages[0]!;
    expect(messages).toBeDefined();
    const compressedUser = messages[1]!.content;
    expect(compressedUser).toContain("First sentence.");
    expect(compressedUser).not.toContain("This second sentence should be dropped after compression.");
    // Heading in assistant response is preserved
    const compressedAssistant = messages[2]!.content;
    expect(compressedAssistant).toContain("# Heading");
  });

  test("trims oldest entries when history exceeds maxHistoryMessages", async () => {
    const specId = "001-test";
    mkdirSync(join(relicDir, "specs", specId), { recursive: true });
    // Seed 4 entries; maxHistoryMessages=2 → only last 2 sent to model
    const seed = [
      { role: "user", content: "msg-0" },
      { role: "assistant", content: "reply-0" },
      { role: "user", content: "msg-1" },
      { role: "assistant", content: "reply-1" },
    ];
    writeFileSync(join(relicDir, "specs", specId, "history.json"), JSON.stringify(seed));

    writeValidModelsJson(relicDir, { maxHistoryMessages: 2, recentFullMessages: 2 });
    const restoreStdout = silenceStdout();
    try {
      await runModel({ command: "specify", userMessage: "new message", relicDir, specId });
    } finally {
      restoreStdout();
    }

    // messages: [system, msg-1, reply-1, new-user] (trimmed from 4 to last 2, then +user)
    const messages = capturedMessages[0]!;
    expect(messages).toBeDefined();
    const historySlice = messages.slice(1, -1); // strip system and final user
    expect(historySlice).toHaveLength(2);
    expect(historySlice[0]!.content).toBe("msg-1");
    expect(historySlice[1]!.content).toBe("reply-1");
  });
});

// ---------------------------------------------------------------------------
// runModel — solve regression
// ---------------------------------------------------------------------------

describe("runModel — solve regression", () => {
  test("does not write history.json when called without specId or fixId (solve path)", async () => {
    // This is the regression test for the bug fixed in this solve:
    // relic solve previously passed fixId to runModel, which caused the runner to resolve
    // a historyPath and write to it. After the fix, solve.ts calls runModel with neither
    // specId nor fixId — historyPath is null and no file is written.
    const specId = "001-test";
    mkdirSync(join(relicDir, "specs", specId), { recursive: true });
    const histPath = join(relicDir, "specs", specId, "history.json");

    // Simulate exactly what solve.ts now calls (no fixId, no specId)
    writeValidModelsJson(relicDir);
    const restoreStdout = silenceStdout();
    try {
      await runModel({
        command: "solve",
        userMessage: "fix document content here",
        relicDir,
        // intentionally omitting specId and fixId — this is the corrected solve behaviour
      });
    } finally {
      restoreStdout();
    }

    expect(existsSync(histPath)).toBe(false);
  });
});
