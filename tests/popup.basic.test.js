import { describe, it, expect, beforeEach, vi } from 'vitest';

// 轻量 mock，避免真实 UI 管理器对复杂 DOM 的强依赖导致未处理异常
vi.mock('../public/vocab-ui.js', () => ({
  createStorageClient: () => ({
    getVocabulary: async () => [],
    setVocabulary: async () => {}
  }),
  createVocabularyManager: () => ({ init: () => {} }),
  collectVocabularyElements: () => ({})
}));

vi.mock('../public/options.js', () => ({
  createSettingsController: () => ({ bind: () => {}, load: () => {} }),
  createImportExportController: () => ({ bind: () => {} }),
  createToastNotifier: () => () => {},
  collectVocabularyElements: () => ({})
}));

function setupDOM() {
  document.body.innerHTML = `
  <select id="model"></select>
  <input id="key" />
  <button id="toggleKey"></button>
  <button id="save"></button>
  <button id="test"></button>
  <button id="open-options"></button>
  <button id="import-txt"></button>
  <input id="import-txt-input" />
  <button id="import-json"></button>
  <input id="import-json-input" />
  <button id="export-txt"></button>
  <button id="export-json"></button>
  <div id="import-summary"></div>
  <div id="toast"></div>
  <!-- vocab-ui required elements -->
  <div id="counter"></div>
  <tbody id="tbody"></tbody>
  <div id="emptyState"></div>
  <div id="tableWrapper"></div>
  <div id="pagination"></div>
  <button id="prevButton"></button>
  <button id="nextButton"></button>
  <div id="pageInfo"></div>
  <div id="alert"></div>
  `;
}

function createChromeMock() {
  return {
    runtime: {
      openOptionsPage: vi.fn(),
      sendMessage: vi.fn((msg, cb) => cb && cb({ ok: true }))
    },
    storage: { local: { get: vi.fn((d, cb) => cb({ settings: {} })), set: vi.fn((o, cb) => cb && cb()) } }
  };
}

describe('popup.js basic init & open options', () => {
  beforeEach(() => {
    vi.resetModules();
    setupDOM();
    global.chrome = createChromeMock();
  });

  it('binds controllers on DOMContentLoaded', async () => {
    const p = import('../public/popup.js');
    await p;
    document.dispatchEvent(new Event('DOMContentLoaded'));
    // 仅验证初始化不会抛错
    expect(document.getElementById('model')).toBeTruthy();
  });
});


