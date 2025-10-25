#!/usr/bin/env bash
set -euo pipefail

# 修复 popup.js 为非模块格式
echo "🔧 Converting popup.js to non-module format..."

# 创建非模块版本的 popup.js
cat > "dist/popup.js" << 'EOF'
// 非模块版本的 popup.js
console.log('Popup script loaded (non-module)');

// 全局变量
let createSettingsController, createImportExportController, createToastNotifier, collectVocabularyElements;
let createStorageClient, createVocabularyManager;

// 模拟模块加载（同步方式）
function loadModulesSync() {
  try {
    // 直接引用全局函数，而不是导入模块
    // 这些函数应该在 options.js 和 vocab-ui.js 中定义为全局函数
    
    // 检查是否已经加载
    if (typeof window.createSettingsController === 'function') {
      createSettingsController = window.createSettingsController;
      createImportExportController = window.createImportExportController;
      createToastNotifier = window.createToastNotifier;
      collectVocabularyElements = window.collectVocabularyElements;
      createStorageClient = window.createStorageClient;
      createVocabularyManager = window.createVocabularyManager;
      return true;
    }
    
    console.warn('Global functions not found, using fallback');
    return false;
  } catch (error) {
    console.error('Failed to load modules:', error);
    return false;
  }
}

// 降级处理函数
function createFallbackFunctions() {
  createSettingsController = function() { return { bind: () => {}, load: () => {} }; };
  createImportExportController = function() { return { bind: () => {} }; };
  createToastNotifier = function() { return { show: () => {}, hide: () => {} }; };
  collectVocabularyElements = function() { return []; };
  createStorageClient = function() { return { get: () => Promise.resolve({}), set: () => Promise.resolve() }; };
  createVocabularyManager = function() { return { load: () => Promise.resolve(), save: () => Promise.resolve() }; };
}

// 初始化函数
function initVocabularyPopup() {
  console.log('Initializing vocabulary popup...');
  
  // 尝试加载模块
  const modulesLoaded = loadModulesSync();
  
  if (!modulesLoaded) {
    console.warn('Using fallback functions');
    createFallbackFunctions();
  }
  
  // 初始化存储
  const storage = {
    get: (key) => {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.get([key], (result) => {
            resolve(result[key] || {});
          });
        } else {
          resolve({});
        }
      });
    },
    set: (key, value) => {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.set({ [key]: value }, () => {
            resolve();
          });
        } else {
          resolve();
        }
      });
    }
  };
  
  return { storage };
}

// 获取设置元素
function getSettingsElements() {
  return {
    apiKeyInput: document.getElementById('api-key'),
    modelSelect: document.getElementById('model'),
    saveBtn: document.getElementById('save-settings')
  };
}

// 获取导入导出元素
function getImportExportElements() {
  return {
    importBtn: document.getElementById('import-vocab'),
    exportBtn: document.getElementById('export-vocab'),
    importFile: document.getElementById('import-file')
  };
}

// 主初始化
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing popup...');
    
    const chromeLike = typeof chrome !== 'undefined' ? chrome : null;
    const notify = createToastNotifier ? createToastNotifier(document) : { show: () => {}, hide: () => {} };

    const { storage } = initVocabularyPopup();

    // 设置控制器
    const settingsElements = getSettingsElements();
    const settingsController = createSettingsController ? 
      createSettingsController({ chromeLike, notify, elements: settingsElements }) :
      { bind: () => {}, load: () => {} };
    settingsController.bind();
    settingsController.load();

    // 导入导出控制器
    const importExportElements = getImportExportElements();
    const importExportController = createImportExportController ?
      createImportExportController({ storage, notify, elements: importExportElements }) :
      { bind: () => {} };
    importExportController.bind();

    // 打开选项页面按钮
    const openOptionsBtn = document.getElementById('open-options');
    if (openOptionsBtn && chromeLike?.runtime?.openOptionsPage) {
      openOptionsBtn.addEventListener('click', () => {
        chromeLike.runtime.openOptionsPage();
      });
    }

    console.log('Popup initialization completed');
  });
}
EOF

echo "✅ popup.js converted to non-module format"
