const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const cooldowns = new Map();
const unavailableModels = new Map();
let lastKeyRejectionLogAt = 0;

class OpenRouterError extends Error {
  constructor(message, status = 503, model = null, retryAfterMs = 0, provider = null, detail = '') {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.model = model;
    this.retryAfterMs = retryAfterMs;
    this.provider = provider;
    this.detail = detail;
  }
}

function providerSettings(provider = process.env.LLM_PROVIDER || 'openrouter') {
  const normalized = provider.toLowerCase();
  const isGroq = normalized === 'groq';
  const configured = isGroq
    ? process.env.GROQ_MODELS
    : process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL;
  return {
    provider: normalized,
    apiKey: isGroq ? process.env.GROQ_API_KEY : process.env.OPENROUTER_API_KEY,
    models: (configured || (isGroq ? 'llama-3.3-70b-versatile' : 'google/gemini-2.0-flash-001:free'))
      .split(',').map((model) => model.trim()).filter(Boolean),
    baseUrl: (isGroq ? (process.env.GROQ_BASE_URL || DEFAULT_GROQ_BASE_URL)
      : (process.env.OPENROUTER_BASE_URL || DEFAULT_OPENROUTER_BASE_URL)).replace(/\/$/, ''),
    siteUrl: process.env.OPENROUTER_SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
    maxTokens: Number(process.env.CHATBOT_MAX_TOKENS || 800),
    timeoutMs: Number(process.env.CHATBOT_TIMEOUT_MS || 20000),
    cooldownMs: Number(process.env.CHATBOT_MODEL_COOLDOWN_MS || 300000),
  };
}

function configuredProviders() {
  const primary = (process.env.LLM_PROVIDER || 'openrouter').toLowerCase();
  const fallback = (process.env.LLM_FALLBACK_PROVIDER || '').toLowerCase();
  return [primary, fallback].filter((provider, index, list) => provider && list.indexOf(provider) === index);
}

