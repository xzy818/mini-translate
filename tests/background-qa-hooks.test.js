import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const contextMenuMocks = {
  initializeBackground: vi.fn(),
  handleAddTerm: vi.fn(async () => ({ ok: true, payload: { selection: 'Agent' } })),
  handleRemoveTerm: vi.fn(async () => ({ ok: true })),
  updateMenuForInfo: vi.fn(async () => {})
};

vi.mock('../src/services/context-menu.js', () => contextMenuMocks);

vi.mock('../src/services/translator.js', () => ({
  translateText: vi.fn(async () => 'translated'),
  validateTranslationConfig: vi.fn(() => ({ isValid: true, errors: [] })),
  TRANSLATION_ERRORS: { TIMEOUT: 'TIMEOUT' }
}));

vi.mock('../src/services/ai-api-client.js', () => ({
  AIApiClient: class {
    async callAPI() {
      return { text: 'hello' };
    }
  }
}));

vi.mock('../src/config/model-providers.js', () => ({
  MODEL_PROVIDERS: {
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai', models: { 'gpt-4o-mini': 'gpt-4o-mini' } }
  }
}));

vi.mock('../src/services/storage.js', () => ({
  appendVocabulary: vi.fn(async () => ({ inserted: true, list: [] })),
  readVocabulary: vi.fn(async () => []),
  writeVocabulary: vi.fn(async () => {}),
  VOCAB_KEY: 'vocab'
}));

vi.mock('../src/services/model-utils.js', () => ({
  mapBaseUrlByModel: (model) => (model ? 'https://api.mock/' + model : 'https://api.mock/unknown')
}));

let onMessageHandler;

function createChromeStub() {
  const bag = {
    settings: { model: 'gpt-4o-mini', apiKey: 'sk-abc' },
    vocabulary: [{ term: 'Agent', translation: '代理人', status: 'active', createdAt: '2024-01-01T00:00:00.000Z' }]
  };
  const sessionBag = {};

  const chromeStub = {
    runtime: {
      onInstalled: {
        addListener(fn) {
          chromeStub._onInstalled = fn;
        }
      },
      onStartup: {
        addListener(fn) {
          chromeStub._onStartup = fn;
        }
      },
      onMessage: {
        addListener(fn) {
          onMessageHandler = fn;
        }
      },
      sendMessage: vi.fn((msg, cb) => cb?.()),
      reload: vi.fn(() => {
        chromeStub._onInstalled?.();
      }),
      getPlatformInfo: vi.fn((cb) => cb?.({ os: 'mac', arch: 'x64', nacl_arch: 'x86-64' })),
      lastError: null
    },
    contextMenus: {
      removeAll: vi.fn((cb) => cb?.()),
      create: vi.fn()
    },
    storage: {
      local: {
        get(keys, cb) {
          if (Array.isArray(keys)) {
            const out = {};
            keys.forEach((key) => {
              out[key] = bag[key];
            });
            cb(out);
            return;
          }
          if (typeof keys === 'string') {
            cb({ [keys]: bag[keys] });
            return;
          }
          if (!keys) {
            cb({ ...bag });
            return;
          }
          const out = { ...keys };
          Object.keys(keys).forEach((key) => {
            if (key in bag) {
              out[key] = bag[key];
            }
          });
          cb(out);
        },
        set(values, cb) {
          Object.assign(bag, values);
          cb?.();
        }
      },
      session: {
        get(keys, cb) {
          if (!keys) {
            cb({ ...sessionBag });
            return;
          }
          if (Array.isArray(keys)) {
            const out = {};
            keys.forEach((key) => {
              out[key] = sessionBag[key];
            });
            cb(out);
            return;
          }
          cb({});
        }
      }
    }
  };

  return chromeStub;
}

async function dispatch(message, sender = {}) {
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const handler = onMessageHandler;
    const ret = handler(message, sender, finish);

    if (ret === true) {
      return;
    }

    if (ret && typeof ret.then === 'function') {
      ret.then((result) => {
        if (result === true) {
          return;
        }
        finish(result);
      }).catch((error) => {
        if (!settled) {
          settled = true;
          throw error;
        }
      });
      return;
    }

    finish(ret);
  });
}

const originalEnv = { ...process.env };

describe('background QA helper message handling', () => {
  beforeEach(async () => {
    vi.resetModules();
    Object.assign(process.env, originalEnv);
    process.env.MT_QA_HOOKS = '1';
    global.chrome = createChromeStub();
    await import('../public/background.js');
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    vi.clearAllMocks();
  });

  it('logs context when unknown QA message arrives', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await dispatch({ type: 'UNKNOWN' });
    expect(warn).toHaveBeenCalledWith('[qa] unknown message type', 'UNKNOWN');
    expect(warn).toHaveBeenCalledWith('[qa] ctx model/url', {
      model: 'gpt-4o-mini',
      apiBaseUrl: 'https://api.mock/gpt-4o-mini'
    });
    warn.mockRestore();
  });

  it('handles QA_APPLY_TERM and relays payload', async () => {
    const resp = await dispatch({ type: 'QA_APPLY_TERM', payload: { term: 'Agent' } });
    expect(contextMenuMocks.handleAddTerm).toHaveBeenCalled();
    expect(resp).toEqual({ ok: true, payload: { selection: 'Agent' } });
  });

  it('resolves QA_RESET_WORKER by waiting for initialization', async () => {
    const respPromise = dispatch({ type: 'QA_RESET_WORKER' });
    expect(global.chrome.runtime.reload).toHaveBeenCalled();
    const resp = await respPromise;
    expect(resp).toEqual({ ok: true, reloaded: true });
  });
});

