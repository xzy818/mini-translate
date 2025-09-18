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
    const result = validateTranslationConfig(message.payload || {});
    if (!result.isValid) {
      sendResponse({ ok: false, error: result.errors.join('、') });
      return false;
    }
    // 轻量检测不访问外部 API
    sendResponse({ ok: true });
    return false;
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
});

chrome.runtime.onInstalled.addListener(() => {
  setup();
});

chrome.runtime.onStartup.addListener(() => {
  setup();
});

setup();
