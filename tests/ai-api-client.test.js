import { describe, it, expect, beforeEach, vi } from 'vitest';

// 简化 provider 配置
vi.mock('../src/config/model-providers.js', () => ({
  MODEL_PROVIDERS: {
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai', models: { 'gpt-4o-mini': 'gpt-4o-mini' }, endpoints: { chat: '/v1/chat/completions' }, headers: { 'Authorization': 'Bearer {apiKey}', 'Content-Type': 'application/json' } }
  },
  getProviderConfig: (provider, model) => {
    if (provider !== 'openai' || model !== 'gpt-4o-mini') return null;
    return { name: 'OpenAI', baseUrl: 'https://api.openai', selectedModel: 'gpt-4o-mini', endpoints: { chat: '/v1/chat/completions' }, headers: { 'Authorization': 'Bearer {apiKey}', 'Content-Type': 'application/json' } };
  }
}));

// 全局 fetch mock
const okJson = (data) => ({ ok: true, json: async () => data });
const badJson = (status = 400, statusText = 'Bad Request') => ({ ok: false, status, statusText });

let AIApiClient;

beforeEach(async () => {
  vi.resetModules();
  global.fetch = vi.fn();
  ({ AIApiClient } = await import('../src/services/ai-api-client.js'));
});

describe('AIApiClient.callAPI (OpenAI)', () => {
  it('returns text on 2xx success', async () => {
    const client = new AIApiClient();
    fetch.mockResolvedValueOnce(okJson({ choices: [{ message: { content: 'hello' } }], usage: { total_tokens: 10 }, model: 'gpt-4o-mini' }));
    const res = await client.callAPI({ provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], apiKey: 'sk-xxx' });
    expect(res.text).toBe('hello');
  });

  it('throws on non-2xx response', async () => {
    const client = new AIApiClient();
    fetch.mockResolvedValueOnce(badJson(401, 'Unauthorized'));
    await expect(client.callAPI({ provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], apiKey: 'sk-xxx' }))
      .rejects.toThrow('API request failed: 401 Unauthorized');
  });

  it('throws on network error', async () => {
    const client = new AIApiClient();
    fetch.mockRejectedValueOnce(new Error('Network down'));
    await expect(client.callAPI({ provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], apiKey: 'sk-xxx' }))
      .rejects.toThrow('Network down');
  });

  it('supports abort signal timeout', async () => {
    const controller = new AbortController();
    const client = new AIApiClient();
    // 模拟可被AbortSignal中止的请求
    fetch.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        return reject(new DOMException('Aborted', 'AbortError'));
      }
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      // 吊起但不resolve，等待abort触发
    }));
    setTimeout(() => controller.abort(), 5);
    await expect(client.callAPI({ provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], apiKey: 'sk-xxx', options: { signal: controller.signal } }))
      .rejects.toThrow(/Aborted|AbortError/);
  });

  it('throws for unsupported provider/model', async () => {
    const client = new AIApiClient();
    await expect(client.callAPI({ provider: 'openai', model: 'not-exist', messages: [], apiKey: 'sk' }))
      .rejects.toThrow('Unsupported provider/model');
  });
});


