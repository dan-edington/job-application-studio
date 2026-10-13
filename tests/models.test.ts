import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { list, testConfig } = vi.hoisted(() => ({
  list: vi.fn(),
  testConfig: { apiKey: 'test-key', defaultModel: 'gpt-5-nano' },
}));
vi.mock('openai', () => ({ default: class { models = { list }; } }));
vi.mock('../server/config', async importOriginal => ({
  ...await importOriginal<typeof import('../server/config')>(), config: testConfig,
}));

let service: typeof import('../server/services/models');
beforeEach(async () => {
  vi.resetModules(); list.mockReset(); testConfig.apiKey = 'test-key';
  service = await import('../server/services/models');
});
afterEach(() => vi.useRealTimers());

describe('OpenAI model discovery', () => {
  it('returns all discovered families and fine-tunes, sorted and deduplicated', async () => {
    const ids = ['gpt-future-family', 'text-embedding-3-large', 'gpt-image-1', 'gpt-5-pro', 'gpt-realtime', 'ft:custom-model:example', 'o1', 'gpt-5-pro'];
    list.mockResolvedValue({ data: ids.map(id => ({ id })) });
    expect(await service.listModels()).toMatchObject({ models: [...new Set(ids)].sort(), warning: null, source: 'openai' });
  });

  it('does not add the configured preferred model to API results', async () => {
    list.mockResolvedValue({ data: [{ id: 'new-model' }] });
    expect((await service.listModels()).models).toEqual(['new-model']);
  });

  it('refreshes the cache after five minutes', async () => {
    vi.useFakeTimers();
    list.mockResolvedValueOnce({ data: [{ id: 'original' }] }).mockResolvedValueOnce({ data: [{ id: 'new-model' }] });
    await service.listModels(); await service.listModels();
    expect(list).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300001);
    expect((await service.listModels()).models).toEqual(['new-model']);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('offers built-in models without a key but prevents generation', async () => {
    testConfig.apiKey = '';
    expect(await service.listModels()).toMatchObject({ models: service.fallbackModels, warning: null, source: 'fallback' });
    expect(list).not.toHaveBeenCalled();
    await expect(service.validateModel('gpt-5-mini')).rejects.toMatchObject({ status: 503 });
  });

  it('offers a clearly labelled fallback after connection failure and allows retry', async () => {
    list.mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce({ data: [{ id: 'recovered' }] });
    const result = await service.listModels();
    expect(result.models).toEqual(service.fallbackModels); expect(result.source).toBe('fallback'); expect(result.warning).toContain('Could not connect');
    expect((await service.listModels()).models).toEqual(['recovered']);
  });

  it('handles an empty account catalogue', async () => {
    list.mockResolvedValue({ data: [] });
    expect(await service.listModels()).toMatchObject({ models: service.fallbackModels, warning: expect.stringContaining('no models'), source: 'fallback' });
  });

  it('accepts discovered IDs and rejects undiscovered IDs', async () => {
    list.mockResolvedValue({ data: [{ id: 'ft:new-model:example' }] });
    await expect(service.validateModel('ft:new-model:example')).resolves.toBeUndefined();
    await expect(service.validateModel('gpt-5-mini')).rejects.toMatchObject({ status: 400 });
  });

  it('reports an authentication error when OpenAI rejects the key', async () => {
    list.mockRejectedValue({ status: 401, code: 'invalid_api_key', message: 'SECRET MUST NOT APPEAR' });
    const result = await service.listModels();
    expect(result.authenticationFailed).toBe(true);
    expect(result.warning).toContain('401');
    expect(result.warning).not.toContain('SECRET');
    await expect(service.validateModel('gpt-5-mini')).rejects.toMatchObject({ status: 503 });
  });
});


describe('fallback validation', () => {
  it('allows a supported model when listing permission is missing', async () => {
    list.mockRejectedValue({ status: 403 });
    const result = await service.listModels();
    expect(result.warning).toContain('permission');
    expect(result.models[0]).toBe('gpt-5-nano');
    await expect(service.validateModel('gpt-5-nano')).resolves.toBeUndefined();
  });

  it('allows fallback generation after a discovery network failure', async () => {
    list.mockRejectedValue(new Error('Connection error'));
    await expect(service.validateModel('gpt-5-nano')).resolves.toBeUndefined();
    await expect(service.validateModel('made-up-model')).rejects.toMatchObject({ status: 400 });
  });

  it('identifies rate limiting separately from authentication', async () => {
    list.mockRejectedValue({ status: 429 });
    const result = await service.listModels();
    expect(result.authenticationFailed).toBe(false);
    expect(result.warning).toContain('429');
    expect(result.models).toEqual(service.fallbackModels);
  });
});
