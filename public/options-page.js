import {
  createToastNotifier,
  initSettings,
  initImportExport,
  initVocabulary,
  initQaPanel
} from './options.js';

function bootstrapOptionsPage() {
  const chromeLike = typeof chrome !== 'undefined' ? chrome : null;
  const notify = createToastNotifier(document);
  const { storage } = initVocabulary(chromeLike);
  initSettings(chromeLike, notify);
  initImportExport(storage, notify);
  initQaPanel(chromeLike, storage, notify);
}

document.addEventListener('DOMContentLoaded', bootstrapOptionsPage);
