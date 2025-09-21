import { initializeBackground } from '../src/services/context-menu.js';
import {
  translateText,
  validateTranslationConfig,
  normalizeApiBaseUrl
} from '../src/services/translator.js';

function getOriginPattern(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return {
      origin: url.origin,
      pattern: `${url.origin}/*`
    };
  } catch {
    return null;
  }
}

function checkOriginPermission(pattern) {
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins: [pattern] }, (granted) => {
      const error = chrome.runtime?.lastError;
      if (error) {
        resolve({ ok: false, error: error.message });
        return;
      }
      resolve({ ok: true, granted });
    });
  });
}

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

    const normalizedBaseUrl = validation.normalizedBaseUrl || config.apiBaseUrl;
    const originInfo = getOriginPattern(normalizedBaseUrl);
    if (!originInfo) {
      sendResponse({ ok: false, error: 'API Base URL 无效' });
      return false;
    }

    (async () => {
      const permission = await checkOriginPermission(originInfo.pattern);
      if (!permission.ok) {
        sendResponse({ ok: false, error: permission.error || '权限校验失败' });
        return;
      }
      if (!permission.granted) {
        sendResponse({ ok: false, error: `缺少访问权限：${originInfo.origin}` });
        return;
      }

      translateText({
        text: 'diagnostic check',
        model: config.model,
        apiKey: config.apiKey,
        apiBaseUrl: normalizedBaseUrl,
        timeout: 5000
      })
        .then(() => {
          sendResponse({ ok: true });
        })
        .catch((error) => {
          sendResponse({ ok: false, error: error.message || '测试失败' });
        });
    })();
    return true;
  }

  if (message.type === 'TRANSLATE_TERM') {
    const payload = message.payload || {};
    const normalizedBaseUrl = normalizeApiBaseUrl(payload.apiBaseUrl || '');
    const originInfo = getOriginPattern(normalizedBaseUrl);

    if (!originInfo) {
      sendResponse({ ok: false, error: 'API Base URL 未配置或无效' });
      return false;
    }

    (async () => {
      const permission = await checkOriginPermission(originInfo.pattern);
      if (!permission.ok) {
        sendResponse({ ok: false, error: permission.error || '权限校验失败' });
        return;
      }
      if (!permission.granted) {
        sendResponse({ ok: false, error: `缺少访问权限：${originInfo.origin}` });
        return;
      }

      translateText({ ...payload, apiBaseUrl: normalizedBaseUrl })
        .then((translation) => {
          sendResponse({ ok: true, translation });
        })
        .catch((error) => {
          sendResponse({ ok: false, error: error.message || '翻译失败' });
        });
    })();
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
