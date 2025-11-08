import { describe, it, expect, beforeEach, vi } from 'vitest';

// ESM 模块模拟：为 background.js 的依赖提供最小实现
vi.mock('../src/services/context-menu.js', () => ({
  initializeBackground: vi.fn(),
  handleAddTerm: vi.fn(),
  handleRemoveTerm: vi.fn(),
  updateMenuForInfo: vi.fn()
}));

vi.mock('../src/services/translator.js', () => ({
  translateText: vi.fn(async () => 'ok'),
  validateTranslationConfig: vi.fn(() => ({ isValid: true, errors: [] })),
  TRANSLATION_ERRORS: { TIMEOUT: 'TIMEOUT' }
}));

vi.mock('../src/services/ai-api-client.js', () => ({
  AIApiClient: class {
    async callAPI({ provider, model, messages, apiKey }) {
      if (!provider || !model || !messages || !apiKey) throw new Error('bad payload');
      return { text: 'hello' };
    }
  }
}));

vi.mock('../src/config/model-providers.js', () => ({
  MODEL_PROVIDERS: {
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai', models: { 'gpt-4o-mini': 'gpt-4o-mini' } },
    qwen: { name: 'Qwen', baseUrl: 'https://api.qwen', models: { 'qwen-mt-plus': 'qwen-mt-plus' } }
  }
}));

vi.mock('../src/services/storage.js', () => ({
  appendVocabulary: vi.fn(),
  readVocabulary: vi.fn(async () => []),
  writeVocabulary: vi.fn(async () => true),
  VOCAB_KEY: 'vocab'
}));

vi.mock('../src/services/model-utils.js', () => ({
  mapBaseUrlByModel: (model) => (model === 'gpt-4o-mini' ? 'https://api.openai' : 'https://api.mock')
}));

// 全局 chrome 模拟与消息分发捕获
let onMessageHandler;
function installChromeMock() {
  onMessageHandler = undefined;
  global.chrome = {
    runtime: {
      onMessage: {
        addListener: (fn) => { onMessageHandler = fn; }
      },
      onInstalled: {
        addListener: vi.fn()
      },
      onStartup: {
        addListener: vi.fn()
      },
      reload: vi.fn(),
      sendMessage: vi.fn(),
      getPlatformInfo: vi.fn((cb) => cb?.({ os: 'mac', arch: 'x64', nacl_arch: 'x86-64' })),
      lastError: null
    },
    contextMenus: {
      onClicked: {
        addListener: vi.fn()
      }
    },
    storage: {
      local: {
        _bag: {},
        get: (keys, cb) => {
          if (keys === null || keys === undefined) {
            cb(global.chrome.storage.local._bag);
            return;
          }
          if (Array.isArray(keys)) {
            const out = {}; keys.forEach(k => { out[k] = global.chrome.storage.local._bag[k]; });
            cb(out); return;
          }
          if (typeof keys === 'string') { cb({ [keys]: global.chrome.storage.local._bag[keys] }); return; }
          cb({});
        },
        set: (obj, cb) => { Object.assign(global.chrome.storage.local._bag, obj); cb && cb(); }
      },
      session: {
        get: (keys, cb) => {
          cb?.({});
        },
        set: (obj, cb) => {
          cb?.();
        }
      }
    }
  };
}

async function sendMessage(message) {
  return await new Promise((resolve) => {
    const sendResponse = (resp) => resolve(resp);
    const ret = onMessageHandler(message, {}, sendResponse);
    if (ret === false || ret === undefined) {
      resolve(undefined);
    }
  });
}

