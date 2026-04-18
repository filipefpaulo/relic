# ModelConfigContract

**Type:** contract
**Owned by:** 007-remote-ollama-engine

## Description

Schema for `.relic/models.json` — the project-local configuration file for direct model invocation. This file is gitignored and may contain API keys. The name `models.json` (rather than the narrower `invoke.json`) reflects the intended growth path toward multi-model and review-agent configurations.

## Schema

```json
{
  "baseUrl": "http://localhost:11434",
  "model": "llama3.2",
  "apiKey": "",
  "maxHistoryMessages": 20,
  "recentFullMessages": 2,
  "timeoutMs": 300000
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `baseUrl` | string | yes | Base URL of the OpenAI-compatible API. No trailing slash. |
| `model` | string | yes | Model identifier passed as `model` in the chat completions request. |
| `apiKey` | string | no | Bearer token. Defaults to empty string (Ollama does not require one). |
| `maxHistoryMessages` | number | no | Total history entries to retain. Oldest are dropped when this is exceeded. Defaults to 20. |
| `recentFullMessages` | number | no | How many of the most recent history entries to include at full length. Older entries are structurally compressed before being sent. Defaults to 2. |
| `timeoutMs` | number | no | Request timeout in milliseconds. Defaults to 300,000 (5 minutes) to accommodate LLM generation and transmission time. Overrides the `fetchWithTimeout` utility's standard 10s default. |

## Environment Variable Overrides

| Env var | Overrides |
|---|---|
| `RELIC_MODEL_BASE_URL` | `baseUrl` |
| `RELIC_MODEL_MODEL` | `model` |
| `RELIC_MODEL_API_KEY` | `apiKey` |

Env vars take precedence over `models.json` values. Enables CI usage without committed credentials.

## API Call Shape

`POST {baseUrl}/v1/chat/completions` with body:

```json
{
  "model": "<model>",
  "stream": true,
  "messages": [
    { "role": "system", "content": "<prompt template content>" },
    { "role": "user",   "content": "<assembled spec context + user arguments>" },
    ...prior conversation messages (up to maxHistoryMessages)...
  ]
}
```

- Prompt template content (`templates/prompts/<command>.md`) is always the `system` message.
- User arguments and assembled spec context are the `user` message for the current call.
- Prior conversation messages are prepended after the system message, up to `maxHistoryMessages` total entries.
- The most recent `recentFullMessages` history entries are included at full length. Older entries are run through the structural compressor (headings + bullets + first sentence of prose; code blocks dropped) before being included.
- `Authorization: Bearer <apiKey>` header is included only when `apiKey` is non-empty.

## Validation Rules

- `baseUrl` must be present and non-empty — error if missing.
- `model` must be present and non-empty — error if missing.
- Validation errors must be actionable: include the field name and the path to `models.json`.
