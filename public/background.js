import {
  initializeBackground,
  handleAddTerm,
  handleRemoveTerm,
  handleTogglePage,
  updateMenuForInfo
} from '../src/services/context-menu.js';
import {
  translateText,
  validateTranslationConfig,
  TRANSLATION_ERRORS
} from '../src/services/translator.js';

let initialized = false;

function setup() {
  if (initialized) return;
  initializeBackground(chrome);
  initialized = true;
}

self.addEventListener('unhandledrejection', (event) => {
  console.error('[qa] unhandled rejection', event.reason);
});

self.addEventListener('error', (event) => {
  console.error('[qa] worker error', event.message, event.error);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }
  console.warn('[qa] message received', message.type);
  // 统一日志，便于排查未覆盖类型
  // 调试日志（按eslint策略仅在error路径使用console）

  if (message.type === 'SETTINGS_UPDATED') {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'TEST_TRANSLATOR_SETTINGS') {
    const config = message.payload || {};
    const validation = validateTranslationConfig(config);
    if (!validation.isValid) {
      console.error('[qa:test] validation failed', validation.errors);
      sendResponse({ ok: false, error: validation.errors.join('、') });
      return false;
    }

    console.warn('[qa:test] start', { model: config.model, apiBaseUrl: config.apiBaseUrl });
    translateText({
      text: 'diagnostic check',
      model: config.model,
      apiKey: config.apiKey,
      apiBaseUrl: config.apiBaseUrl,
      timeout: 5000
    })
      .then(() => {
        console.warn('[qa:test] success');
        sendResponse({ ok: true });
      })
      .catch((error) => {
        const message = error?.message || '测试失败';
        const label = error?.type === TRANSLATION_ERRORS.TIMEOUT ? '[qa:test] timeout' : '[qa:test] error';
        console.warn(label, message);
        sendResponse({ ok: false, error: message });
      });
    return true;
  }

  if (message.type === 'TRANSLATE_TERM') {
    translateText(message.payload)
      .then((translation) => {
        sendResponse({ ok: true, translation });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || '翻译失败' });
      });
    return true; // keep channel open for async response
  }

  if (message.type === 'RETRY_TRANSLATION') {
    const { term } = message.payload;
    if (!term) {
      sendResponse({ ok: false, error: '缺少要重新翻译的词汇' });
      return false;
    }

    // 获取当前设置并处理异步操作
    chrome.storage.local.get(['model', 'apiKey', 'apiBaseUrl'], async (settings) => {
      const { model, apiKey, apiBaseUrl } = settings;
      if (!model || !apiKey || !apiBaseUrl) {
        sendResponse({ ok: false, error: '翻译配置不完整' });
        return;
      }

      try {
        // 重新翻译
        const translation = await translateText({
          text: term,
          model,
          apiKey,
          apiBaseUrl
        });

        // 更新词库中的翻译结果
        const vocabData = await chrome.storage.local.get(['vocabulary']);
        const vocabulary = vocabData.vocabulary || [];
        
        const updatedVocabulary = vocabulary.map(item => {
          if (item.term === term) {
            return {
              ...item,
              translation,
              status: 'active',
              updatedAt: new Date().toISOString()
            };
          }
          return item;
        });

        await chrome.storage.local.set({ vocabulary: updatedVocabulary });

        // 发送词库更新事件
        chrome.runtime.sendMessage({ type: 'VOCAB_UPDATED', payload: { retried: term } });

        sendResponse({ ok: true, translation });
      } catch (error) {
        console.error('重新翻译失败:', error);
        sendResponse({ ok: false, error: error.message || '重新翻译失败' });
      }
    });
    return true; // keep channel open for async response
  }

  // 保存设置：仅作为通知类，持久化后回执
  if (message.type === 'SAVE_SETTINGS') {
    const { model, apiKey, apiBaseUrl } = message.payload || {};
    chrome.storage.local.set({ model, apiKey, apiBaseUrl }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        sendResponse({ ok: false, error: err.message });
        return;
      }
      // 广播"设置已更新"事件（前端不必须监听）
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', payload: { model, apiBaseUrl } });
      sendResponse({ ok: true });
    });
    return true; // async
  }

  // 刷新右键菜单等（幂等操作）
  if (message.type === 'REFRESH_CONTEXT_MENU') {
    try {
      initializeBackground(chrome);
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true; // 保持一致
  }

  if (message.type === 'QA_CONTEXT_ADD') {
    const selectionText = (message.payload?.selectionText || '').trim();
    const info = { selectionText };
    const tabId = sender?.tab?.id ?? null;
    console.warn('[qa] add selection', selectionText, 'tab', tabId);
    handleAddTerm(chrome, info, tabId)
      .then(async (result) => {
        console.warn('[qa] add result', result);
        if (result.ok) {
          await updateMenuForInfo(chrome, info, tabId);
        }
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || 'ADD_FAILED' });
      });
    return true;
  }

  if (message.type === 'QA_CONTEXT_REMOVE') {
    const selectionText = (message.payload?.selectionText || '').trim();
    const info = { selectionText };
    const tabId = sender?.tab?.id ?? null;
    console.warn('[qa] remove selection', selectionText, 'tab', tabId);
    handleRemoveTerm(chrome, info, tabId)
      .then(async (result) => {
        console.warn('[qa] remove result', result);
        if (result.ok) {
          await updateMenuForInfo(chrome, info, tabId);
        }
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || 'REMOVE_FAILED' });
      });
    return true;
  }

  if (message.type === 'QA_CONTEXT_TOGGLE') {
    const tabId = sender?.tab?.id ?? null;
    console.warn('[qa] toggle request', tabId);
    handleTogglePage(chrome, tabId ?? 0)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || 'TOGGLE_FAILED' });
      });
    return true;
  }

  if (message.type === 'QA_GET_STORAGE_STATE') {
    const includeSession = message.payload?.includeSession !== false;
    chrome.storage.local.get(null, (localData) => {
      const localError = chrome.runtime.lastError;
      if (localError) {
        sendResponse({ ok: false, error: localError.message || '无法读取 storage.local' });
        return;
      }
      if (!includeSession || !chrome.storage?.session) {
        sendResponse({ ok: true, local: localData, session: {} });
        return;
      }
      chrome.storage.session.get(null, (sessionData) => {
        const sessionError = chrome.runtime.lastError;
        if (sessionError) {
          sendResponse({ ok: false, error: sessionError.message || '无法读取 storage.session' });
          return;
        }
        sendResponse({ ok: true, local: localData, session: sessionData });
      });
    });
    return true;
  }

  // 未识别消息：显式返回 false，避免悬空端口
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  setup();
});

chrome.runtime.onStartup.addListener(() => {
  setup();
});

setup();
