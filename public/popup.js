import {
  createSettingsController,
  createImportExportController,
  createToastNotifier,
  collectVocabularyElements
} from './options.js';
import { createStorageClient, createVocabularyManager } from './vocab-ui.js';

function getSettingsElements(root = document) {
  return {
    model: root.getElementById('model'),
    base: root.getElementById('base'),
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
  document.addEventListener('DOMContentLoaded', () => {
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
