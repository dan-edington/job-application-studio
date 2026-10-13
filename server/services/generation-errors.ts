import { NoObjectGeneratedError } from 'ai';
import { AppError } from '../config.js';

type ErrorRecord = { name?: string; statusCode?: number; status?: number; code?: string; data?: { error?: { code?: string } }; cause?: unknown; lastError?: unknown };

export function generationFailure(error: unknown, context: { model: string; stage: string; elapsedMs: number; timeoutMs: number; timedOut: boolean }) {
  // Retry wrappers can hide the actual HTTP error in lastError or cause.
  const chain: ErrorRecord[] = [];
  let current: unknown = error;
  while (current && typeof current === 'object' && !chain.includes(current) && chain.length < 8) {
    const item = current as ErrorRecord;
    chain.push(item);
    current = item.lastError ?? item.cause;
  }
  const status = chain.map(item => item.statusCode ?? item.status).find(value => typeof value === 'number');
  const hasCode = (code: string) => chain.some(item => item.code === code || item.data?.error?.code === code);
  const invalidOutput = chain.find(NoObjectGeneratedError.isInstance);
  let category: string;
  let httpStatus = 502;
  let message: string;
  if (context.timedOut || chain.some(item => item.name === 'TimeoutError' || item.name === 'AbortError')) {
    category = 'timeout'; httpStatus = 504;
    message = `OpenAI timed out while ${context.stage} after ${Math.round(context.timeoutMs / 1000)} seconds. Retry or choose another model. The server time limit can be changed with OPENAI_TIMEOUT_MS.`;
  } else if (status === 401 || hasCode('invalid_api_key')) {
    category = 'authentication'; httpStatus = 503;
    message = 'OpenAI rejected the API key. Update OPENAI_API_KEY in .env and restart the server.';
  } else if (hasCode('insufficient_quota')) {
    category = 'quota'; httpStatus = 429;
    message = 'OpenAI reported insufficient quota for the API project. Check that project’s billing and spending limits.';
  } else if (status === 429) {
    category = 'rate_limit'; httpStatus = 429;
    message = 'OpenAI rate-limited this request. Wait a moment and try again.';
  } else if (status === 403 || status === 404) {
    category = 'model_access';
    message = 'OpenAI denied access to the selected model or could not find it. Choose another available text model.';
  } else if (status === 400 || status === 422) {
    category = 'request_rejected';
    message = 'OpenAI rejected the generation request or its structured-output format. Try another text model; see the server diagnostics for the failed stage.';
  } else if (invalidOutput) {
    category = invalidOutput.finishReason === 'length' ? 'output_limit' : 'invalid_output';
    message = invalidOutput.finishReason === 'length'
      ? 'OpenAI reached its output limit before completing the documents. Please try again or choose another model.'
      : 'OpenAI returned output that did not match the required document structure. Please try again or choose another model.';
  } else if (status && status >= 500) {
    category = 'provider_unavailable';
    message = 'OpenAI is temporarily unable to complete the request. Please try again shortly.';
  } else {
    category = 'connection_or_sdk';
    message = 'The OpenAI request failed before a usable response was received. Retry and check the server diagnostics if it continues.';
  }
  // Never log raw error objects: SDK errors can contain API keys, prompts and CVs.
  return {
    error: new AppError(httpStatus, `${message} No changes were saved.`),
    diagnostics: { category, model: context.model, stage: context.stage, elapsedMs: context.elapsedMs, providerStatus: status ?? null },
  };
}
