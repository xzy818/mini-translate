#!/usr/bin/env bash
set -euo pipefail

# 修复所有模块为非模块格式
echo "🔧 Converting all modules to non-module format..."

# 1. 修复 options.js
echo "🔧 Fixing options.js..."
cat > "dist/options.js" << 'EOF'
// 非模块版本的 options.js
console.log('Options script loaded (non-module)');

// 全局函数定义
window.createSettingsController = function({ chromeLike, notify, elements }) {
  return {
    bind() {
      console.log('Settings controller bound');
      if (elements.saveBtn) {
        elements.saveBtn.addEventListener('click', () => {
          this.save();
        });
      }
    },
    load() {
      console.log('Settings controller loaded');
      if (chromeLike && chromeLike.storage) {
        chromeLike.storage.local.get(['apiKey', 'model'], (result) => {
          if (elements.apiKeyInput) {
            elements.apiKeyInput.value = result.apiKey || '';
          }
          if (elements.modelSelect) {
            elements.modelSelect.value = result.model || 'qwen';
          }
        });
      }
    },
    save() {
      console.log('Saving settings...');
      if (chromeLike && chromeLike.storage) {
        const settings = {
          apiKey: elements.apiKeyInput ? elements.apiKeyInput.value : '',
          model: elements.modelSelect ? elements.modelSelect.value : 'qwen'
        };
        chromeLike.storage.local.set(settings, () => {
          if (notify && notify.show) {
            notify.show('Settings saved successfully!');
          }
        });
      }
    }
  };
};

window.createImportExportController = function({ storage, notify, elements }) {
  return {
    bind() {
      console.log('Import/Export controller bound');
      if (elements.importBtn) {
        elements.importBtn.addEventListener('click', () => {
          this.importData();
        });
      }
      if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', () => {
          this.exportData();
        });
      }
    },
    importData() {
      console.log('Importing data...');
      if (elements.importFile && elements.importFile.files.length > 0) {
        const file = elements.importFile.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            storage.set('vocabulary', data).then(() => {
              if (notify && notify.show) {
                notify.show('Data imported successfully!');
              }
            });
          } catch (error) {
            console.error('Import error:', error);
            if (notify && notify.show) {
              notify.show('Import failed: Invalid file format');
            }
          }
        };
        reader.readAsText(file);
      }
    },
    exportData() {
      console.log('Exporting data...');
      storage.get('vocabulary').then((data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vocabulary.json';
        a.click();
        URL.revokeObjectURL(url);
        if (notify && notify.show) {
          notify.show('Data exported successfully!');
        }
      });
    }
  };
};

window.createToastNotifier = function(document) {
  return {
    show(message) {
      console.log('Toast:', message);
      // 简单的通知实现
      if (typeof alert !== 'undefined') {
        alert(message);
      }
    },
    hide() {
      console.log('Toast hidden');
    }
  };
};

window.collectVocabularyElements = function() {
  return [];
};
EOF

# 2. 修复 vocab-ui.js
echo "🔧 Fixing vocab-ui.js..."
cat > "dist/vocab-ui.js" << 'EOF'
// 非模块版本的 vocab-ui.js
console.log('Vocab UI script loaded (non-module)');

// 全局函数定义
window.createStorageClient = function() {
  return {
    get(key) {
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
    set(key, value) {
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
};

window.createVocabularyManager = function() {
  return {
    load() {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.get(['vocabulary'], (result) => {
            resolve(result.vocabulary || []);
          });
        } else {
          resolve([]);
        }
      });
    },
    save(vocabulary) {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.set({ vocabulary }, () => {
            resolve();
          });
        } else {
          resolve();
        }
      });
    }
  };
};
EOF

echo "✅ All modules converted to non-module format"
