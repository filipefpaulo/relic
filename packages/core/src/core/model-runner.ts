import { join } from "path";
import { fileExists, readJson, writeJson, readText } from "@relic/utility";
import { getPromptTemplate } from "@relic/engines";
import { compressMessage } from "./history-compressor.ts";
import { callModel } from "./model-client.ts";

export interface ModelConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  maxHistoryMessages: number;
  recentFullMessages: number;
  timeoutMs: number;
}

interface RawModelConfig {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  maxHistoryMessages?: number;
  recentFullMessages?: number;
  timeoutMs?: number;
}

const MINIMUM_SCHEMA = JSON.stringify(
  { baseUrl: "http://localhost:11434", model: "llama3" },
  null,
  2
);

export function loadModelConfig(relicDir: string): ModelConfig {
  const configPath = join(relicDir, "models.json");

  let raw: RawModelConfig = {};
  if (fileExists(configPath)) {
    try {
      raw = readJson<RawModelConfig>(configPath);
    } catch {
      console.error(`Error: could not parse .relic/models.json`);
      console.error(`Path: ${configPath}`);
      console.error(`Minimum valid schema:\n${MINIMUM_SCHEMA}`);
      process.exit(1);
    }
  }

  // Apply env var overrides
  const baseUrl = process.env["RELIC_MODEL_BASE_URL"] ?? raw.baseUrl ?? "";
  const model = process.env["RELIC_MODEL_MODEL"] ?? raw.model ?? "";
  const apiKey = process.env["RELIC_MODEL_API_KEY"] ?? raw.apiKey ?? "";

  if (!baseUrl) {
    console.error(`Error: missing required field "baseUrl" in .relic/models.json`);
    console.error(`Path: ${configPath}`);
    console.error(`Minimum valid schema:\n${MINIMUM_SCHEMA}`);
    process.exit(1);
  }

  if (!model) {
    console.error(`Error: missing required field "model" in .relic/models.json`);
    console.error(`Path: ${configPath}`);
    console.error(`Minimum valid schema:\n${MINIMUM_SCHEMA}`);
    process.exit(1);
  }

  return {
    baseUrl,
    model,
    apiKey,
    maxHistoryMessages: raw.maxHistoryMessages ?? 20,
    recentFullMessages: raw.recentFullMessages ?? 2,
    timeoutMs: raw.timeoutMs ?? 300_000,
  };
}

export interface RunModelOptions {
  command: string;
  userMessage: string;
  relicDir: string;
  specId?: string;
  fixId?: string;
  noStream?: boolean;
  resetContext?: boolean;
}

type HistoryEntry = { role: "user" | "assistant"; content: string };

function resolveHistoryPath(relicDir: string, specId?: string, fixId?: string): string | null {
  if (specId) {
    return join(relicDir, "specs", specId, "history.json");
  }
  if (fixId) {
    const fixPath = join(relicDir, "fixes", `${fixId}.md`);
    if (!fileExists(fixPath)) return null;
    const fixContent = readText(fixPath);
    // Extract "**Owning spec:**" field from fix document
    const match = fixContent.match(/\*\*Owning spec:\*\*\s*([^\n]+)/);
    const owningSpec = match?.[1]?.trim();
    if (!owningSpec) return null;
    return join(relicDir, "specs", owningSpec, "history.json");
  }
  return null;
}

export async function runModel(options: RunModelOptions): Promise<void> {
  const { command, userMessage, relicDir, specId, fixId, noStream = false, resetContext = false } = options;

  // Step 1: load config
  const config = loadModelConfig(relicDir);

  // Step 2: load prompt template
  const template = getPromptTemplate(command);
  if (template === undefined) {
    console.error(`Error: no prompt template found for command "${command}"`);
    console.error(`Expected: templates/prompts/${command}.md (embedded at build time)`);
    process.exit(1);
  }

  // Step 3: determine history path
  const historyPath = resolveHistoryPath(relicDir, specId, fixId);

  // Step 4: reset context if requested
  if (resetContext && historyPath && fileExists(historyPath)) {
    writeJson(historyPath, []);
  }

  // Step 5: load history
  let history: HistoryEntry[] = [];
  if (historyPath && fileExists(historyPath)) {
    try {
      history = readJson<HistoryEntry[]>(historyPath);
    } catch {
      history = [];
    }
  }

  // Step 6: apply compression
  const { maxHistoryMessages, recentFullMessages } = config;
  const recentStart = Math.max(0, history.length - recentFullMessages);
  const compressed: HistoryEntry[] = history.map((entry, i) => {
    if (i < recentStart) {
      return { role: entry.role, content: compressMessage(entry.content) };
    }
    return entry;
  });

  // Drop oldest if exceeding maxHistoryMessages
  const trimmed = compressed.length > maxHistoryMessages
    ? compressed.slice(compressed.length - maxHistoryMessages)
    : compressed;

  // Step 7: build messages
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: template },
    ...trimmed,
    { role: "user", content: userMessage },
  ];

  // Step 8: call model and stream to stdout
  let fullResponse = "";
  try {
    for await (const chunk of callModel({
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey || undefined,
      messages,
      stream: !noStream,
      timeoutMs: config.timeoutMs,
    })) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }
    // Ensure trailing newline
    if (fullResponse && !fullResponse.endsWith("\n")) {
      process.stdout.write("\n");
    }
  } catch (err) {
    console.error(`Error calling model: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Step 9: persist history (skip if no history path or for solve command)
  if (historyPath) {
    const updated: HistoryEntry[] = [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: fullResponse },
    ];
    try {
      writeJson(historyPath, updated);
    } catch {
      // non-fatal — don't crash if history write fails
    }
  }
}
