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
});

chrome.runtime.onInstalled.addListener(() => {
  setup();
});

chrome.runtime.onStartup.addListener(() => {
  setup();
});

setup();
