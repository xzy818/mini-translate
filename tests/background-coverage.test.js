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
    const result = onMessageHandler({ type: 'UNKNOWN_TYPE' }, {}, () => {});
    await expect(result).resolves.toBe(false);
  });
});
