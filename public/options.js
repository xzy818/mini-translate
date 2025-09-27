import { createStorageClient, createVocabularyManager, MAX_VOCABULARY } from './vocab-ui.js';
import {
  exportToTxt,
  exportToJson,
  importFromTxt,
  importFromJson
} from '../src/services/vocab-io.js';

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

export function query(id, root = document) {
  return root.getElementById(id);
}

export function collectVocabularyElements(root = document) {
  return {
    counter: query(PAGE_SELECTORS.counter, root),
    tbody: query(PAGE_SELECTORS.tbody, root),
    emptyState: query(PAGE_SELECTORS.emptyState, root),
    tableWrapper: query(PAGE_SELECTORS.tableWrapper, root),
    pagination: query(PAGE_SELECTORS.pagination, root),
    prevButton: query(PAGE_SELECTORS.prevButton, root),
    nextButton: query(PAGE_SELECTORS.nextButton, root),
    pageInfo: query(PAGE_SELECTORS.pageInfo, root),
    alert: query(PAGE_SELECTORS.alert, root)
  };
}

function wrapAsync(callback) {
  return new Promise((resolve, reject) => {
    try {
      const maybePromise = callback(resolve, reject);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve).catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

export function createToastNotifier(root = document) {
  if (!root || typeof root.createElement !== 'function') {
    return () => {};
  }
  let timer = null;
  let toast = root.getElementById('toast');
  if (!toast) {
    toast = root.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.style.display = 'none';
    root.body?.appendChild(toast);
  }
  return (message) => {
    if (!toast || !message) {
      return;
    }
    toast.textContent = message;
    toast.style.display = 'block';
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      toast.style.display = 'none';
    }, 1800);
  };
}

export function createSettingsController({ chromeLike, notify, elements }) {
  const modelEl = elements.model;
  const baseEl = elements.base;
  const keyEl = elements.key;
  const toggleKeyEl = elements.toggle;
  const saveEl = elements.save;
  const testEl = elements.test;

  const hasChrome = Boolean(chromeLike?.storage?.local);

  async function load() {
    if (!hasChrome) return;
    try {
      const result = await wrapAsync((resolve, reject) => {
        chromeLike.storage.local.get(['settings'], (items) => {
          const error = chromeLike.runtime?.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve(items.settings || {});
        });
      });
      if (result.model) modelEl.value = result.model;
      if (result.apiBaseUrl) baseEl.value = result.apiBaseUrl;
      if (result.apiKey) keyEl.value = result.apiKey;
    } catch (error) {
      console.error('读取设置失败', error);
      notify('读取设置失败');
    }
  }

  async function save() {
    if (!hasChrome) {
      notify('当前环境不支持保存');
      return;
    }
    const payload = {
      model: modelEl.value,
      apiBaseUrl: baseEl.value.trim(),
      apiKey: keyEl.value.trim()
    };
    try {
      await wrapAsync((resolve, reject) => {
        chromeLike.storage.local.set({ settings: payload }, () => {
          const error = chromeLike.runtime?.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve();
        });
      });
      if (chromeLike.runtime?.sendMessage) {
        chromeLike.runtime.sendMessage({ type: 'SETTINGS_UPDATED', payload }, () => {
          const broadcastError = chromeLike.runtime?.lastError;
          if (broadcastError) {
            // Access lastError to avoid unchecked runtime warnings in devtools.
          }
        });
      }
      notify('已保存');
    } catch (error) {
      console.error('保存失败', error);
      notify('保存失败');
    }
  }

  async function testConnection() {
    if (!hasChrome) {
      notify('当前环境不支持测试');
      return;
    }
    const payload = {
      model: modelEl.value,
      apiBaseUrl: baseEl.value.trim(),
      apiKey: keyEl.value.trim()
    };
    try {
      const response = await wrapAsync((resolve, reject) => {
        chromeLike.runtime.sendMessage(
          { type: 'TEST_TRANSLATOR_SETTINGS', payload },
          (res) => {
            const error = chromeLike.runtime?.lastError;
            if (error) {
              reject(new Error(error.message));
              return;
            }
            resolve(res);
          }
        );
      });
      if (response?.ok) {
        notify('测试通过');
      } else {
        const message = response?.error ? `测试失败: ${response.error}` : '测试失败';
        notify(message);
      }
    } catch (error) {
      console.error('测试异常', error);
      notify('测试异常');
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

  function bind() {
    toggleKeyEl.addEventListener('click', toggleKeyVisibility);
    saveEl.addEventListener('click', () => {
      save();
    });
    testEl.addEventListener('click', () => {
      testConnection();
    });
  }

  return { load, save, testConnection, toggleKeyVisibility, bind };
}

export function triggerDownload(filename, data, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function createImportExportController({
  storage,
  notify,
  elements,
  download = triggerDownload,
  now = () => new Date()
}) {
  const importTxtBtn = elements.importTxt;
  const importTxtInput = elements.importTxtInput;
  const importJsonBtn = elements.importJson;
  const importJsonInput = elements.importJsonInput;
  const exportTxtBtn = elements.exportTxt;
  const exportJsonBtn = elements.exportJson;
  const summaryEl = elements.summary;

  function showSummary(message) {
    if (!summaryEl) return;
    summaryEl.textContent = message;
    summaryEl.hidden = !message;
  }

  function resetInput(input) {
    if (input) {
      input.value = '';
    }
  }

  function isFileType(file, expectedExtensions) {
    if (!file) return false;
    const name = typeof file.name === 'string' ? file.name.toLowerCase() : '';
    return expectedExtensions.some((ext) => name.endsWith(ext));
  }

  function summarizeFailures(failed = []) {
    if (!failed.length) return '';
    const reasonMap = {
      INVALID_JSON: 'JSON 解析失败',
      INVALID_TERM: '格式不正确',
      LIMIT_EXCEEDED: '超过词库上限',
      EMPTY_FILE: '空文件'
    };
    const grouped = failed.reduce((acc, item) => {
      const reason = reasonMap[item.reason] || item.reason || '未知错误';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([reason, count]) => `${reason} ×${count}`)
      .join('，');
  }

  function reportImportResult({ inserted, failed, hadContent, mode }) {
    const failedCount = failed?.length || 0;

    if (!hadContent) {
      notify(`${mode} 导入失败：空文件或格式无效`);
      showSummary('未导入任何词条：空文件或格式无效');
      return;
    }

    const headline = `导入完成：成功 ${inserted} 条${failedCount ? `，失败 ${failedCount} 条` : ''}`;
    notify(headline);

    if (failedCount) {
      const detail = summarizeFailures(failed);
      showSummary(detail ? `失败明细：${detail}` : '存在未导入的条目，请查看日志');
    } else if (inserted === 0) {
      showSummary('未导入新的词条（可能已全部存在或被跳过）');
    } else {
      showSummary('导入成功');
    }
  }

  async function exportTxt() {
    const list = await storage.getVocabulary();
    const content = exportToTxt(list);
    const filename = `mini-translate-vocab-${now().toISOString().slice(0, 10)}.txt`;
    download(filename, content, 'text/plain');
    notify('已导出 TXT');
  }

  async function exportJson() {
    const list = await storage.getVocabulary();
    const content = exportToJson(list);
    const filename = `mini-translate-vocab-${now().toISOString().slice(0, 10)}.json`;
    download(filename, content, 'application/json');
    notify('已导出 JSON');
  }

  async function importTxt(file) {
    if (!file) return;
    if (!isFileType(file, ['.txt'])) {
      notify('仅支持 TXT 文件导入');
      showSummary('导入失败：请使用 .txt 文件');
      resetInput(importTxtInput);
      return;
    }
    const text = await file.text();
    const hadContent = Boolean(text?.trim());
    if (!hadContent) {
      notify('TXT 导入失败：空文件或格式无效');
      showSummary('未导入任何词条：空文件或格式无效');
      resetInput(importTxtInput);
      return;
    }
    const current = await storage.getVocabulary();
    const result = importFromTxt(text, current);
    await storage.setVocabulary(result.list);
    reportImportResult({ ...result, hadContent: true, mode: 'TXT' });
    resetInput(importTxtInput);
  }

  async function importJson(file) {
    if (!file) return;
    if (!isFileType(file, ['.json'])) {
      notify('仅支持 JSON 文件导入');
      showSummary('导入失败：请使用 .json 文件');
      resetInput(importJsonInput);
      return;
    }
    const text = await file.text();
    const hadContent = Boolean(text?.trim());
    if (!hadContent) {
      notify('JSON 导入失败：空文件或格式无效');
      showSummary('未导入任何词条：空文件或格式无效');
      resetInput(importJsonInput);
      return;
    }
    const current = await storage.getVocabulary();
    const result = importFromJson(text, current);
    await storage.setVocabulary(result.list);
    reportImportResult({ ...result, hadContent: true, mode: 'JSON' });
    resetInput(importJsonInput);
  }

  function bind() {
    exportTxtBtn.addEventListener('click', () => {
      exportTxt();
    });
    exportJsonBtn.addEventListener('click', () => {
      exportJson();
    });
    importTxtBtn.addEventListener('click', () => importTxtInput.click());
    importJsonBtn.addEventListener('click', () => importJsonInput.click());
    importTxtInput.addEventListener('change', (event) => {
      const [file] = event.target.files || [];
      importTxt(file);
    });
    importJsonInput.addEventListener('change', (event) => {
      const [file] = event.target.files || [];
      importJson(file);
    });
  }

  return {
    exportTxt,
    exportJson,
    importTxt,
    importJson,
    bind
  };
}

function initSettings(chromeLike, notify) {
  const settingsElements = {
    model: query('model'),
    base: query('base'),
    key: query('key'),
    toggle: query('toggleKey'),
    save: query('save'),
    test: query('test')
  };
  const controller = createSettingsController({ chromeLike, notify, elements: settingsElements });
  controller.bind();
  controller.load();
  return controller;
}

function initImportExport(storage, notify) {
  const elements = {
    importTxt: query('import-txt'),
    importTxtInput: query('import-txt-input'),
    importJson: query('import-json'),
    importJsonInput: query('import-json-input'),
    exportTxt: query('export-txt'),
    exportJson: query('export-json'),
    summary: query('import-summary')
  };
  const controller = createImportExportController({ storage, notify, elements });
  controller.bind();
  return controller;
}

function initQaPanel(chromeLike, storage, notify) {
  if (!chromeLike || !chromeLike.runtime) {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('qa') !== '1') {
    return;
  }
  const panel = document.getElementById('qa-panel');
  if (!panel) {
    return;
  }
  panel.hidden = false;

  const termInput = document.getElementById('qa-term-input');
  const statusEl = document.getElementById('qa-status');
  const addBtn = document.getElementById('qa-add');
  const removeBtn = document.getElementById('qa-remove');
  const toggleBtn = document.getElementById('qa-toggle');

  const showStatus = (message, tone = 'info') => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.hidden = !message;
    statusEl.dataset.tone = tone;
  };

  const getTerm = () => (termInput?.value || '').trim();

  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const term = getTerm();
      if (!term) {
        showStatus('请输入测试词条', 'error');
        return;
      }
      try {
        const existing = await storage.getVocabulary();
        const normalized = existing.filter((item) => item.term !== term);
        if (normalized.length >= MAX_VOCABULARY) {
          showStatus('词库已满（500 条），请清理后再尝试', 'error');
          return;
        }
        const entry = {
          term,
          translation: '',
          type: term.split(/\s+/).length > 1 ? 'phrase' : 'word',
          length: term.length,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: null
        };
        normalized.push(entry);
        await storage.setVocabulary(normalized);
        showStatus(`已添加词条：${term}`, 'success');
      } catch (error) {
        showStatus(`添加失败：${error.message}`, 'error');
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      const term = getTerm();
      if (!term) {
        showStatus('请输入测试词条', 'error');
        return;
      }
      try {
        const result = await storage.removeTerm(term);
        if (result.removed) {
          showStatus(`已移除词条：${term}`, 'success');
        } else {
          showStatus('词条不存在或已被移除', 'info');
        }
      } catch (error) {
        showStatus(`移除失败：${error.message}`, 'error');
      }
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      try {
        const stateKey = 'miniTranslateTabState';
        const current = await new Promise((resolve, reject) => {
          chromeLike.storage.session.get({ [stateKey]: {} }, (items) => {
            const error = chromeLike.runtime?.lastError;
            if (error) {
              reject(new Error(error.message));
              return;
            }
            resolve(items[stateKey] || {});
          });
        });
        const key = 'qa-global';
        const nextEnabled = !current[key]?.enabled;
        const nextState = {
          ...current,
          [key]: { enabled: nextEnabled, updatedAt: Date.now() }
        };
        await new Promise((resolve, reject) => {
          chromeLike.storage.session.set({ [stateKey]: nextState }, () => {
            const error = chromeLike.runtime?.lastError;
            if (error) {
              reject(new Error(error.message));
              return;
            }
            resolve();
          });
        });
        showStatus(nextEnabled ? '已开启页面翻译 (QA)' : '已关闭页面翻译 (QA)', 'info');
      } catch (error) {
        showStatus(`切换失败：${error.message}`, 'error');
      }
    });
  }

  if (storage && typeof storage.subscribe === 'function') {
    storage.subscribe(() => {
      showStatus('', 'info');
    });
  }
}

function initVocabulary(chromeLike) {
  const elements = collectVocabularyElements();
  const fallbackData = window.__MINI_TRANSLATE_VOCAB__ || [];
  const storage = createStorageClient({ chromeLike, fallbackData });
  const manager = createVocabularyManager({ elements, storage });
  manager.init();
  window.__miniTranslateVocabularyManager = manager;
  return { storage, manager };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const chromeLike = typeof chrome !== 'undefined' ? chrome : null;
    const notify = createToastNotifier(document);
    const { storage } = initVocabulary(chromeLike);
    initSettings(chromeLike, notify);
    initImportExport(storage, notify);
    initQaPanel(chromeLike, storage, notify);
  });
}

export const __controllers = {
  createSettingsController,
  createImportExportController,
  initSettings,
  initImportExport,
  initVocabulary,
  initQaPanel,
  createToastNotifier
};
