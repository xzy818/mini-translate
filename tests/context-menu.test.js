import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readVocabulary,
  writeVocabulary,
  writeSettings
} from '../src/services/storage.js';
import {
  MENU_ID,
  createContextMenus,
  registerHandlers,
  handleAddTerm,
  __setTranslateTextImplementation,
  __resetTranslateTextImplementation
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
    __setTranslateTextImplementation(async ({ text }) => `${text}-译`);
  });

  afterEach(() => {
    __resetTranslateTextImplementation();
  });

  function mockTranslateFailure(errorMessage = '网络错误') {
    __setTranslateTextImplementation(async () => {
      const error = new Error(errorMessage);
      error.meta = { url: 'https://api.mock' };
      throw error;
    });
  }

function fillVocabulary(chromeStub, count) {
  const list = Array.from({ length: count }, (_, index) => ({
    term: `term-${index}`,
    translation: `译-${index}`,
    status: 'active'
  }));
  chromeStub._localStore.set('miniTranslateVocabulary', list);
  return list;
}

  it('shows add action when selection not in vocabulary', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    const info = { selectionText: 'new-term' };
    const tab = { id: 1 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    // 检查spy的最新调用实际内容（第二参数）
    const updateCall = chromeStub.contextMenus.update.mock.calls[0];
    expect(updateCall[0]).toBe(MENU_ID);
    expect(updateCall[1]).toMatchObject({ title: 'add & mini-translate · 选中: new-term', visible: true });

    chromeStub.contextMenus.update.mockClear();
    chromeStub.notifications.create.mockClear();

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    const vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(1);
    expect(vocab[0].term).toBe('new-term');
    expect(chromeStub.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: '已添加词条：new-term' })
    );
    const translateCalls = chromeStub.runtime.sendMessage.mock.calls.filter(
      ([message]) => message?.type === 'TRANSLATE_TERM'
    );
    expect(translateCalls.length).toBe(0);
  });

  it('handles translation failure gracefully', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    mockTranslateFailure('翻译服务暂时不可用');

    const info = { selectionText: 'cloud' };
    const tab = { id: 7 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    const vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(1);
    expect(vocab[0]).toEqual(
      expect.objectContaining({ term: 'cloud', status: 'error', translation: '' })
    );
    expect(chromeStub.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: '翻译服务暂时不可用' })
    );
    expect(chromeStub.tabs.sendMessage).not.toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ type: 'APPLY_TRANSLATION' }),
      expect.any(Function)
    );
  });


  it('reports vocabulary limit exceeded', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    fillVocabulary(chromeStub, 500);

    const info = { selectionText: 'overflow' };
    const tab = { id: 8 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    const vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(500);
    expect(chromeStub.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: '词库已满 (500)，请删除后再添加。' })
    );
  });

  it('updates existing entry when adding same term with different casing', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    const infoUpper = { selectionText: 'Agents' };
    const tab = { id: 9 };

    await handleAddTerm(chromeStub, infoUpper, tab.id);
    await flushPromises();

    let vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(1);
    expect(vocab[0].term).toBe('Agents');
    expect(vocab[0].translation).toBe('Agents-译');

    chromeStub.notifications.create.mockClear();

    const infoLower = { selectionText: 'agents' };
    await handleAddTerm(chromeStub, infoLower, tab.id);
    await flushPromises();
    await flushPromises();

    vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(1);
    expect(vocab[0].term).toBe('Agents');
    expect(vocab[0].translation).toBe('agents-译');
    expect(vocab[0].canonical).toBe('agents');
  });

  it('notifies user when translation settings are incomplete', async () => {
    await writeSettings(chromeStub, {});

    const info = { selectionText: 'need-config' };
    const tab = { id: 4 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    chromeStub.runtime.sendMessage.mockClear();
    chromeStub.notifications.create.mockClear();

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    expect(chromeStub.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: '请先在扩展设置中配置模型和 API Key。' })
    );
    expect(chromeStub.runtime.sendMessage).not.toHaveBeenCalled();

    const vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(0);
  });

  it('shows remove action when selection exists in vocabulary', async () => {
    await writeVocabulary(chromeStub, [{ term: 'existing', translation: '旧' }]);

    const info = { selectionText: 'existing' };
    const tab = { id: 2 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    const updateCall = chromeStub.contextMenus.update.mock.calls[0];
    expect(updateCall[0]).toBe(MENU_ID);
    expect(updateCall[1]).toMatchObject({ title: 'remove from mini-translate · 选中: existing → 旧', visible: true });

    chromeStub.notifications.create.mockClear();

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    const vocab = await readVocabulary(chromeStub);
    expect(vocab.find((item) => item.term === 'existing')).toBeUndefined();
    expect(chromeStub.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: '已移除词条：existing' })
    );
  });

  it('hides menu when selection is empty', async () => {
    await dispatchSelection(chromeStub, '', undefined);

    const updateCall = chromeStub.contextMenus.update.mock.calls[0];
    expect(updateCall[0]).toBe(MENU_ID);
    expect(updateCall[1]).toMatchObject({ title: 'mini-translate', visible: false });
  });
});
