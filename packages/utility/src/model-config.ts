export interface ModelConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  maxHistoryMessages: number;
  recentFullMessages: number;
  timeoutMs: number;
}

const MINIMUM_SCHEMA = JSON.stringify(
  { baseUrl: "http://localhost:11434", model: "llama3" },
  null,
  2
);

function requiredError(field: string, configPath: string): never {
  console.error(`Error: missing required field "${field}" in .relic/models.json`);
  console.error(`  Path: ${configPath}`);
  console.error(`  Minimum valid schema:\n${MINIMUM_SCHEMA}`);
  process.exit(1);
}

function validationError(field: string, value: unknown, constraint: string, configPath: string): never {
  console.error(`Error: invalid value for field "${field}" in .relic/models.json`);
  console.error(`  Value: ${JSON.stringify(value)}`);
  console.error(`  Constraint: ${constraint}`);
  console.error(`  Path: ${configPath}`);
  console.error(`  Minimum valid schema:\n${MINIMUM_SCHEMA}`);
  process.exit(1);
}

/**
 * Parse and validate a raw models.json object into a typed ModelConfig.
 * Applies env var overrides before validation. All errors exit non-zero
 * with an actionable message naming the field, invalid value, constraint,
 * and the path to models.json.
 */
export function parseModelConfig(
  raw: Record<string, unknown>,
  configPath: string
): ModelConfig {
  // Apply env var overrides (env takes precedence over file)
  const baseUrl = (process.env["RELIC_MODEL_BASE_URL"] ?? raw["baseUrl"] ?? "") as string;
  const model   = (process.env["RELIC_MODEL_MODEL"]    ?? raw["model"]   ?? "") as string;
  const apiKey  = (process.env["RELIC_MODEL_API_KEY"]  ?? raw["apiKey"]  ?? "") as string;

  if (!baseUrl) requiredError("baseUrl", configPath);
  if (!model)   requiredError("model", configPath);

  // Validate maxHistoryMessages
  const rawMax = raw["maxHistoryMessages"] ?? 20;
  if (typeof rawMax !== "number" || !Number.isInteger(rawMax) || rawMax <= 0) {
    validationError("maxHistoryMessages", rawMax, "must be a positive integer (> 0)", configPath);
  }
  const maxHistoryMessages = rawMax as number;

  // Validate recentFullMessages
  const rawRecent = raw["recentFullMessages"] ?? 2;
  if (typeof rawRecent !== "number" || !Number.isInteger(rawRecent) || rawRecent < 0) {
    validationError("recentFullMessages", rawRecent, "must be a non-negative integer (>= 0)", configPath);
  }
  if ((rawRecent as number) > maxHistoryMessages) {
    validationError(
      "recentFullMessages",
      rawRecent,
      `must not exceed maxHistoryMessages (currently ${maxHistoryMessages})`,
      configPath
    );
  }
  const recentFullMessages = rawRecent as number;

  // Validate timeoutMs
  const rawTimeout = raw["timeoutMs"] ?? 300_000;
  if (typeof rawTimeout !== "number" || !Number.isFinite(rawTimeout) || rawTimeout <= 0) {
    validationError("timeoutMs", rawTimeout, "must be a positive finite number (> 0)", configPath);
  }
  const timeoutMs = rawTimeout as number;

  return { baseUrl, model, apiKey, maxHistoryMessages, recentFullMessages, timeoutMs };
}
