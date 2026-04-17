import { describe, expect, it, vi } from 'vitest';
import {
  buildModelOptions,
  DEFAULT_SETTINGS,
  pickDefaultModel,
  refreshModelCache,
  verifyOpenRouterConnection,
} from '../../src/settings';
import { OpenRouterService } from '../../src/services/openrouter';

describe('settings model controls', () => {
  it('builds dropdown options from fetched models and preserves a manual selection', () => {
    const options = buildModelOptions(
      [
        {
          id: 'openai/gpt-5.4-mini',
          name: 'GPT-5.4 Mini',
          contextLength: 128000,
        },
      ],
      'anthropic/claude-3.5-haiku',
    );

    expect(options).toEqual([
      {
        value: 'anthropic/claude-3.5-haiku',
        label: 'anthropic/claude-3.5-haiku (manual)',
      },
      {
        value: 'openai/gpt-5.4-mini',
        label: 'GPT-5.4 Mini (openai/gpt-5.4-mini)',
      },
    ]);
  });

  it('stores refreshed models in settings cache', async () => {
    const listModels = vi.fn().mockResolvedValue([
      {
        id: 'openai/gpt-5.4-mini',
        name: 'GPT-5.4 Mini',
        contextLength: 128000,
      },
      {
        id: 'anthropic/claude-3.5-haiku',
        name: 'Claude 3.5 Haiku',
        contextLength: 200000,
      },
    ]);

    const settings = await refreshModelCache(
      {
        ...DEFAULT_SETTINGS,
        openRouterApiKey: 'sk-test',
      },
      { listModels },
    );

    expect(listModels).toHaveBeenCalledTimes(1);
    expect(listModels).toHaveBeenCalledWith({ forceRefresh: true });
    expect(settings._modelsCache?.data).toHaveLength(2);
    expect(settings._modelsCache?.cachedAt).toEqual(expect.any(Number));
    expect(settings.defaultModel).toBe('openai/gpt-5.4-mini');
  });

  it('verifies connectivity through listModels', async () => {
    const listModels = vi.fn().mockResolvedValue([
      {
        id: 'openai/gpt-5.4-mini',
        name: 'GPT-5.4 Mini',
        contextLength: 128000,
      },
    ]);

    await expect(verifyOpenRouterConnection({ listModels })).resolves.toBe(1);
    expect(listModels).toHaveBeenCalledTimes(1);
    expect(listModels).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it('treats a trimmed manual model id as a manual dropdown option when it is not in the fetched list', () => {
    const options = buildModelOptions(
      [
        {
          id: 'openai/gpt-5.4-mini',
          name: 'GPT-5.4 Mini',
          contextLength: 128000,
        },
      ],
      'openai/gpt-5.4',
    );

    expect(options[0]).toEqual({
      value: 'openai/gpt-5.4',
      label: 'openai/gpt-5.4 (manual)',
    });
  });

  it('preserves an explicit manual model selection during refresh', async () => {
    const listModels = vi.fn().mockResolvedValue([
      {
        id: 'openai/gpt-5.4-mini',
        name: 'GPT-5.4 Mini',
        contextLength: 128000,
      },
    ]);

    const settings = await refreshModelCache(
      {
        ...DEFAULT_SETTINGS,
        openRouterApiKey: 'sk-test',
        defaultModel: 'anthropic/claude-3.5-haiku',
      },
      { listModels },
    );

    expect(settings.defaultModel).toBe('anthropic/claude-3.5-haiku');
  });

  it('falls back to the first fetched model when no model is selected yet', () => {
    expect(pickDefaultModel([
      {
        id: 'openai/gpt-5.4-mini',
        name: 'GPT-5.4 Mini',
        contextLength: 128000,
      },
      {
        id: 'anthropic/claude-3.5-haiku',
        name: 'Claude 3.5 Haiku',
        contextLength: 200000,
      },
    ], '')).toBe('openai/gpt-5.4-mini');
  });

  it('keeps a trimmed manual model id when provided', () => {
    expect(pickDefaultModel([], '  openai/gpt-5.4  ')).toBe('openai/gpt-5.4');
  });
});

describe('OpenRouterService model cache hydration', () => {
  it('hydrates a persisted model cache snapshot', () => {
    const service = new OpenRouterService({
      apiKey: 'sk-test',
      baseUrl: 'https://openrouter.ai/api/v1',
    });

    service.hydrateModelsCache({
      cachedAt: Date.now(),
      data: [
        {
          id: 'openai/gpt-5.4-mini',
          name: 'GPT-5.4 Mini',
          contextLength: 128000,
        },
      ],
    });

    expect(service.getModelsCache()).toEqual({
      cachedAt: expect.any(Number),
      data: [
        {
          id: 'openai/gpt-5.4-mini',
          name: 'GPT-5.4 Mini',
          contextLength: 128000,
        },
      ],
    });
  });

  it('clears the cached models when API credentials change', () => {
    const service = new OpenRouterService({
      apiKey: 'sk-test',
      baseUrl: 'https://openrouter.ai/api/v1',
    });

    service.hydrateModelsCache({
      cachedAt: Date.now(),
      data: [
        {
          id: 'openai/gpt-5.4-mini',
          name: 'GPT-5.4 Mini',
          contextLength: 128000,
        },
      ],
    });

    service.updateConfig({ apiKey: 'sk-next' });

    expect(service.getModelsCache()).toBeNull();
  });
});
