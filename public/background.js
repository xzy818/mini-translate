import { initializeBackground } from '../src/services/context-menu.js';
import { translateText, validateTranslationConfig } from '../src/services/translator.js';

let initialized = false;

function setup() {
  if (initialized) return;
  initializeBackground(chrome);
  initialized = true;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === 'TEST_TRANSLATOR_SETTINGS') {
    const config = message.payload || {};
    const validation = validateTranslationConfig(config);
    if (!validation.isValid) {
      sendResponse({ ok: false, error: validation.errors.join('、') });
      return false;
    }

    translateText({
      text: 'diagnostic check',
      model: config.model,
      apiKey: config.apiKey,
      apiBaseUrl: config.apiBaseUrl,
      timeout: 5000
    })
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || '测试失败' });
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
});

chrome.runtime.onInstalled.addListener(() => {
  setup();
});

chrome.runtime.onStartup.addListener(() => {
  setup();
});

setup();
