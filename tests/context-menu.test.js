import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest';
import {
  readVocabulary,
  writeVocabulary,
  writeSettings,
  readTabState,
  VOCAB_KEY,
  MAX_VOCAB
} from '../src/services/storage.js';

function createChromeStub() {
  const localStore = new Map();
  const sessionStore = new Map();

  const chromeStub = {
    storage: {
      local: {
        get(defaults, cb) {
          const result = {};
          Object.keys(defaults).forEach((key) => {
            result[key] = localStore.has(key) ? localStore.get(key) : defaults[key];
          });
          setTimeout(() => cb(result), 0);
        },
        set(values, cb) {
          Object.entries(values).forEach(([key, value]) => {
            localStore.set(key, value);
          });
          if (cb) setTimeout(cb, 0);
        }
      },
      session: {
        get(defaults, cb) {
          const result = {};
          Object.keys(defaults).forEach((key) => {
            result[key] = sessionStore.has(key) ? sessionStore.get(key) : defaults[key];
          });
          setTimeout(() => cb(result), 0);
        },
        set(values, cb) {
          Object.entries(values).forEach(([key, value]) => {
            sessionStore.set(key, value);
          });
          if (cb) setTimeout(cb, 0);
        }
      }
    },
    runtime: {
      lastError: null,
      sendMessage: vi.fn((message, cb) => {
        if (message.type === 'TRANSLATE_TERM') {
          cb({ ok: true, translation: `${message.payload.text}-译` });
        }
      })
    },
    tabs: {
      sendMessage: vi.fn((_tabId, _payload, cb) => {
        if (cb) cb();
      }),
      onRemoved: {
        addListener: vi.fn()
      }
    },
    contextMenus: {
      removeAll: vi.fn((cb) => cb && cb()),
      create: vi.fn(),
      update: vi.fn(),
      refresh: vi.fn(),
      onClicked: { addListener: vi.fn() },
      onShown: { addListener: vi.fn() }
    },
    notifications: {
      create: vi.fn()
    }
  };

  return { chromeStub, localStore, sessionStore };
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('context menu handlers', () => {
  let chromeStub;
  let localStore;
  let menuExports;

  beforeAll(async () => {
    menuExports = await import('../src/services/context-menu.js');
  });

  beforeEach(() => {
    const stub = createChromeStub();
    chromeStub = stub.chromeStub;
    localStore = stub.localStore;
  });

  it('handles term addition and stores vocabulary', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key',
      apiBaseUrl: 'https://api.example.com'
    });
    const info = { selectionText: 'sample' };
    const tabId = 7;

    const result = await menuExports.handleAddTerm(chromeStub, info, tabId);
    await flushPromises();

    expect(result.ok).toBe(true);
    const vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(1);
    expect(vocab[0].term).toBe('sample');
    expect(chromeStub.tabs.sendMessage).toHaveBeenCalledWith(tabId, expect.objectContaining({ type: 'APPLY_TRANSLATION' }), expect.any(Function));
    expect(chromeStub.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'TRANSLATE_TERM' }), expect.any(Function));
  });

  it('respects vocabulary limit when adding', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key',
      apiBaseUrl: 'https://api.example.com'
    });
    const bigList = Array.from({ length: MAX_VOCAB }).map((_, index) => ({ term: `term-${index}`, translation: `t-${index}` }));
    localStore.set(VOCAB_KEY, bigList);

    const result = await menuExports.handleAddTerm(chromeStub, { selectionText: 'extra' }, 2);
    await flushPromises();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('LIMIT_EXCEEDED');
    expect(chromeStub.notifications.create).toHaveBeenCalled();
    const vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(MAX_VOCAB);
  });

  it('removes term and notifies tab', async () => {
    await writeVocabulary(chromeStub, [{ term: 'remove-me', translation: 'R' }]);
    const result = await menuExports.handleRemoveTerm(chromeStub, { selectionText: 'remove-me' }, 3);
    await flushPromises();
    expect(result.ok).toBe(true);
    const vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(0);
    expect(chromeStub.tabs.sendMessage).toHaveBeenCalledWith(3, expect.objectContaining({ type: 'REMOVE_TRANSLATION' }), expect.any(Function));
  });

  it('toggles page translation state', async () => {
    const tabId = 11;
    const result1 = await menuExports.handleTogglePage(chromeStub, tabId);
    await flushPromises();
    expect(result1.enabled).toBe(true);

    const result2 = await menuExports.handleTogglePage(chromeStub, tabId);
    await flushPromises();
    expect(result2.enabled).toBe(false);

    const state = await readTabState(chromeStub);
    expect(state[tabId].enabled).toBe(false);
    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(menuExports.MENU_IDS.TOGGLE, expect.any(Object));
  });
});
