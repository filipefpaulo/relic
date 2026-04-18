import { fetchWithTimeout } from "@relic/utility";

export interface ModelCallOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

export async function* callModel(options: ModelCallOptions): AsyncGenerator<string> {
  const { baseUrl, model, apiKey, messages, stream = true, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const url = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const body = JSON.stringify({ model, messages, stream });

  const response = await fetchWithTimeout(url, timeoutMs, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Model API error ${response.status}: ${text}`);
  }

  if (!stream) {
    const json = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = json.choices[0]?.message?.content ?? "";
    yield content;
    return;
  }

  // Streaming SSE
  const body_ = response.body;
  if (!body_) throw new Error("Response body is null");

  const reader = body_.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as { choices: Array<{ delta: { content?: string } }> };
        const chunk = parsed.choices[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
}
