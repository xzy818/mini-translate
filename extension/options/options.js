import { createStorageClient, createMemoryStorageClient } from '../services/storage.js';
import { createVocabularyUI } from './vocabulary-ui.js';

function queryElement(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`未找到元素 #${id}`);
  }
  return el;
}

function collectElements() {
  return {
    counter: queryElement('vocab-counter'),
    tbody: queryElement('vocab-body'),
    emptyState: queryElement('empty-state'),
    tableWrapper: queryElement('table-wrapper'),
    pagination: queryElement('pagination'),
    prevButton: queryElement('prev-page'),
    nextButton: queryElement('next-page'),
    pageInfo: queryElement('page-info'),
    alert: queryElement('alert')
  };
}

function createSampleData() {
  const now = Date.now();
  return Array.from({ length: 12 }).map((_, index) => {
    const createdAt = new Date(now - index * 3600 * 1000).toISOString();
    const term = index % 3 === 0 ? `sample phrase ${index + 1}` : `sample-${index + 1}`;
    const type = term.includes(' ') ? 'phrase' : 'word';
    return {
      term,
      translation: `示例 ${index + 1}`,
      type,
      length: term.length,
      createdAt,
      updatedAt: createdAt,
      status: index % 5 === 0 ? 'inactive' : 'active'
    };
  });
}

function resolveStorage() {
  const hasChrome = typeof chrome !== 'undefined' && chrome?.storage?.local;
  if (hasChrome) {
    return createStorageClient({ chromeLike: chrome });
  }
  const fallbackData = window.__MINI_TRANSLATE_VOCAB__ ?? createSampleData();
  return createMemoryStorageClient(fallbackData);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const storage = resolveStorage();
    const ui = createVocabularyUI({
      storage,
      elements: collectElements()
    });
    await ui.init();
    window.__miniTranslateUI = ui;
  } catch (error) {
    console.error('初始化词库管理页面失败', error);
    const alert = document.getElementById('alert');
    if (alert) {
      alert.hidden = false;
      alert.textContent = '初始化失败，请刷新页面重试。';
    }
  }
});
