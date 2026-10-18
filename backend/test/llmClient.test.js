const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createChatCompletionWithFallback,
  resetModelCooldowns,
} = require('../services/llmClient');

test('a Groq rate limit falls back to the configured OpenRouter provider', async () => {
  const previousEnv = {
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    LLM_FALLBACK_PROVIDER: process.env.LLM_FALLBACK_PROVIDER,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODELS: process.env.GROQ_MODELS,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODELS: process.env.OPENROUTER_MODELS,
  };
  const originalFetch = global.fetch;
  const calls = [];
  process.env.LLM_PROVIDER = 'groq';
  process.env.LLM_FALLBACK_PROVIDER = 'openrouter';
  process.env.GROQ_API_KEY = 'test-key';
  process.env.GROQ_MODELS = 'limited-model';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODELS = 'fallback-model';
  resetModelCooldowns();
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('api.groq.com')) {
      return {
        ok: false,
        status: 429,
        headers: { get: () => '0' },
        json: async () => ({ error: { message: 'Rate limit reached.' } }),
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Fallback response.' } }] }),
    };
  };

  try {
    const result = await createChatCompletionWithFallback(
      { messages: [{ role: 'user', content: 'Check availability.' }] },
      Date.now() + 5000,
    );
    assert.equal(result.provider, 'openrouter');
    assert.equal(result.model, 'fallback-model');
    assert.equal(result.data.choices[0].message.content, 'Fallback response.');
    assert.deepEqual(calls, [
      'https://api.groq.com/openai/v1/chat/completions',
      'https://openrouter.ai/api/v1/chat/completions',
    ]);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetModelCooldowns();
  }
});
