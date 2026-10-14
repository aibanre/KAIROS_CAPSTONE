# Backend environment

## Chatbot provider

The chatbot uses `LLM_PROVIDER=openrouter` by default, preserving the existing
OpenRouter behavior. To use Groq, set `LLM_PROVIDER=groq`, provide
`GROQ_API_KEY`, and list ordered model IDs in `GROQ_MODELS`. Groq requests use
`GROQ_BASE_URL` (default `https://api.groq.com/openai/v1`) and the standard
OpenAI-compatible tools payload. Set `LLM_FALLBACK_PROVIDER=openrouter` to try
the configured OpenRouter models if all eligible Groq models fail.

`OPENROUTER_API_KEY`, `OPENROUTER_MODELS` (or legacy `OPENROUTER_MODEL`),
`OPENROUTER_BASE_URL`, and `OPENROUTER_SITE_URL` remain supported. Model
cooldowns are tracked separately for each provider and model. A maximum of three
eligible models is attempted per initial request, and the selected model stays
fixed through its tool loop. `CHATBOT_MAX_TOKENS`, `CHATBOT_TIMEOUT_MS`, and
`CHATBOT_MODEL_COOLDOWN_MS` apply to both providers.

At startup the backend logs the active provider, model IDs, and a boolean key
status only. It never logs API key values. Run `node scripts/checkLlm.js` from
`backend` to send a one-word diagnostic prompt to every configured model and
print only provider, model, status, and latency.
