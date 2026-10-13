import OpenAI from 'openai';
import { config, AppError } from '../config.js';
// Responses + structured outputs; lowest published per-token price first.
// GPT-5 nano: $0.05 input / $0.40 output per 1M tokens (checked 2026-10-13).
export const fallbackModels = ['gpt-5-nano', 'gpt-4.1-nano', 'gpt-5-mini'];
type ModelList = { models: string[]; warning: string | null; source: 'openai' | 'fallback'; authenticationFailed: boolean };
function fallback(warning: string | null, authenticationFailed = false): ModelList {
  return { models: [...fallbackModels], warning, source: 'fallback', authenticationFailed };
}
function discoveryFailure(error: unknown): ModelList {
  const { status, code } = (error || {}) as { status?: number; code?: string };
  let reason: string;
  if (status === 401 || code === 'invalid_api_key') {
    return fallback('OpenAI rejected OPENAI_API_KEY (401). Replace the key in .env and restart the server. Showing built-in models; generation requires a valid key.', true);
  }
  if (status === 403) reason = 'Your API key does not have permission to list OpenAI models (403).';
  else if (status === 429) reason = 'OpenAI rate-limited model discovery (429).';
  else reason = 'Could not connect to OpenAI to discover models. Check your network connection.';
  return fallback(`${reason} Showing built-in text models instead. Model access will be checked when you generate.`);
}
let cache: { models: string[]; expires: number } | undefined;
export async function listModels(): Promise<ModelList> {
  if (!config.apiKey) return fallback(null);
  if (cache && cache.expires > Date.now()) return { models: cache.models, warning: null, source: 'openai', authenticationFailed: false };
  try {
    const client = new OpenAI({ apiKey: config.apiKey, timeout: 12000, maxRetries: 0 });
    const result = await client.models.list();
    // Keep every ID returned by OpenAI, including new families and fine-tuned models.
    // The model catalogue does not report Responses/structured-output compatibility.
    const models = [...new Set(result.data.map(m => m.id))].sort();
    if (!models.length) return fallback('OpenAI returned no models for this API key. Showing built-in text models instead; availability depends on your project access.');
    cache = { models, expires: Date.now() + 300000 };
    return { models, warning: null, source: 'openai', authenticationFailed: false };
  } catch (error) { return discoveryFailure(error); }
}
export async function validateModel(model: string) {
  if (!config.apiKey) throw new AppError(503, 'Add OPENAI_API_KEY to .env and restart the server to generate documents.');
  const result = await listModels();
  if (result.authenticationFailed) throw new AppError(503, result.warning!);
  if (!result.models.includes(model)) throw new AppError(400, 'Choose an available model from the model selector.');
}
