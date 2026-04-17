import { requestUrl } from 'obsidian';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  responseFormat?: 'json_object' | 'text';
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmModel {
  id: string;
  name: string;
  contextLength: number;
}

export interface LlmService {
  chat(opts: ChatOptions): Promise<ChatResult>;
  listModels(): Promise<LlmModel[]>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: string,
    public retriable = false
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

function isRetriable(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

export class OpenRouterService implements LlmService {
  private apiKey: string;
  private baseUrl: string;
  private modelsCache: { data: LlmModel[]; cachedAt: number } | null = null;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000;

  constructor(opts: { apiKey: string; baseUrl: string }) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl;
  }

  async listModels(): Promise<LlmModel[]> {
    if (this.modelsCache && Date.now() - this.modelsCache.cachedAt < this.CACHE_TTL_MS) {
      return this.modelsCache.data;
    }

    const response = await requestUrl({
      url: `${this.baseUrl}/models`,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'GET',
    });

    if (response.status !== 200) {
      throw new LlmError(
        `Failed to list models: ${response.status}`,
        response.status,
        response.text,
        isRetriable(response.status)
      );
    }

    const data = response.json as { data: { id: string; name: string; context_length?: number }[] };
    const models: LlmModel[] = data.data.map(m => ({
      id: m.id,
      name: m.name || m.id,
      contextLength: m.context_length || 4096,
    }));

    this.modelsCache = { data: models, cachedAt: Date.now() };
    return models;
  }

  async chat(opts: ChatOptions): Promise<ChatResult> {
    const { model, messages, responseFormat, temperature, maxTokens, signal } = opts;

    let lastError: LlmError | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (signal?.aborted) {
        throw new LlmError('Request aborted');
      }

      const body: Record<string, unknown> = {
        model,
        messages,
      };

      if (responseFormat) {
        body.response_format = { type: responseFormat };
      }
      if (temperature !== undefined) {
        body.temperature = temperature;
      }
      if (maxTokens) {
        body.max_tokens = maxTokens;
      }

      try {
        const response = await requestUrl({
          url: `${this.baseUrl}/chat/completions`,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify(body),
        });

        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          const error = new LlmError(
            `Request failed: ${response.status}`,
            response.status,
            response.text,
            true
          );
          if (attempt < maxRetries - 1) {
            const jitterMs = Math.random() * 1000 * Math.pow(2, attempt);
            await sleep(jitterMs);
            lastError = error;
            continue;
          }
          throw error;
        }

        if (response.status >= 400 && response.status !== 429) {
          throw new LlmError(
            `Request failed: ${response.status}`,
            response.status,
            response.text,
            false
          );
        }

        const data = response.json as {
          choices: { message: { content: string } }[];
          usage: { prompt_tokens: number; completion_tokens: number };
        };

        return {
          content: data.choices[0]?.message?.content || '',
          usage: {
            inputTokens: data.usage?.prompt_tokens || 0,
            outputTokens: data.usage?.completion_tokens || 0,
          },
        };
      } catch (e) {
        if (e instanceof LlmError && e.retriable && attempt < maxRetries - 1) {
          const jitterMs = Math.random() * 1000 * Math.pow(2, attempt);
          await sleep(jitterMs);
          lastError = e;
          continue;
        }
        throw e;
      }
    }

    throw lastError || new LlmError('Max retries exceeded');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}