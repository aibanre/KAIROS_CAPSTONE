const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const failedModels = new Map();

class OpenRouterError extends Error {
  constructor(message, status = 503, model = null, retryAfterMs = 0) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.model = model;
    this.retryAfterMs = retryAfterMs;
  }
}

function settings() {
  const configured = process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001:free';
  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    models: configured.split(',').map((model) => model.trim()).filter(Boolean),
    baseUrl: (process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    siteUrl: process.env.OPENROUTER_SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
    maxTokens: Number(process.env.CHATBOT_MAX_TOKENS || 800),
    timeoutMs: Number(process.env.CHATBOT_TIMEOUT_MS || 20000),
    cooldownMs: Number(process.env.CHATBOT_MODEL_COOLDOWN_MS || 300000),
  };
}

function parseRetryAfter(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

function isRetryable(status) {
  return status === 402 || status === 404 || status === 429 || status >= 500;
}

function availableModels(models, now = Date.now()) {
  return models.filter((model) => (failedModels.get(model)?.until || 0) <= now);
}

function markFailed(model, retryAfterMs, cooldownMs) {
  const until = Date.now() + Math.max(cooldownMs, retryAfterMs);
  failedModels.set(model, { until });
}

async function requestModel(payload, model, timeoutMs) {
  const config = settings();
  if (!config.apiKey) {
    console.error('[openrouter] API key is not configured');
    throw new OpenRouterError('OpenRouter is unavailable.', 503, model);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': config.siteUrl,
        'X-Title': 'Kai Azul',
      },
      body: JSON.stringify({ ...payload, model, max_tokens: config.maxTokens }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new OpenRouterError('OpenRouter request failed.', response.status, model, parseRetryAfter(response.headers.get('retry-after')));
    }
    if (!data?.choices?.[0]?.message) {
      throw new OpenRouterError('OpenRouter returned an empty response.', 503, model);
    }
    return data;
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
    if (error.name === 'AbortError') throw new OpenRouterError('OpenRouter request timed out.', 503, model);
    throw new OpenRouterError('OpenRouter network failure.', 503, model);
  } finally {
    clearTimeout(timer);
  }
}

async function createChatCompletionWithFallback(payload, deadline = Date.now() + settings().timeoutMs) {
  const config = settings();
  const models = availableModels(config.models);
  if (!models.length) {
    console.warn('[openrouter] all configured models are cooling down');
    throw new OpenRouterError('OpenRouter models are temporarily unavailable.', 503);
  }
  let attempts = 0;
  let lastError = null;
  for (const model of models) {
    if (attempts >= 3) break;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    attempts += 1;
    try {
      const data = await requestModel(payload, model, remaining);
      console.info('[openrouter] model answered:', model);
      return { data, model };
    } catch (error) {
      lastError = error;
      console.warn('[openrouter] model failed:', model, `status=${error.status || 'network'}`);
      if (error.status === 401 || (error.status >= 400 && !isRetryable(error.status))) {
        if (error.status === 400) throw error;
        throw new OpenRouterError('OpenRouter is unavailable.', 503, model);
      }
      markFailed(model, error.retryAfterMs, config.cooldownMs);
    }
  }
  throw new OpenRouterError('OpenRouter is unavailable.', 503, lastError?.model || null);
}

async function createChatCompletion(payload, model, deadline = Date.now() + settings().timeoutMs) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new OpenRouterError('OpenRouter request timed out.', 503, model);
  try {
    const data = await requestModel(payload, model, remaining);
    console.info('[openrouter] model answered:', model);
    return data;
  } catch (error) {
    console.warn('[openrouter] model failed:', model, `status=${error.status || 'network'}`);
    throw error;
  }
}

function resetModelCooldowns() {
  failedModels.clear();
}

module.exports = {
  createChatCompletion,
  createChatCompletionWithFallback,
  OpenRouterError,
  resetModelCooldowns,
  _failedModels: failedModels,
};
