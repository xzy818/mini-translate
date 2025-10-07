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

function mockTranslateFailure(chromeStub, errorMessage = '网络错误') {
  chromeStub.runtime.sendMessage.mockImplementation((message, cb) => {
    if (message.type === 'TRANSLATE_TERM') {
      cb({ ok: false, reason: errorMessage });
      return;
    }
    cb && cb({ ok: true });
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

    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(
      MENU_ID,
      expect.objectContaining({
        title: expect.stringContaining('add & mini-translate · 选中: new-term'),
        visible: true
      })
    );

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
    expect(chromeStub.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TRANSLATE_TERM' }),
      expect.any(Function)
    );
  });

  it('handles translation failure gracefully', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    mockTranslateFailure(chromeStub, '翻译服务暂时不可用');

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

  it('retries translation after connection error and succeeds', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    let callCount = 0;
    chromeStub.runtime.sendMessage.mockImplementation((message, cb) => {
      if (message.type === 'TRANSLATE_TERM') {
        callCount += 1;
        if (callCount === 1) {
          chromeStub.runtime.lastError = {
            message: 'Could not establish connection. Receiving end does not exist.'
          };
          cb && cb();
          chromeStub.runtime.lastError = null;
          return;
        }
        cb && cb({ ok: true, translation: `${message.payload.text}-译` });
        return;
      }
      cb && cb({ ok: true });
    });

    const info = { selectionText: 'cloud' };
    const tab = { id: 11 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    const clickPromise = chromeStub._onClicked(info, tab);
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 220));
    await flushPromises();
    await clickPromise;

    const vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(1);
    expect(vocab[0]).toMatchObject({
      term: 'cloud',
      translation: 'cloud-译',
      status: 'active'
    });
    expect(callCount).toBe(2);
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

  it('shows last translation in toggle title when available', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });
    await writeVocabulary(chromeStub, [
      { term: 'apple', translation: '苹果', status: 'active' },
      { term: 'banana', translation: '香蕉', status: 'error' },
      { term: 'cat', translation: '猫', status: 'active' }
    ]);

    const info = { selectionText: '' };
    const tab = { id: 5 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(
      MENU_ID,
      expect.objectContaining({
        title: expect.stringContaining('start mini-translate · 最近词: cat'),
        visible: true
      })
    );
  });

  it('falls back to base title when no translations available', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });
    await writeVocabulary(chromeStub, [
      { term: 'banana', translation: '', status: 'error' }
    ]);

    const info = { selectionText: '' };
    const tab = { id: 6 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(
      MENU_ID,
      expect.objectContaining({
        title: 'start mini-translate',
        visible: true
      })
    );
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

    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(
      MENU_ID,
      expect.objectContaining({
        title: expect.stringContaining('remove from mini-translate'),
        visible: true
      })
    );

    chromeStub.notifications.create.mockClear();

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    const vocab = await readVocabulary(chromeStub);
    expect(vocab.find((item) => item.term === 'existing')).toBeUndefined();
    expect(chromeStub.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: '已移除词条：existing' })
    );
  });

  it('shows start/stop based on tab state', async () => {
    const info = { selectionText: '' };
    const tab = { id: 3 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(
      MENU_ID,
      expect.objectContaining({
        title: expect.stringContaining('start mini-translate'),
        visible: true
      })
    );

    chromeStub.contextMenus.update.mockClear();

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    expect(chromeStub.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Mini Translate',
        message: '已在当前页面启用 Mini Translate。'
      })
    );

    chromeStub.notifications.create.mockClear();

    await dispatchSelection(chromeStub, info.selectionText, tab.id);

    expect(chromeStub.contextMenus.update).toHaveBeenCalledWith(
      MENU_ID,
      expect.objectContaining({
        title: expect.stringContaining('stop mini-translate'),
        visible: true
      })
    );

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    expect(chromeStub.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Mini Translate',
        message: '已在当前页面停用 Mini Translate。'
      })
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
