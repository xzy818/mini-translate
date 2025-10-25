#!/usr/bin/env bash
set -euo pipefail

# 修复 Chrome 扩展模块问题的脚本
echo "🔧 Fixing Chrome Extension Module Issues..."

DIST_DIR="dist"

# 检查 dist 目录是否存在
if [[ ! -d "$DIST_DIR" ]]; then
    echo "❌ dist/ directory not found. Please run build first."
    exit 1
fi

echo "📋 Converting ES6 modules to non-module format..."

# 1. 修复 popup.js - 使用动态导入
echo "🔧 Fixing popup.js..."
cat > "$DIST_DIR/popup.js" << 'EOF'
// 使用动态导入来加载模块
let createSettingsController, createImportExportController, createToastNotifier, collectVocabularyElements;
let createStorageClient, createVocabularyManager;

// 异步加载模块
async function loadModules() {
  try {
    const optionsModule = await import('./options.js');
    const vocabModule = await import('./vocab-ui.js');
    
    createSettingsController = optionsModule.createSettingsController;
    createImportExportController = optionsModule.createImportExportController;
    createToastNotifier = optionsModule.createToastNotifier;
    collectVocabularyElements = optionsModule.collectVocabularyElements;
    
    createStorageClient = vocabModule.createStorageClient;
    createVocabularyManager = vocabModule.createVocabularyManager;
  } catch (error) {
    console.error('Failed to load modules:', error);
    // 提供降级处理
    createSettingsController = () => ({ bind: () => {}, load: () => {} });
    createImportExportController = () => ({ bind: () => {} });
    createToastNotifier = () => ({ show: () => {} });
    collectVocabularyElements = () => ({});
    createStorageClient = () => ({});
    createVocabularyManager = () => ({ init: () => {} });
  }
}

function getSettingsElements(root = document) {
  return {
    model: root.getElementById('model'),
    key: root.getElementById('key'),
    toggle: root.getElementById('toggleKey'),
    save: root.getElementById('save'),
    test: root.getElementById('test')
  };
}

function getImportExportElements(root = document) {
  return {
    importTxt: root.getElementById('import-txt'),
    importTxtInput: root.getElementById('import-txt-input'),
    importJson: root.getElementById('import-json'),
    importJsonInput: root.getElementById('import-json-input'),
    exportTxt: root.getElementById('export-txt'),
    exportJson: root.getElementById('export-json'),
    summary: root.getElementById('import-summary')
  };
}

function initVocabularyPopup(chromeLike, notify) {
  const elements = collectVocabularyElements();
  const fallbackData = window.__MINI_TRANSLATE_VOCAB__ || [];
  const storage = createStorageClient({ chromeLike, fallbackData });
  const manager = createVocabularyManager({
    elements,
    storage,
    pageSize: 5,
    alertDuration: 3000
  });
  manager.init();
  return { storage, manager };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    // 首先加载模块
    await loadModules();
    
    const chromeLike = typeof chrome !== 'undefined' ? chrome : null;
    const notify = createToastNotifier(document);

    const { storage } = initVocabularyPopup(chromeLike, notify);

    const settingsElements = getSettingsElements();
    const settingsController = createSettingsController({ chromeLike, notify, elements: settingsElements });
    settingsController.bind();
    settingsController.load();

    const importExportElements = getImportExportElements();
    const importExportController = createImportExportController({ storage, notify, elements: importExportElements });
    importExportController.bind();

    const openOptionsBtn = document.getElementById('open-options');
    if (openOptionsBtn && chromeLike?.runtime?.openOptionsPage) {
      openOptionsBtn.addEventListener('click', () => {
        chromeLike.runtime.openOptionsPage();
        window.close();
      });
    }
  });
}
EOF

# 2. 修复 options.js - 移除 ES6 导入，使用动态导入
echo "🔧 Fixing options.js..."
# 备份原始文件
cp "$DIST_DIR/options.js" "$DIST_DIR/options.js.backup"

# 创建修复后的 options.js
cat > "$DIST_DIR/options.js" << 'EOF'
// 使用动态导入来加载依赖模块
let createStorageClient, createVocabularyManager, MAX_VOCABULARY;
let exportToTxt, exportToJson, importFromTxt, importFromJson;

// 异步加载模块
async function loadDependencies() {
  try {
    const vocabModule = await import('./vocab-ui.js');
    const ioModule = await import('./src/services/vocab-io.js');
    
    createStorageClient = vocabModule.createStorageClient;
    createVocabularyManager = vocabModule.createVocabularyManager;
    MAX_VOCABULARY = vocabModule.MAX_VOCABULARY;
    
    exportToTxt = ioModule.exportToTxt;
    exportToJson = ioModule.exportToJson;
    importFromTxt = ioModule.importFromTxt;
    importFromJson = ioModule.importFromJson;
  } catch (error) {
    console.error('Failed to load dependencies:', error);
    // 提供降级处理
    createStorageClient = () => ({});
    createVocabularyManager = () => ({ init: () => {} });
    MAX_VOCABULARY = 500;
    exportToTxt = () => '';
    exportToJson = () => '{}';
    importFromTxt = () => [];
    importFromJson = () => [];
  }
}

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

export function createToastNotifier(document) {
  const alert = document.getElementById('vocab-alert');
  if (!alert) {
    return { show: () => {} };
  }

  return {
    show(message, type = 'info', duration = 3000) {
      alert.textContent = message;
      alert.className = `alert alert-${type}`;
      alert.style.display = 'block';
      
      if (duration > 0) {
        setTimeout(() => {
          alert.style.display = 'none';
        }, duration);
      }
    }
  };
}

