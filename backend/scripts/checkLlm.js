const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createChatCompletion } = require('../services/llmClient');

function providers() {
  return [...new Set([
    process.env.LLM_PROVIDER || 'openrouter',
    process.env.LLM_FALLBACK_PROVIDER,
  ].filter(Boolean).map((value) => value.toLowerCase()))];
}

function models(provider) {
  const configured = provider === 'groq'
    ? process.env.GROQ_MODELS
    : process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL;
  return (configured || '').split(',').map((model) => model.trim()).filter(Boolean);
}

async function check(provider, model) {
  const started = Date.now();
  try {
    await createChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    }, model, Date.now() + Number(process.env.CHATBOT_TIMEOUT_MS || 20000), provider);
    console.log(`${provider} ${model} status=ok latency_ms=${Date.now() - started}`);
  } catch (error) {
    console.log(`${provider} ${model} status=${error.status || 'network'} latency_ms=${Date.now() - started}`);
  }
}

(async () => {
  for (const provider of providers()) {
    for (const model of models(provider)) await check(provider, model);
  }
})().catch((error) => {
  console.error(`LLM diagnostics failed: ${error.message}`);
  process.exitCode = 1;
});
