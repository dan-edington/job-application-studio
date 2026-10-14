import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generationFailure } from '../server/services/generation-errors';
import { NoObjectGeneratedError } from 'ai';
import { fixture } from './fixtures';
import { config } from '../server/config';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: generate,
}));
import { analyseJob } from '../server/services/agent';

const context = {
  model: 'gpt-5-nano',
  stage: 'writing documents',
  elapsedMs: 300001,
  timeoutMs: 300000,
  timedOut: false,
};
beforeEach(() => generate.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('generation error reporting', () => {
  it('reports the actual deadline as a timeout rather than a key or billing issue', () => {
    const failure = generationFailure(new Error('Aborted'), {
      ...context,
      timedOut: true,
    });
    expect(failure.error.status).toBe(504);
    expect(failure.error.message).toContain(
      'writing documents after 300 seconds',
    );
    expect(failure.error.message).not.toMatch(/API key|billing/);
    expect(failure.diagnostics.category).toBe('timeout');
  });
  it.each([
    [{ statusCode: 401 }, 'authentication', 503],
    [{ lastError: { statusCode: 429 } }, 'rate_limit', 429],
    [
      {
        cause: {
          lastError: {
            statusCode: 429,
            data: { error: { code: 'insufficient_quota' } },
          },
        },
      },
      'quota',
      429,
    ],
    [{ statusCode: 403 }, 'model_access', 502],
    [{ statusCode: 400 }, 'request_rejected', 502],
    [{ lastError: { statusCode: 503 } }, 'provider_unavailable', 502],
    [{ cause: { name: 'TimeoutError' } }, 'timeout', 504],
    [new TypeError('fetch failed'), 'connection_or_sdk', 502],
  ])(
    'classifies wrapped errors without discarding their cause',
    (error, category, status) => {
      const failure = generationFailure(error, context);
      expect(failure.diagnostics.category).toBe(category);
      expect(failure.error.status).toBe(status);
      expect(failure.error.message).toContain('No changes were saved.');
    },
  );
  it.each(['length', 'stop'] as const)(
    'distinguishes invalid or truncated model output (%s)',
    (finishReason) => {
      const error = new NoObjectGeneratedError({
        text: 'PRIVATE_GENERATED_TEXT',
        response: {
          id: 'response',
          modelId: fixture.model,
          timestamp: new Date(),
        },
        usage: {} as never,
        finishReason,
      });
      const failure = generationFailure(error, context);
      expect(failure.diagnostics.category).toBe(
        finishReason === 'length' ? 'output_limit' : 'invalid_output',
      );
      expect(JSON.stringify(failure)).not.toContain('PRIVATE_GENERATED_TEXT');
    },
  );
  it('does not include provider secrets, prompts or full errors in diagnostics', () => {
    const error = {
      statusCode: 400,
      message: 'PRIVATE_ERROR_MESSAGE',
      requestBodyValues: { input: 'PRIVATE_CAREER' },
      responseBody: 'PRIVATE_BODY',
      requestHeaders: { Authorization: 'PRIVATE_KEY' },
    };
    const failure = generationFailure(error, context);
    expect(JSON.stringify(failure)).not.toContain('PRIVATE_');
    expect(failure.diagnostics.providerStatus).toBe(400);
  });
  it('handles circular error causes', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(generationFailure(error, context).diagnostics.category).toBe(
      'connection_or_sdk',
    );
  });
});

describe('generation request configuration', () => {
  it.each([
    'gpt-5-nano',
    'gpt-5-nano-2025-08-07',
    'gpt-4.1-nano',
    'gpt-5-mini',
  ])('uses appropriate options for %s', async (model) => {
    generate.mockResolvedValueOnce({
      output: { isJobPosting: true, job: fixture.job },
    });
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    await analyseJob('A sample role description.', model);
    const options = generate.mock.calls[0][0];
    expect(timeout).toHaveBeenCalledWith(config.generationTimeoutMs);
    expect(options.providerOptions.openai).toEqual(
      model.startsWith('gpt-5-nano')
        ? { store: false, reasoningEffort: 'low' }
        : { store: false },
    );
  });
  it('logs safe stage diagnostics and returns the timeout to the caller', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    generate.mockRejectedValueOnce(
      new DOMException('PRIVATE_TIMEOUT_DETAILS', 'TimeoutError'),
    );
    await expect(
      analyseJob('PRIVATE_JOB_CONTENT', 'gpt-5-nano'),
    ).rejects.toMatchObject({
      status: 504,
      message: expect.stringContaining('analysing the job posting'),
    });
    expect(log).toHaveBeenCalledWith(
      'OpenAI generation failed:',
      expect.objectContaining({
        category: 'timeout',
        stage: 'analysing the job posting',
        model: 'gpt-5-nano',
      }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_');
  });
});