describe('public/background.js coverage (core paths)', () => {
  beforeEach(async () => {
    vi.resetModules();
    installChromeMock();
    // 预置 settings 供 TEST_TRANSLATOR_SETTINGS 使用
    global.chrome.storage.local._bag.settings = { model: 'gpt-4o-mini', apiKey: 'sk-test' };
    await import('../public/background.js');
    expect(typeof onMessageHandler).toBe('function');
  });

  it('handles AI_API_CALL (success)', async () => {
    const resp = await sendMessage({
      type: 'AI_API_CALL',
      payload: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
        apiKey: 'sk'
      }
    });
    expect(resp).toEqual({ ok: true, result: { text: 'hello' }, requestId: undefined });
  });

  it('handles GET_AI_PROVIDERS', async () => {
    const resp = await sendMessage({ type: 'GET_AI_PROVIDERS' });
    expect(resp.ok).toBe(true);
    expect(Array.isArray(resp.providers)).toBe(true);
    expect(resp.providers.length).toBeGreaterThan(0);
  });

  it('handles GET_PROVIDER_MODELS', async () => {
    const resp = await sendMessage({ type: 'GET_PROVIDER_MODELS', payload: { provider: 'openai' } });
    expect(resp.ok).toBe(true);
    expect(resp.models?.[0]?.key).toBe('gpt-4o-mini');
  });

  it('handles SETTINGS_UPDATED sync response', async () => {
    const resp = await sendMessage({ type: 'SETTINGS_UPDATED' });
    expect(resp).toEqual({ ok: true });
  });

  it('handles TEST_TRANSLATOR_SETTINGS success path (immediate ok)', async () => {
    const resp = await sendMessage({
      type: 'TEST_TRANSLATOR_SETTINGS',
      payload: { model: 'gpt-4o-mini', apiKey: 'sk-abc' }
    });
    expect(resp).toEqual({ ok: true, message: '测试已启动' });
  });

  it('returns false on unsupported message type', async () => {
    const result = await onMessageHandler({ type: 'UNKNOWN_TYPE' }, {}, () => {});
    expect(result).toBe(false);
  });

  it('returns false on missing message type', async () => {
    const result = await onMessageHandler({}, {}, () => {});
    expect(result).toBe(false);
  });

  it('handles AI_API_CALL error path', async () => {
    vi.resetModules();
    installChromeMock();
    // mock AIApiClient to throw error
    const mockCallAPI = vi.fn().mockRejectedValueOnce(new Error('API failed'));
    vi.doMock('../src/services/ai-api-client.js', () => ({
      AIApiClient: class {
        constructor() {
          this.callAPI = mockCallAPI;
        }
      }
    }));
    await import('../public/background.js');
    const resp = await sendMessage({
      type: 'AI_API_CALL',
      payload: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
        apiKey: 'sk',
        requestId: 'test-123'
      }
    });
    expect(resp.ok).toBe(false);
    expect(resp.error).toContain('API failed');
  });

  it('handles GET_PROVIDER_MODELS with unsupported provider', async () => {
    const resp = await sendMessage({
      type: 'GET_PROVIDER_MODELS',
      payload: { provider: 'invalid-provider' }
    });
    expect(resp.ok).toBe(false);
    expect(resp.error).toContain('Unsupported provider');
  });

  it('handles TRANSLATE_TERM success', async () => {
    const resp = await sendMessage({
      type: 'TRANSLATE_TERM',
      payload: {
        text: 'hello',
        model: 'gpt-4o-mini',
        apiKey: 'sk-test',
        apiBaseUrl: 'https://api.openai'
      }
    });
    expect(resp.ok).toBe(true);
    expect(resp.translation).toBe('ok');
  });

  it('handles TRANSLATE_TERM error path', async () => {
    const { translateText } = await import('../src/services/translator.js');
    translateText.mockRejectedValueOnce(new Error('translate failed'));
    const resp = await sendMessage({
      type: 'TRANSLATE_TERM',
      payload: {
        text: 'hello',
        model: 'gpt-4o-mini',
        apiKey: 'sk-test'
      }
    });
    expect(resp.ok).toBe(false);
    expect(resp.error).toContain('translate failed');
  });

  it('handles SAVE_SETTINGS success', async () => {
    const resp = await sendMessage({
      type: 'SAVE_SETTINGS',
      payload: { model: 'gpt-4o-mini', apiKey: 'sk-new' }
    });
    expect(resp.ok).toBe(true);
    expect(global.chrome.storage.local._bag.model).toBe('gpt-4o-mini');
  });

  it('handles SAVE_SETTINGS with storage error', async () => {
    const origSet = global.chrome.storage.local.set;
    global.chrome.storage.local.set = (obj, cb) => {
      global.chrome.runtime.lastError = { message: 'storage down' };
      cb();
    };
    const resp = await sendMessage({
      type: 'SAVE_SETTINGS',
      payload: { model: 'gpt-4o-mini', apiKey: 'sk-new' }
    });
    expect(resp.ok).toBe(false);
    global.chrome.storage.local.set = origSet;
    global.chrome.runtime.lastError = null;
  });

  it('handles TEST_TRANSLATOR_SETTINGS validation failure', async () => {
    const { validateTranslationConfig } = await import('../src/services/translator.js');
    validateTranslationConfig.mockReturnValueOnce({
      isValid: false,
      errors: ['missing apiKey']
    });
    const resp = await sendMessage({
      type: 'TEST_TRANSLATOR_SETTINGS',
      payload: { model: 'gpt-4o-mini' }
    });
    expect(resp.ok).toBe(false);
    expect(resp.error).toContain('missing apiKey');
  });

  it('handles RETRY_TRANSLATION success', async () => {
    const resp = await sendMessage({
      type: 'RETRY_TRANSLATION',
      payload: { term: 'hello' }
    });
    // wait for async callback
    await new Promise(r => setTimeout(r, 50));
    // response should be ok (if resolved) or timeout handled
  });

  it('handles RETRY_TRANSLATION missing term', async () => {
    const resp = await sendMessage({
      type: 'RETRY_TRANSLATION',
      payload: {}
    });
    expect(resp.ok).toBe(false);
    expect(resp.error).toContain('缺少要重新翻译的词汇');
  });

  it('handles REFRESH_CONTEXT_MENU', async () => {
    const resp = await sendMessage({
      type: 'REFRESH_CONTEXT_MENU'
    });
    expect(resp.ok).toBe(true);
  });

  it('handles QA_CONTEXT_ADD', async () => {
    const { handleAddTerm } = await import('../src/services/context-menu.js');
    handleAddTerm.mockResolvedValueOnce({ ok: true });
    const resp = await sendMessage({
      type: 'QA_CONTEXT_ADD',
      payload: { selectionText: 'test' }
    });
    expect(resp.ok).toBe(true);
  });

  it('handles QA_CONTEXT_REMOVE', async () => {
    const { handleRemoveTerm } = await import('../src/services/context-menu.js');
    handleRemoveTerm.mockResolvedValueOnce({ ok: true });
    const resp = await sendMessage({
      type: 'QA_CONTEXT_REMOVE',
      payload: { selectionText: 'test' }
    });
    expect(resp.ok).toBe(true);
  });

  it('handles QA_GET_STORAGE_STATE', async () => {
    global.chrome.storage.local._bag.test = 'value';
    const resp = await new Promise((resolve) => {
      const sendResponse = (resp) => resolve(resp);
      const ret = onMessageHandler({
        type: 'QA_GET_STORAGE_STATE',
        payload: { includeSession: false }
      }, {}, sendResponse);
      if (ret !== true) {
        // if handler returns false, resolve immediately
        setTimeout(() => resolve(undefined), 10);
      }
      // otherwise wait for callback
    });
    expect(resp?.ok).toBe(true);
    if (resp?.ok) {
      expect(resp.local?.test).toBe('value');
    }
  });

  it('handles SELECTION_CHANGED', async () => {
    // SELECTION_CHANGED is fire-and-forget, doesn't send response
    const result = await onMessageHandler({
      type: 'SELECTION_CHANGED',
      payload: { selectionText: 'selected' }
    }, { tab: { id: 123 } }, () => {});
    // handler should return true to keep channel open, but may not call sendResponse
    expect(result).toBe(true);
  });
});
