import { createStorageClient, createVocabularyManager, MAX_VOCABULARY } from './vocab-ui.js';
import {
  exportToTxt,
  exportToJson,
  importFromTxt,
  importFromJson
} from '../src/services/vocab-io.js';
// 移除默认 OAuth 强依赖：零登录同步不需要

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
  const keyEl = elements.key;
  const toggleKeyEl = elements.toggle;
  const saveEl = elements.save;
  const testEl = elements.test;

  const hasChrome = Boolean(chromeLike?.storage?.local);

  async function load() {
    if (!hasChrome) return;
    if (!modelEl || !keyEl) {
      console.warn('load: modelEl or keyEl not found');
      return;
    }
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
    if (!modelEl || !keyEl) {
      console.warn('save: modelEl or keyEl not found');
      notify('保存失败：配置元素未找到');
      return;
    }
    const payload = {
      model: modelEl.value,
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

  // 测试状态管理
  let isTestRunning = false;

  async function testConnection() {
    if (!hasChrome) {
      notify('当前环境不支持测试');
      return;
    }
    if (!modelEl || !keyEl) {
      console.warn('testConnection: modelEl or keyEl not found');
      notify('测试失败：配置元素未找到');
      return;
    }

    // 防抖：如果测试正在进行，忽略新的请求
    if (isTestRunning) {
      console.warn('[test] 测试正在进行中，忽略重复请求');
      return;
    }

    const payload = {
      model: modelEl.value,
      apiKey: keyEl.value.trim()
    };

    // 设置测试状态
    isTestRunning = true;
    if (testEl) {
      testEl.disabled = true;
      testEl.textContent = '测试中...';
    }

    try {
      console.info('[test] 开始测试');
      const response = await sendTestMessage(payload);
      if (response && response.ok) {
        notify('测试通过');
      } else {
        notify(`测试失败: ${response?.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('[test] 测试失败:', error);
      const message = error.message ? `测试失败: ${error.message}` : '测试失败';
      notify(message);
    } finally {
      // 恢复测试状态
      isTestRunning = false;
      if (testEl) {
        testEl.disabled = false;
        testEl.textContent = '测试';
      }
    }
  }

  function sendTestMessage(payload) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('请求超时'));
      }, 20000); // 20秒超时，给足够时间完成测试
      
      // 监听存储变化来获取测试结果
      const storageListener = (changes, namespace) => {
        if (namespace === 'local' && changes.testResult) {
          const result = changes.testResult.newValue;
          if (result && result.timestamp > Date.now() - 25000) { // 25秒内的结果
            clearTimeout(timeoutId);
            chromeLike.storage.onChanged.removeListener(storageListener);
            
            if (result.success) {
              resolve({ ok: true, message: '测试通过' });
            } else {
              reject(new Error(result.error || '测试失败'));
            }
          }
        }
      };
      
      chromeLike.storage.onChanged.addListener(storageListener);
      
      try {
        chromeLike.runtime.sendMessage(
          { type: 'TEST_TRANSLATOR_SETTINGS', payload },
          (response) => {
            const error = chromeLike.runtime?.lastError;
            if (error) {
              clearTimeout(timeoutId);
              chromeLike.storage.onChanged.removeListener(storageListener);
              reject(new Error(error.message));
            } else {
              // 立即响应表示测试已启动，等待存储变化获取结果
              console.info('[test] 测试已启动，等待结果...');
            }
          }
        );
      } catch (error) {
        clearTimeout(timeoutId);
        chromeLike.storage.onChanged.removeListener(storageListener);
        reject(error);
      }
    });
  }

  function toggleKeyVisibility() {
    if (!keyEl || !toggleKeyEl) {
      console.warn('toggleKeyVisibility: keyEl or toggleKeyEl not found');
      return;
    }
    
    if (keyEl.type === 'password') {
      keyEl.type = 'text';
      toggleKeyEl.textContent = '隐藏';
    } else {
      keyEl.type = 'password';
      toggleKeyEl.textContent = '显示';
    }
  }

  function bind() {
    if (toggleKeyEl) {
      toggleKeyEl.addEventListener('click', toggleKeyVisibility);
    }
    // base URL 已由后台映射，无需在前端变更
    if (saveEl) {
      saveEl.addEventListener('click', () => {
        save();
      });
    }
    if (testEl) {
      testEl.addEventListener('click', () => {
        testConnection();
      });
    }
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

export function initSettings(chromeLike, notify) {
  const settingsElements = {
    model: query('model'),
    key: query('key'),
    toggle: query('toggleKey'),
    save: query('save'),
    test: query('test')
  };
  const controller = createSettingsController({ chromeLike, notify, elements: settingsElements });
  controller.bind();
  controller.load();
  // 动态构建模型下拉（按提供商分组；当总数>10时使用optgroup）
  try {
    const build = async () => {
      const { MODEL_PROVIDERS } = await import('../src/config/model-providers.js');
      const select = settingsElements.model;
      if (!select) return;
      // 清理除第一个占位项以外的所有项
      while (select.options.length > 1) select.remove(1);
      const providerKeys = Object.keys(MODEL_PROVIDERS);
      const totalModels = providerKeys.reduce((acc, key) => acc + Object.keys(MODEL_PROVIDERS[key].models).length, 0);
      const useGrouping = totalModels > 10;
      if (useGrouping) {
        providerKeys.forEach((pkey) => {
          const provider = MODEL_PROVIDERS[pkey];
          const group = document.createElement('optgroup');
          group.label = provider.name;
          Object.keys(provider.models).forEach((modelKey) => {
            const opt = document.createElement('option');
            opt.value = provider.models[modelKey];
            opt.textContent = `${modelKey}`;
            group.appendChild(opt);
          });
          select.appendChild(group);
        });
      } else {
        providerKeys.forEach((pkey) => {
          const provider = MODEL_PROVIDERS[pkey];
          Object.keys(provider.models).forEach((modelKey) => {
            const opt = document.createElement('option');
            opt.value = provider.models[modelKey];
            opt.textContent = `${modelKey}`;
            select.appendChild(opt);
          });
        });
      }
      // 构建完成后，将默认选择设置为 qwen-mt-turbo（若存在）
      const defaultModel = 'qwen-mt-turbo';
      const hasDefault = Array.from(select.options).some((o) => o.value === defaultModel);
      if (hasDefault && !select.value) {
        select.value = defaultModel;
      }
    };
    build();
  } catch (err) {
    // 忽略下拉动态构建失败，不影响核心功能
    console.error('构建模型下拉失败', err);
  }
  return controller;
}

export function initImportExport(storage, notify) {
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

export function initQaPanel(chromeLike, storage, notify) {
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

  if (storage && typeof storage.subscribe === 'function') {
    storage.subscribe(() => {
      showStatus('', 'info');
    });
  }
}

export function initVocabulary(chromeLike) {
  const elements = collectVocabularyElements();
  const fallbackData = window.__MINI_TRANSLATE_VOCAB__ || [];
  const storage = createStorageClient({ chromeLike, fallbackData });
  const manager = createVocabularyManager({ elements, storage });
  manager.init();
  window.__miniTranslateVocabularyManager = manager;
  return { storage, manager };
}

export function initCloudSync(notify) {
  // 方案 a：无需 OAuth；展示随 Chrome 账号自动同步的提示
  const authStatus = query('auth-status');
  const syncStatusBadge = query('sync-status-badge');
  const syncStatusText = query('sync-status-text');
  const lastSyncTime = query('last-sync-time');

  const show = (el, text, cls) => {
    if (!el) return;
    if (typeof text === 'string') el.textContent = text;
    if (cls) {
      const dot = el.querySelector?.('.status-dot');
      if (dot) dot.className = cls;
    }
  };

  show(authStatus, '随 Chrome 账号自动同步', 'status-dot success');
  show(syncStatusBadge, '已启用', 'status-dot success');
  if (syncStatusText) syncStatusText.textContent = '正常';
  if (lastSyncTime) lastSyncTime.textContent = '';
}

export const __controllers = {
  createSettingsController,
  createImportExportController,
  initSettings,
  initImportExport,
  initVocabulary,
  initQaPanel,
  initCloudSync,
  createToastNotifier
};
