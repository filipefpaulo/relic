# OllamaOpenAICompat

**Type:** assumption
**Owned by:** 007-remote-ollama-engine
**Confidence:** high

## Description

Ollama exposes an OpenAI-compatible REST API at `/v1/chat/completions`. The `relic invoke` implementation targets this endpoint format rather than Ollama's native API. This means `relic invoke` works with any server that speaks the OpenAI completions protocol (LM Studio, vLLM, LocalAI, OpenAI itself, etc.) — Ollama is the primary use case but not the only one.

## Risk if wrong

- If Ollama drops or breaks their OpenAI compatibility layer, `relic invoke` would fail silently or produce malformed responses.
- Some Ollama models do not reliably respect the `system` message role — prompt framing may need adjustment per model.

## Staleness signal

- If Ollama changes their API shape in a major version upgrade.
- If user feedback shows consistent issues with system message handling on certain model families (llama, mistral, etc.).

## SSH Tunneling Assumption

Users running Ollama on a remote machine are expected to set up SSH port forwarding themselves:

```bash
ssh -L 11434:localhost:11434 user@remote-host
```

After this, `baseUrl: "http://localhost:11434"` in `invoke.json` reaches the remote Ollama instance. Relic does not manage SSH connections.
