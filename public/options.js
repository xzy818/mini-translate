import { createStorageClient, createVocabularyManager } from './vocab-ui.js';
import {
  exportToTxt,
  exportToJson,
  importFromTxt,
  importFromJson
} from '../src/services/vocab-io.js';
import { requestApiPermissions, checkApiPermissions } from '../src/services/permission-manager.js';

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

function wrapAsync(callback, chromeLike = chrome) {
  return new Promise((resolve, reject) => {
    try {
      const maybePromise = callback((result) => {
        // 检查chrome.runtime.lastError
        if (typeof chromeLike !== 'undefined' && chromeLike.runtime && chromeLike.runtime.lastError) {
          const error = chromeLike.runtime.lastError;
          // 忽略常见的连接错误
          if (error.message && (
              error.message.includes('Could not establish connection') ||
              error.message.includes('Receiving end does not exist') ||
              error.message.includes('The message port closed'))) {
            resolve(result);
            return;
          }
          reject(new Error(error.message));
          return;
        }
        resolve(result);
      }, reject);
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
      }, chromeLike);
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
      }, chromeLike);
      if (chromeLike.runtime?.sendMessage) {
        chromeLike.runtime.sendMessage({ type: 'SETTINGS_UPDATED', payload }, () => {
          // ignore callback errors for broadcast message
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
    
    // 前端验证，提供更友好的错误提示
    const errors = [];
    if (!modelEl.value) {
      errors.push('请选择翻译模型');
    }
    if (!baseEl.value.trim()) {
      errors.push('请填写API Base URL');
    }
    if (!keyEl.value.trim()) {
      errors.push('请填写API Key');
    }
    
    if (errors.length > 0) {
      notify(`请先完成配置: ${errors.join('、')}`);
      return;
    }
    
    // 检查并请求API权限
    try {
      const apiBaseUrl = baseEl.value.trim();
      let apiType = null;
      
      if (apiBaseUrl.includes('api.openai.com')) {
        apiType = 'openai';
      } else if (apiBaseUrl.includes('dashscope.aliyuncs.com')) {
        apiType = 'dashscope';
      } else if (apiBaseUrl.includes('api.deepseek.com')) {
        apiType = 'deepseek';
      }
      
      if (apiType) {
        const hasPermission = await checkApiPermissions(apiType);
        if (!hasPermission) {
          notify('🔐 需要请求网络权限，请点击确认...');
          const granted = await requestApiPermissions(apiType);
          if (!granted) {
            notify('❌ 权限请求被拒绝，无法测试连接');
            return;
          }
          notify('✅ 权限已授予，继续测试...');
        }
      }
    } catch (error) {
      console.log('❌ 权限检查失败:', error);
      notify('⚠️ 权限检查失败，但继续尝试测试...');
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
      }, chromeLike);
      if (response?.ok) {
        notify('✅ 测试通过，翻译功能配置正确');
      } else {
        const message = response?.error ? `❌ 测试失败: ${response.error}` : '❌ 测试失败';
        notify(message);
      }
    } catch (error) {
      console.error('测试异常', error);
      notify('❌ 测试异常，请检查网络连接');
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
    const text = await file.text();
    const current = await storage.getVocabulary();
    const result = importFromTxt(text, current);
    await storage.setVocabulary(result.list);
    const success = result.inserted || 0;
    const failed = result.failed?.length || 0;
    notify(`导入完成：成功 ${success} 条${failed ? `，失败 ${failed} 条` : ''}`);
    if (failed) {
      const detail = result.failed.slice(0, 5).map((item) => `${item.line}:${item.reason}`).join('，');
      showSummary(`失败条目(${failed})：${detail}${result.failed.length > 5 ? '…' : ''}`);
    } else {
      showSummary('导入成功');
    }
    importTxtInput.value = '';
  }

  async function importJson(file) {
    if (!file) return;
    const text = await file.text();
    const current = await storage.getVocabulary();
    const result = importFromJson(text, current);
    await storage.setVocabulary(result.list);
    const success = result.inserted || 0;
    const failed = result.failed?.length || 0;
    notify(`导入完成：成功 ${success} 条${failed ? `，失败 ${failed} 条` : ''}`);
    if (failed) {
      const detail = result.failed.slice(0, 5).map((item) => `${item.line}:${item.reason}`).join('，');
      showSummary(`失败条目(${failed})：${detail}${result.failed.length > 5 ? '…' : ''}`);
    } else {
      showSummary('导入成功');
    }
    importJsonInput.value = '';
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
  });
}

export const __controllers = {
  createSettingsController,
  createImportExportController,
  initSettings,
  initImportExport,
  initVocabulary,
  createToastNotifier
};
