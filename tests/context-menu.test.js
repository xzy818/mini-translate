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

  // 任务1：补充操作后菜单状态刷新测试
  it('updates menu to remove action after adding term', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    const info = { selectionText: 'new-word' };
    const tab = { id: 10 };

    // 初始状态：显示add
    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    chromeStub.contextMenus.update.mockClear();

    // 执行添加操作
    await chromeStub._onClicked(info, tab);
    await flushPromises();
    await flushPromises();

    // 验证操作后菜单状态刷新为remove
    const updateCalls = chromeStub.contextMenus.update.mock.calls;
    const lastUpdateCall = updateCalls[updateCalls.length - 1];
    expect(lastUpdateCall[0]).toBe(MENU_ID);
    expect(lastUpdateCall[1]).toMatchObject({
      title: expect.stringContaining('remove from mini-translate'),
      visible: true
    });
  });

  it('updates menu to add action after removing term', async () => {
    await writeVocabulary(chromeStub, [{ term: 'remove-me', translation: '删除我' }]);

    const info = { selectionText: 'remove-me' };
    const tab = { id: 11 };

    // 初始状态：显示remove
    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    chromeStub.contextMenus.update.mockClear();

    // 执行移除操作
    await chromeStub._onClicked(info, tab);
    await flushPromises();
    await flushPromises();

    // 验证操作后菜单状态刷新为add
    const updateCalls = chromeStub.contextMenus.update.mock.calls;
    const lastUpdateCall = updateCalls[updateCalls.length - 1];
    expect(lastUpdateCall[0]).toBe(MENU_ID);
    expect(lastUpdateCall[1]).toMatchObject({
      title: expect.stringContaining('add & mini-translate'),
      visible: true
    });
  });

  // 任务2：补充消息payload验证测试
  it('sends APPLY_TRANSLATION with correct payload when translation succeeds', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    const info = { selectionText: 'test-word' };
    const tab = { id: 12 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    chromeStub.tabs.sendMessage.mockClear();

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    // 验证APPLY_TRANSLATION消息的payload内容
    expect(chromeStub.tabs.sendMessage).toHaveBeenCalledWith(
      tab.id,
      expect.objectContaining({
        type: 'APPLY_TRANSLATION',
        payload: expect.objectContaining({
          term: 'test-word',
          translation: 'test-word-译',
          type: 'word',
          status: 'active'
        })
      }),
      expect.any(Function)
    );
  });

  it('does not send APPLY_TRANSLATION when translation fails', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    mockTranslateFailure('网络错误');

    const info = { selectionText: 'fail-word' };
    const tab = { id: 13 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    chromeStub.tabs.sendMessage.mockClear();

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    // 验证翻译失败时不发送APPLY_TRANSLATION
    const applyTranslationCalls = chromeStub.tabs.sendMessage.mock.calls.filter(
      ([_tabId, message]) => message?.type === 'APPLY_TRANSLATION'
    );
    expect(applyTranslationCalls).toHaveLength(0);
  });

  it('sends REMOVE_TRANSLATION with correct payload', async () => {
    await writeVocabulary(chromeStub, [{ term: 'remove-term', translation: '删除词条' }]);

    const info = { selectionText: 'remove-term' };
    const tab = { id: 14 };

    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    chromeStub.tabs.sendMessage.mockClear();

    await chromeStub._onClicked(info, tab);
    await flushPromises();

    // 验证REMOVE_TRANSLATION消息的payload内容
    expect(chromeStub.tabs.sendMessage).toHaveBeenCalledWith(
      tab.id,
      expect.objectContaining({
        type: 'REMOVE_TRANSLATION',
        payload: expect.objectContaining({
          term: 'remove-term'
        })
      }),
      expect.any(Function)
    );
  });

  it('notifies user when removing non-existent term', async () => {
    // 场景：模拟词条已被其他方式移除，但菜单状态缓存仍显示"remove"
    // 这种情况下，用户点击移除应该收到错误提示
    // 注意：由于onClicked会先检查menuState缓存，如果缓存存在且显示"remove"，
    // 会执行remove操作，但此时词条已不存在，应该收到错误提示
    
    await writeVocabulary(chromeStub, [{ term: 'temp-remove', translation: '临时删除' }]);

    const info = { selectionText: 'temp-remove' };
    const tab = { id: 15 };

    // 先选中词条，菜单显示"remove"，并缓存状态
    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    await flushPromises();
    
    // 验证菜单已缓存"remove"状态
    const updateCallsBefore = chromeStub.contextMenus.update.mock.calls;
    expect(updateCallsBefore[updateCallsBefore.length - 1][1]).toMatchObject({
      title: expect.stringContaining('remove from mini-translate'),
      visible: true
    });
    
    // 模拟词条被其他方式移除（直接操作词库）
    await writeVocabulary(chromeStub, []);
    
    // 模拟菜单状态缓存仍显示"remove"（不清空缓存，直接点击）
    // 由于onClicked会先检查menuState缓存，如果缓存存在且显示"remove"，
    // 会执行remove操作，但此时词条已不存在，应该收到错误提示
    chromeStub.notifications.create.mockClear();
    chromeStub.contextMenus.update.mockClear();
    
    // 直接点击（此时缓存仍显示"remove"，但词条已不存在）
    await chromeStub._onClicked(info, tab);
    await flushPromises();
    await flushPromises();
    
    // 验证错误提示
    expect(chromeStub.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: '未找到对应词条。' })
    );
    
    // 验证菜单状态已更新为"add"（因为词条不存在）
    const updateCallsAfter = chromeStub.contextMenus.update.mock.calls;
    const lastUpdateCall = updateCallsAfter[updateCallsAfter.length - 1];
    expect(lastUpdateCall[1]).toMatchObject({
      title: expect.stringContaining('add & mini-translate'),
      visible: true
    });
  });

  // 任务3：补充快速连续操作测试
  it('handles rapid add then remove correctly', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    const info = { selectionText: 'rapid-test' };
    const tab = { id: 16 };

    // 快速添加
    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    await chromeStub._onClicked(info, tab);
    await flushPromises();
    await flushPromises();

    // 验证词条已添加
    let vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(1);
    expect(vocab[0].term).toBe('rapid-test');

    // 快速移除
    chromeStub.contextMenus.update.mockClear();
    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    await chromeStub._onClicked(info, tab);
    await flushPromises();
    await flushPromises();

    // 验证词条已移除
    vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(0);

    // 验证菜单状态在每次操作后都正确更新
    const updateCalls = chromeStub.contextMenus.update.mock.calls;
    const lastUpdateCall = updateCalls[updateCalls.length - 1];
    expect(lastUpdateCall[1]).toMatchObject({
      title: expect.stringContaining('add & mini-translate'),
      visible: true
    });
  });

  it('handles rapid remove then add correctly', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    // 先添加词条
    await writeVocabulary(chromeStub, [{ term: 'rapid-remove', translation: '快速删除' }]);

    const info = { selectionText: 'rapid-remove' };
    const tab = { id: 17 };

    // 快速移除
    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    await chromeStub._onClicked(info, tab);
    await flushPromises();
    await flushPromises();

    // 验证词条已移除
    let vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(0);

    // 快速重新添加
    chromeStub.contextMenus.update.mockClear();
    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    await chromeStub._onClicked(info, tab);
    await flushPromises();
    await flushPromises();

    // 验证词条已重新添加
    vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(1);
    expect(vocab[0].term).toBe('rapid-remove');

    // 验证菜单状态在每次操作后都正确更新
    const updateCalls = chromeStub.contextMenus.update.mock.calls;
    const lastUpdateCall = updateCalls[updateCalls.length - 1];
    expect(lastUpdateCall[1]).toMatchObject({
      title: expect.stringContaining('remove from mini-translate'),
      visible: true
    });
  });

  // 任务4：补充多Tab状态同步测试
  it('synchronizes menu state across tabs when term is added in Tab1', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    const info = { selectionText: 'multi-tab-word' };
    const tab1 = { id: 20 };
    const tab2 = { id: 21 };

    // Tab1添加词条
    await dispatchSelection(chromeStub, info.selectionText, tab1.id);
    await chromeStub._onClicked(info, tab1);
    await flushPromises();
    await flushPromises();

    // Tab2选中相同词，应显示remove
    chromeStub.contextMenus.update.mockClear();
    await dispatchSelection(chromeStub, info.selectionText, tab2.id);
    await flushPromises();

    const updateCalls = chromeStub.contextMenus.update.mock.calls;
    const tab2UpdateCall = updateCalls.find(call => {
      // 查找Tab2的更新调用（通过检查调用参数中的title）
      return call[1]?.title?.includes('remove from mini-translate');
    });
    expect(tab2UpdateCall).toBeTruthy();
    expect(tab2UpdateCall[1]).toMatchObject({
      title: expect.stringContaining('remove from mini-translate'),
      visible: true
    });
  });

  it('synchronizes menu state across tabs when term is removed in Tab1', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    // 先添加词条
    await writeVocabulary(chromeStub, [{ term: 'multi-tab-remove', translation: '多标签删除' }]);

    const info = { selectionText: 'multi-tab-remove' };
    const tab1 = { id: 22 };
    const tab2 = { id: 23 };

    // Tab1移除词条
    await dispatchSelection(chromeStub, info.selectionText, tab1.id);
    await chromeStub._onClicked(info, tab1);
    await flushPromises();
    await flushPromises();

    // Tab2选中相同词，应显示add
    chromeStub.contextMenus.update.mockClear();
    await dispatchSelection(chromeStub, info.selectionText, tab2.id);
    await flushPromises();

    const updateCalls = chromeStub.contextMenus.update.mock.calls;
    const tab2UpdateCall = updateCalls.find(call => {
      return call[1]?.title?.includes('add & mini-translate');
    });
    expect(tab2UpdateCall).toBeTruthy();
    expect(tab2UpdateCall[1]).toMatchObject({
      title: expect.stringContaining('add & mini-translate'),
      visible: true
    });
  });

  // 任务5：补充Service Worker重启测试
  it('restores menu state correctly after Service Worker restart', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    // 先添加词条
    await writeVocabulary(chromeStub, [{ term: 'restart-test', translation: '重启测试' }]);

    const info = { selectionText: 'restart-test' };
    const tab = { id: 24 };

    // 模拟Service Worker重启：清空menuState缓存
    // 通过重新注册handlers来模拟重启
    chromeStub.contextMenus.update.mockClear();
    registerHandlers(chromeStub);

    // 验证重启后菜单状态基于词库正确显示
    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    await flushPromises();

    const updateCalls = chromeStub.contextMenus.update.mock.calls;
    const updateCall = updateCalls[0];
    expect(updateCall[0]).toBe(MENU_ID);
    expect(updateCall[1]).toMatchObject({
      title: expect.stringContaining('remove from mini-translate'),
      visible: true
    });
  });

  it('continues to work correctly after Service Worker restart', async () => {
    await writeSettings(chromeStub, {
      model: 'gpt-4o-mini',
      apiKey: 'mock-key'
    });

    const info = { selectionText: 'restart-work' };
    const tab = { id: 25 };

    // 模拟Service Worker重启
    registerHandlers(chromeStub);

    // 验证重启后操作仍能正常工作
    await dispatchSelection(chromeStub, info.selectionText, tab.id);
    await chromeStub._onClicked(info, tab);
    await flushPromises();
    await flushPromises();

    // 验证词条已添加
    const vocab = await readVocabulary(chromeStub);
    expect(vocab).toHaveLength(1);
    expect(vocab[0].term).toBe('restart-work');

    // 验证菜单状态已更新
    const updateCalls = chromeStub.contextMenus.update.mock.calls;
    const lastUpdateCall = updateCalls[updateCalls.length - 1];
    expect(lastUpdateCall[1]).toMatchObject({
      title: expect.stringContaining('remove from mini-translate'),
      visible: true
    });
  });
});
