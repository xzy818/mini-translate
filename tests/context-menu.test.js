import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readVocabulary,
  writeVocabulary,
  writeSettings,
  readTabState,
} from '../src/services/storage.js';
import {
  MENU_ID,
  createContextMenus,
  registerHandlers
} from '../src/services/context-menu.js';

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
          Object.entries(values).forEach(([key, value]) => localStore.set(key, value));
          cb && setTimeout(cb, 0);
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
          Object.entries(values).forEach(([key, value]) => sessionStore.set(key, value));
          cb && setTimeout(cb, 0);
        }
      }
    },
    runtime: {
      lastError: null,
      sendMessage: vi.fn((message, cb) => {
        if (message.type === 'TRANSLATE_TERM') {
          cb({ ok: true, translation: `${message.payload.text}-译` });
          return;
        }
        cb && cb({ ok: true });
      }),
      onMessage: {
        addListener: vi.fn((fn) => {
          chromeStub._onRuntimeMessage = fn;
        })
      }
    },
    tabs: {
      sendMessage: vi.fn((_tabId, _payload, cb) => cb && cb()),
      onRemoved: {
        addListener: vi.fn((fn) => {
          chromeStub._onTabRemoved = fn;
        })
      }
    },
    contextMenus: {
      removeAll: vi.fn((cb) => {
        chromeStub.contextMenus.entries = new Map();
        cb && cb();
      }),
      create: vi.fn((entry) => {
        chromeStub.contextMenus.entries.set(entry.id, entry);
      }),
      update: vi.fn(),
      entries: new Map(),
      onClicked: {
        addListener: vi.fn((fn) => {
          chromeStub._onClicked = fn;
        })
      },
      refresh: vi.fn()
    },
    notifications: {
      create: vi.fn()
    }
  };

  chromeStub._localStore = localStore;
  chromeStub._sessionStore = sessionStore;
  return chromeStub;
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function dispatchSelection(chromeStub, selectionText, tabId = 1) {
  if (!chromeStub._onRuntimeMessage) {
    throw new Error('runtime.onMessage listener not registered');
  }
  chromeStub._onRuntimeMessage(
    { type: 'SELECTION_CHANGED', payload: { selectionText } },
    { tab: { id: tabId }, frameId: 0 }
  );
  await flushPromises();
  await flushPromises();
}

describe('context menu dynamic scenes', () => {
  let chromeStub;

  beforeEach(() => {
    chromeStub = createChromeStub();
    createContextMenus(chromeStub);
    registerHandlers(chromeStub);
    chromeStub.contextMenus.update.mockClear();
    chromeStub.notifications.create.mockClear();
    chromeStub.runtime.sendMessage.mockClear();
    chromeStub.tabs.sendMessage.mockClear();
    chromeStub._localStore.clear();
    chromeStub._sessionStore.clear();
  });

  it('shows add action when selection not in vocabulary', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key',
      apiBaseUrl: 'https://api.example.com'
    });

    const info = { selectionText: 'new-term' };
    const tab = { id: 1 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(
      MENU_ID,
      expect.objectContaining({ title: 'add & mini-translate', visible: true })
    );

    chromeStub.contextMenus.update.mockClear();
    chromeStub.notifications.create.mockClear();

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    const vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(1);
    expect(vocab[0].term).toBe('new-term');
    expect(chromeStub.notifications.create).not.toHaveBeenCalled();
    expect(chromeStub.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TRANSLATE_TERM' }),
      expect.any(Function)
    );
  });

  it('shows remove action when selection exists in vocabulary', async () => {
    await writeVocabulary(chromeStub, [{ term: 'existing', translation: '旧' }]);

    const info = { selectionText: 'existing' };
    const tab = { id: 2 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(
      MENU_ID,
      expect.objectContaining({ title: 'remove from mini-translate', visible: true })
    );

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    const vocab = await readVocabulary(chromeStub);
    expect(vocab.find((item) => item.term === 'existing')).toBeUndefined();
  });

  it('shows start/stop based on tab state', async () => {
    const info = { selectionText: '' };
    const tab = { id: 3 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(
      MENU_ID,
      expect.objectContaining({ title: 'start mini-translate', visible: true })
    );

    chromeStub.contextMenus.update.mockClear();

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    expect(chromeStub.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Mini Translate 已开启' })
    );

    chromeStub.notifications.create.mockClear();

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(
      MENU_ID,
      expect.objectContaining({ title: 'stop mini-translate', visible: true })
    );

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    expect(chromeStub.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Mini Translate 已关闭' })
    );

    const state = await readTabState(chromeStub);
    expect(state[3].enabled).toBe(false);
  });

  it('hides menu when no valid action', async () => {
    await dispatchSelection(chromeStub, '', undefined);

    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(
      MENU_ID,
      expect.objectContaining({ visible: true })
    );
  });
});