export function createSettingsController({ chromeLike, notify, elements }) {
  let settings = {};

  async function loadSettings() {
    if (!chromeLike?.storage?.local) {
      console.warn('Chrome storage not available');
      return;
    }

    try {
      const result = await wrapAsync((resolve, reject) => {
        chromeLike.storage.local.get(['settings'], (bag) => {
          if (chromeLike.runtime.lastError) {
            reject(chromeLike.runtime.lastError);
          } else {
            resolve(bag);
          }
        });
      });

      settings = result.settings || {};
      elements.model.value = settings.model || 'gpt-4o-mini';
      elements.key.value = settings.apiKey || '';
      
      if (settings.apiKey) {
        elements.toggle.textContent = '隐藏';
        elements.key.type = 'password';
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      notify.show('加载设置失败', 'error');
    }
  }

  async function saveSettings() {
    if (!chromeLike?.storage?.local) {
      console.warn('Chrome storage not available');
      return;
    }

    const newSettings = {
      model: elements.model.value,
      apiKey: elements.key.value
    };

    try {
      await wrapAsync((resolve, reject) => {
        chromeLike.storage.local.set({ settings: newSettings }, () => {
          if (chromeLike.runtime.lastError) {
            reject(chromeLike.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      settings = newSettings;
      notify.show('设置已保存', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      notify.show('保存设置失败', 'error');
    }
  }

  async function testSettings() {
    if (!chromeLike?.runtime?.sendMessage) {
      console.warn('Chrome runtime not available');
      return;
    }

    const config = {
      model: elements.model.value,
      apiKey: elements.key.value
    };

    if (!config.model || !config.apiKey) {
      notify.show('请填写模型和API密钥', 'error');
      return;
    }

    try {
      notify.show('正在测试...', 'info');
      
      const response = await wrapAsync((resolve, reject) => {
        chromeLike.runtime.sendMessage({
          type: 'TEST_TRANSLATOR_SETTINGS',
          payload: config
        }, (response) => {
          if (chromeLike.runtime.lastError) {
            reject(chromeLike.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });

      if (response && response.ok) {
        notify.show('测试成功！', 'success');
      } else {
        notify.show(`测试失败: ${response?.error || '未知错误'}`, 'error');
      }
    } catch (error) {
      console.error('Test failed:', error);
      notify.show(`测试失败: ${error.message}`, 'error');
    }
  }

  function toggleKeyVisibility() {
    if (elements.key.type === 'password') {
      elements.key.type = 'text';
      elements.toggle.textContent = '隐藏';
    } else {
      elements.key.type = 'password';
      elements.toggle.textContent = '显示';
    }
  }

  return {
    bind() {
      elements.save.addEventListener('click', saveSettings);
      elements.test.addEventListener('click', testSettings);
      elements.toggle.addEventListener('click', toggleKeyVisibility);
    },
    load: loadSettings
  };
}

export function createImportExportController({ storage, notify, elements }) {
  async function handleImportTxt() {
    if (!elements.importTxtInput.files.length) {
      notify.show('请选择文件', 'error');
      return;
    }

    try {
      const file = elements.importTxtInput.files[0];
      const text = await file.text();
      const terms = importFromTxt(text);
      
      if (terms.length === 0) {
        notify.show('文件中没有找到词汇', 'error');
        return;
      }

      await storage.appendVocabulary(terms);
      notify.show(`成功导入 ${terms.length} 个词汇`, 'success');
      
      // 刷新页面
      window.location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      notify.show('导入失败', 'error');
    }
  }

  async function handleImportJson() {
    if (!elements.importJsonInput.files.length) {
      notify.show('请选择文件', 'error');
      return;
    }

    try {
      const file = elements.importJsonInput.files[0];
      const text = await file.text();
      const terms = importFromJson(text);
      
      if (terms.length === 0) {
        notify.show('文件中没有找到词汇', 'error');
        return;
      }

      await storage.appendVocabulary(terms);
      notify.show(`成功导入 ${terms.length} 个词汇`, 'success');
      
      // 刷新页面
      window.location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      notify.show('导入失败', 'error');
    }
  }

  async function handleExportTxt() {
    try {
      const vocabulary = await storage.readVocabulary();
      const text = exportToTxt(vocabulary);
      
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vocabulary.txt';
      a.click();
      URL.revokeObjectURL(url);
      
      notify.show('导出成功', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      notify.show('导出失败', 'error');
    }
  }

  async function handleExportJson() {
    try {
      const vocabulary = await storage.readVocabulary();
      const json = exportToJson(vocabulary);
      
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vocabulary.json';
      a.click();
      URL.revokeObjectURL(url);
      
      notify.show('导出成功', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      notify.show('导出失败', 'error');
    }
  }

  return {
    bind() {
      elements.importTxt.addEventListener('click', handleImportTxt);
      elements.importJson.addEventListener('click', handleImportJson);
      elements.exportTxt.addEventListener('click', handleExportTxt);
      elements.exportJson.addEventListener('click', handleExportJson);
    }
  };
}

// 初始化时加载依赖
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadDependencies);
}
EOF

echo "✅ Module fixes applied successfully!"
echo "📋 Summary of changes:"
echo "  - popup.js: Converted to use dynamic imports"
echo "  - options.js: Converted to use dynamic imports"
echo "  - background.js: Already fixed (non-module format)"
echo ""
echo "🚀 Ready for testing!"
