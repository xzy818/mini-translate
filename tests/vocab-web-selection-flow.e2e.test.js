/** @vitest-environment jsdom */

/**
 * 自动化 E2E：使用 dist 构建模拟真实用户流程
 * 步骤：加载 dist、配置 key、在网页选词入库、检查管理页词库、验证翻译成功
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  collectVocabularyElements,
  createSettingsController
} from '../dist/options.js';
import {
  createStorageClient,
  createVocabularyManager
} from '../dist/vocab-ui.js';
import { handleAddTerm } from '../dist/src/services/context-menu.js';

const TEST_QWEN_KEY = process.env.TEST_QWEN_KEY;
const TEST_TERM = 'hello';

function cloneValue(value) {
  if (value === undefined) return undefined;
  try {
    return structuredClone(value);
  } catch (_) {
    return JSON.parse(JSON.stringify(value));
  }
}

function createStorageArea(areaName, storageData, listeners, changeBus) {
  function normalizeGetResult(keys) {
    if (keys == null) {
      return { ...storageData };
    }
    if (typeof keys === 'string') {
      return { [keys]: storageData[keys] };
    }
    if (Array.isArray(keys)) {
      return keys.reduce((acc, key) => {
        acc[key] = storageData[key];
        return acc;
      }, {});
    }
    if (typeof keys === 'object') {
      return Object.entries(keys).reduce((acc, [key, defaultValue]) => {
        acc[key] = key in storageData ? storageData[key] : defaultValue;
        return acc;
      }, {});
    }
    return {};
  }

  return {
    get(keys, callback) {
      const result = normalizeGetResult(keys);
      callback?.(cloneValue(result));
    },
    set(items, callback) {
      const changes = {};
      Object.entries(items || {}).forEach(([key, value]) => {
        const oldValue = cloneValue(storageData[key]);
        const newValue = cloneValue(value);
        storageData[key] = newValue;
        changes[key] = { oldValue, newValue };
      });
      callback?.();
      if (Object.keys(changes).length > 0) {
        listeners.forEach((listener) => listener(changes, areaName));
        changeBus.forEach((listener) => listener(changes, areaName));
      }
    },
    remove(keys, callback) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const changes = {};
      keyList.forEach((key) => {
        if (key in storageData) {
          const oldValue = cloneValue(storageData[key]);
          delete storageData[key];
          changes[key] = { oldValue, newValue: undefined };
        }
      });
      callback?.();
      if (Object.keys(changes).length > 0) {
        listeners.forEach((listener) => listener(changes, areaName));
        changeBus.forEach((listener) => listener(changes, areaName));
      }
    }
  };
}

function createChromeStub() {
  const storageData = {
    local: {
      miniTranslateVocabulary: [],
      settings: {}
    },
    sync: {
      miniTranslateVocabulary: [],
      settings: {}
    }
  };
  const localListeners = new Set();
  const syncListeners = new Set();
  const changeBus = new Set();
  const runtimeListeners = new Set();

  const chromeLike = {
    storage: {
      local: createStorageArea('local', storageData.local, localListeners, changeBus),
      sync: createStorageArea('sync', storageData.sync, syncListeners, changeBus),
      onChanged: {
        addListener(listener) {
          changeBus.add(listener);
        },
        removeListener(listener) {
          changeBus.delete(listener);
        }
      }
    },
    runtime: {
      lastError: null,
      onMessage: {
        addListener(listener) {
          runtimeListeners.add(listener);
        },
        removeListener(listener) {
          runtimeListeners.delete(listener);
        }
      },
      sendMessage: vi.fn((message, responseCallback) => {
        chromeLike.runtime.lastError = null;
        let handledAsync = false;
        const listeners = Array.from(runtimeListeners);
        const sendResponse = (response) => {
          handledAsync = true;
          responseCallback?.(response);
        };
        listeners.forEach((listener) => {
          const result = listener(message, {}, sendResponse);
          if (result === true) {
            handledAsync = true;
          }
        });
        if (!handledAsync) {
          responseCallback?.();
        }
      })
    },
    tabs: {
      sendMessage: vi.fn((tabId, payload, callback) => {
        chromeLike.runtime.lastError = null;
        const listeners = Array.from(runtimeListeners);
        listeners.forEach((listener) => {
          listener(payload, { tab: { id: tabId } }, () => {});
        });
        callback?.();
      }),
      onRemoved: {
        addListener: vi.fn()
      }
    },
    contextMenus: {
      create: vi.fn((options, callback) => callback?.()),
      update: vi.fn((id, details, callback) => callback?.()),
      removeAll: vi.fn((callback) => callback?.()),
      onClicked: {
        addListener: vi.fn()
      }
    },
    notifications: {
      create: vi.fn((id, options, callback) => callback?.())
    },
    scripting: {
      executeScript: vi.fn((details, callback) => callback?.())
    }
  };

  chromeLike.__storageData = storageData;
  return chromeLike;
}

function setupOptionsDom() {
  document.body.innerHTML = `
    <main>
      <section id="settings-panel">
        <select id="model">
          <option value="">请选择模型</option>
          <option value="qwen-mt-turbo">qwen-mt-turbo</option>
        </select>
        <input id="key" type="password" />
        <button id="toggleKey" type="button">显示</button>
        <button id="save" type="button">保存</button>
        <button id="test" type="button">测试</button>
      </section>
      <section id="vocab-panel">
        <span id="vocab-counter"></span>
        <div id="vocab-alert" hidden></div>
        <div id="vocab-empty" hidden></div>
        <div id="vocab-table-wrapper">
          <table class="vocab-table">
            <tbody id="vocab-body"></tbody>
          </table>
        </div>
        <div id="vocab-pagination">
          <button id="vocab-prev" type="button">上一页</button>
          <span id="vocab-page-info"></span>
          <button id="vocab-next" type="button">下一页</button>
        </div>
        <input id="select-all" type="checkbox" hidden />
        <button id="batch-delete" type="button" style="display:none;"></button>
        <button id="retry-all-errors" type="button" style="display:none;"></button>
      </section>
    </main>
  `;
}

async function getStoredSettings(chromeLike) {
  return new Promise((resolve) => {
    const area = chromeLike.storage.sync || chromeLike.storage.local;
    area.get({ settings: {} }, (result) => {
      resolve(result.settings);
    });
  });
}

async function getStoredVocabulary(chromeLike) {
  return new Promise((resolve) => {
    const area = chromeLike.storage.sync || chromeLike.storage.local;
    area.get({ miniTranslateVocabulary: [] }, (result) => {
      resolve(result.miniTranslateVocabulary);
    });
  });
}

if (!TEST_QWEN_KEY) {
  describe.skip('Vocabulary workflow with real translation (requires TEST_QWEN_KEY)', () => {
    it('skipped because TEST_QWEN_KEY is not defined', () => {
      expect(TEST_QWEN_KEY).toBeDefined();
    });
  });
} else {
  describe('Vocabulary workflow with dist build', () => {
    let chromeStub;
    let settingsController;
    let storageClient;
    let manager;
    let runtimeMessages;
    let tabMessages;

    beforeEach(async () => {
      setupOptionsDom();
      chromeStub = createChromeStub();
      runtimeMessages = [];
      tabMessages = [];
      chromeStub.runtime.sendMessage.mockImplementation((message, callback) => {
        runtimeMessages.push(message);
        callback?.({ ok: true });
      });
      chromeStub.tabs.sendMessage.mockImplementation((tabId, payload, callback) => {
        tabMessages.push({ tabId, payload });
        chromeStub.runtime.lastError = null;
        callback?.();
      });
      global.chrome = chromeStub;

      const settingsElements = {
        model: document.getElementById('model'),
        key: document.getElementById('key'),
        toggle: document.getElementById('toggleKey'),
        save: document.getElementById('save'),
        test: document.getElementById('test')
      };
      const notify = vi.fn();
      settingsController = createSettingsController({
        chromeLike: chromeStub,
        notify,
        elements: settingsElements
      });
      settingsController.bind();
      await settingsController.load();

      const vocabElements = collectVocabularyElements(document);
      storageClient = createStorageClient({ chromeLike: chromeStub });
      manager = createVocabularyManager({
        elements: vocabElements,
        storage: storageClient
      });
    });

    afterEach(() => {
      manager?.destroy();
      delete global.chrome;
    });

    it(
      'adds selected web term into vocabulary and renders it with translation',
      async () => {
        const modelSelect = document.getElementById('model');
        const keyInput = document.getElementById('key');
        modelSelect.value = 'qwen-mt-turbo';
        keyInput.value = TEST_QWEN_KEY;

        await settingsController.save();
        const storedSettings = await getStoredSettings(chromeStub);
        expect(storedSettings).toMatchObject({
          model: 'qwen-mt-turbo',
          apiKey: TEST_QWEN_KEY
        });

        const addResult = await handleAddTerm(
          chromeStub,
          { selectionText: TEST_TERM },
          1
        );

        expect(addResult.ok).toBe(true);
        expect(typeof addResult.payload.translation).toBe('string');
        expect(addResult.payload.translation.trim().length).toBeGreaterThan(0);
        expect(addResult.payload.status).toBe('active');

        expect(tabMessages).toHaveLength(1);
        const applyPayload = tabMessages[0]?.payload;
        expect(applyPayload?.type).toBe('APPLY_TRANSLATION');
        expect(applyPayload?.payload?.term).toBe(TEST_TERM);
        expect(applyPayload?.payload?.translation?.trim()).toBe(
          addResult.payload.translation.trim()
        );

        const vocabularyList = await getStoredVocabulary(chromeStub);
        const storedEntry =
          vocabularyList.find(
            (item) => item.term?.toLowerCase() === TEST_TERM.toLowerCase()
          ) || null;
        expect(storedEntry).not.toBeNull();
        expect(storedEntry.translation?.trim()).toBe(
          addResult.payload.translation.trim()
        );
        expect(storedEntry.status).toBe('active');

        expect(
          runtimeMessages.some((msg) => msg?.type === 'VOCAB_UPDATED')
        ).toBe(true);

        await manager.init();

        const localVocabulary = await storageClient.getVocabulary();
        expect(localVocabulary.length).toBeGreaterThan(0);

        const row = document.querySelector(
          '#vocab-body tr[data-term="hello"]'
        );
        expect(row).not.toBeNull();
        const termCell = row?.children?.[1];
        const translationCell = row?.children?.[2];
        const statusBadge = row?.querySelector('.status-badge');
        expect(termCell?.textContent?.trim()).toBe(TEST_TERM);
        expect(translationCell?.textContent?.trim()).toBe(
          addResult.payload.translation.trim()
        );
        expect(statusBadge?.textContent).toContain('启用');

        const syncVocabulary =
          chromeStub.__storageData.sync.miniTranslateVocabulary || [];
        expect(syncVocabulary.length).toBeGreaterThan(0);
        expect(syncVocabulary[0]?.translation?.trim()).toBe(
          addResult.payload.translation.trim()
        );
        expect(syncVocabulary.length).toBe(localVocabulary.length);
      },
      60000
    );
  });
}