function parseRetryAfter(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

function modelKey(provider, model) {
  return `${provider}:${model}`;
}

function availableModels(config, now = Date.now()) {
  return config.models.filter((model) => !unavailableModels.get(modelKey(config.provider, model))
    && (cooldowns.get(modelKey(config.provider, model))?.until || 0) <= now);
}

function markFailed(provider, model, retryAfterMs, cooldownMs) {
  const delay = retryAfterMs > 0 ? retryAfterMs : cooldownMs;
  const until = Date.now() + Math.min(cooldownMs, delay);
  cooldowns.set(modelKey(provider, model), { until });
}

function markUnavailable(provider, model) {
  const key = modelKey(provider, model);
  if (!unavailableModels.has(key)) {
    unavailableModels.set(key, true);
    console.warn(`[llm] ${provider} model unavailable: ${model}`);
  }
}

function isTooLarge(error) {
  return error.status === 413 || /request too large|token.?per.?minute|tokens per minute/i.test(error.detail || '');
}

function compactMessages(messages) {
  if (!Array.isArray(messages)) return messages;
  const system = messages.find((message) => message.role === 'system');
  const latestUser = [...messages].reverse().find((message) => message.role === 'user');
  return [system, latestUser].filter(Boolean);
}

function logKeyRejected(provider) {
  if (provider !== 'groq' || Date.now() - lastKeyRejectionLogAt < 60000) return;
  lastKeyRejectionLogAt = Date.now();
  console.error('[llm] Groq key rejected');
}

async function requestModel(payload, model, provider, timeoutMs) {
  const config = providerSettings(provider);
  if (!config.apiKey) {
    console.error(`[llm] ${provider} API key is not configured`);
    throw new OpenRouterError('LLM provider is unavailable.', 503, model, 0, provider);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  const headers = { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };
  if (provider !== 'groq') {
    headers['HTTP-Referer'] = config.siteUrl;
    headers['X-Title'] = 'Kai Azul';
  }
  try {
    const { models: _models, provider: _provider, transforms: _transforms, route: _route, usage: _usage, ...standardPayload } = payload;
    const requestPayload = provider === 'groq'
      ? { ...standardPayload, model, max_tokens: config.maxTokens, temperature: 0.3, tool_choice: 'auto' }
      : { ...payload, model, max_tokens: config.maxTokens };
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST', headers, body: JSON.stringify(requestPayload), signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || data?.error?.code || '';
      const retryAfterMs = provider === 'groq' && response.status === 429
        ? Math.min(config.cooldownMs, Math.max(5000, parseRetryAfter(response.headers.get('retry-after'))))
        : parseRetryAfter(response.headers.get('retry-after'));
      throw new OpenRouterError('LLM request failed.', response.status, model, retryAfterMs, provider, detail);
    }
    if (!data?.choices?.[0]?.message) throw new OpenRouterError('LLM returned an empty response.', 503, model, 0, provider);
    return data;
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
    if (error.name === 'AbortError') throw new OpenRouterError('LLM request timed out.', 503, model, 0, provider);
    throw new OpenRouterError('LLM network failure.', 503, model, 0, provider);
  } finally {
    clearTimeout(timer);
  }
}

async function tryProvider(payload, provider, deadline, attemptsLeft) {
  const config = providerSettings(provider);
  const models = availableModels(config);
  if (!models.length) return { error: new OpenRouterError('LLM models are temporarily unavailable.', 503, null, 0, provider), attempts: 0 };
  let attempts = 0;
  let lastError = null;
  for (const model of models) {
    if (attempts >= attemptsLeft || deadline <= Date.now()) break;
    attempts += 1;
    try {
      const data = await requestModel(payload, model, provider, deadline - Date.now());
      console.info(`[llm] ${provider} model answered: ${model}`);
      return { data, model, provider, attempts };
    } catch (error) {
      lastError = error;
      console.warn(`[llm] ${provider} model failed: ${model} status=${error.status || 'network'}`);
      if (provider === 'groq' && error.status === 429) {
        console.warn(`[llm] groq rate limited model=${model} retry-after=${error.retryAfterMs}ms`);
      }
      if (error.status === 401 || error.status === 403) {
        logKeyRejected(provider);
        markFailed(provider, model, 0, config.cooldownMs);
        continue;
      }
      if (error.status === 404) {
        markUnavailable(provider, model);
        continue;
      }
      if (provider === 'groq' && error.status === 400 && /tool_use_failed/i.test(error.detail || '')) {
        markFailed(provider, model, 0, config.cooldownMs);
        continue;
      }
      if (provider === 'groq' && isTooLarge(error) && payload?.messages) {
        try {
          if (deadline <= Date.now()) break;
          const trimmed = { ...payload, messages: compactMessages(payload.messages) };
          const data = await requestModel(trimmed, model, provider, deadline - Date.now());
          console.info(`[llm] ${provider} model answered: ${model}`);
          return { data, model, provider, attempts };
        } catch (trimError) {
          lastError = trimError;
        }
      }
      markFailed(provider, model, error.retryAfterMs, config.cooldownMs);
    }
  }
  return { error: lastError || new OpenRouterError('LLM is unavailable.', 503, null, 0, provider), attempts };
}

async function createChatCompletionWithFallback(payload, deadline = Date.now() + providerSettings().timeoutMs) {
  let attemptsLeft = 3;
  let lastError = null;
  for (const provider of configuredProviders()) {
    if (attemptsLeft <= 0 || deadline <= Date.now()) break;
    const result = await tryProvider(payload, provider, deadline, attemptsLeft);
    if (result.data) return result;
    attemptsLeft -= result.attempts;
    lastError = result.error;
  }
  throw new OpenRouterError('LLM is unavailable.', 503, lastError?.model || null, 0, lastError?.provider || null);
}

async function createChatCompletion(payload, model, deadline = Date.now() + providerSettings().timeoutMs, provider = process.env.LLM_PROVIDER || 'openrouter') {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new OpenRouterError('LLM request timed out.', 503, model, 0, provider);
  try {
    const data = await requestModel(payload, model, provider, remaining);
    console.info(`[llm] ${provider} model answered: ${model}`);
    return data;
  } catch (error) {
    console.warn(`[llm] ${provider} model failed: ${model} status=${error.status || 'network'}`);
    throw error;
  }
}

function logStartupConfig() {
  for (const provider of configuredProviders()) {
    const config = providerSettings(provider);
    console.info(`[llm] active provider=${provider} models=${config.models.join(',')} key_set=${Boolean(config.apiKey)}`);
  }
  if ((process.env.LLM_PROVIDER || 'openrouter').toLowerCase() === 'groq' && !process.env.GROQ_API_KEY) {
    console.warn('[llm] Groq provider selected but GROQ_API_KEY is empty');
  }
}

function resetModelCooldowns() {
  cooldowns.clear();
  unavailableModels.clear();
}

module.exports = {
  createChatCompletion,
  createChatCompletionWithFallback,
  OpenRouterError,
  resetModelCooldowns,
  logStartupConfig,
  _failedModels: cooldowns,
};
