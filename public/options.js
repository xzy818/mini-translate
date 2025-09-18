import { createStorageClient, createVocabularyManager } from './vocab-ui.js';

const PAGE_SELECTORS = {
  counter: 'vocab-counter',
  tbody: 'vocab-body',
  emptyState: 'vocab-empty',
  tableWrapper: 'vocab-table-wrapper',
  pagination: 'vocab-pagination',
  prevButton: 'vocab-prev',
  nextButton: 'vocab-next',
  pageInfo: 'vocab-page-info',
  alert: 'vocab-alert'
};

function $(id) {
  return document.getElementById(id);
}

function collectVocabularyElements() {
  return {
    counter: $(PAGE_SELECTORS.counter),
    tbody: $(PAGE_SELECTORS.tbody),
    emptyState: $(PAGE_SELECTORS.emptyState),
    tableWrapper: $(PAGE_SELECTORS.tableWrapper),
    pagination: $(PAGE_SELECTORS.pagination),
    prevButton: $(PAGE_SELECTORS.prevButton),
    nextButton: $(PAGE_SELECTORS.nextButton),
    pageInfo: $(PAGE_SELECTORS.pageInfo),
    alert: $(PAGE_SELECTORS.alert)
  };
}

function initSettingsSection() {
  const modelEl = $('model');
  const baseEl = $('base');
  const keyEl = $('key');
  const toggleKeyEl = $('toggleKey');
  const saveEl = $('save');
  const testEl = $('test');
  const hasChrome = typeof chrome !== 'undefined' && chrome?.storage?.local;

  async function loadSettings() {
    if (!hasChrome) return;
    try {
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};
      if (settings.model) modelEl.value = settings.model;
      if (settings.apiBaseUrl) baseEl.value = settings.apiBaseUrl;
      if (settings.apiKey) keyEl.value = settings.apiKey;
    } catch (error) {
      console.error('读取设置失败', error);
      window.showToast?.('读取设置失败');
    }
  }

  async function saveSettings() {
    if (!hasChrome) {
      window.showToast?.('当前环境不支持保存');
      return;
    }
    const payload = {
      model: modelEl.value,
      apiBaseUrl: baseEl.value.trim(),
      apiKey: keyEl.value.trim()
    };
    try {
      await chrome.storage.local.set({ settings: payload });
      if (chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', payload });
      }
      window.showToast?.('已保存');
    } catch (error) {
      console.error('保存失败', error);
      window.showToast?.('保存失败');
    }
  }

  async function testSettings() {
    if (!hasChrome) {
      window.showToast?.('当前环境不支持测试');
      return;
    }
    const payload = {
      model: modelEl.value,
      apiBaseUrl: baseEl.value.trim(),
      apiKey: keyEl.value.trim()
    };
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_TRANSLATOR_SETTINGS',
        payload
      });
      if (response?.ok) {
        window.showToast?.('测试通过');
      } else {
        const message = response?.error ? `测试失败: ${response.error}` : '测试失败';
        window.showToast?.(message);
      }
    } catch (error) {
      console.error('测试异常', error);
      window.showToast?.('测试异常');
    }
  }

  function toggleKeyVisibility() {
    if (keyEl.type === 'password') {
      keyEl.type = 'text';
      toggleKeyEl.textContent = '隐藏';
    } else {
      keyEl.type = 'password';
      toggleKeyEl.textContent = '显示';
    }
  }

  toggleKeyEl.addEventListener('click', toggleKeyVisibility);
  saveEl.addEventListener('click', saveSettings);
  testEl.addEventListener('click', testSettings);
  loadSettings();
}

function initVocabularySection() {
  const elements = collectVocabularyElements();
  const fallbackData = window.__MINI_TRANSLATE_VOCAB__ || [];
  const storage = createStorageClient({
    chromeLike: typeof chrome !== 'undefined' ? chrome : null,
    fallbackData
  });
  const manager = createVocabularyManager({ elements, storage });
  manager.init();
  window.__miniTranslateVocabularyManager = manager;
}

document.addEventListener('DOMContentLoaded', () => {
  initVocabularySection();
  initSettingsSection();
});
