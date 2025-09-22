const vocabularyMap = new Map();
const originalTextMap = new WeakMap();

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildWordRegex(term) {
  const esc = escapeRegExp(term);
  return new RegExp('\\b' + esc + '\\b', 'gi');
}

function replaceWithMark(text, term, translation) {
  const re = buildWordRegex(term);
  return text.replace(re, (match) => `${match}(${translation || 'T'})`);
}

function getTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.parentElement) return NodeFilter.FILTER_REJECT;
      const parentTag = node.parentElement.tagName;
      if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'NOSCRIPT') {
        return NodeFilter.FILTER_REJECT;
      }
      if (!node.textContent || !node.textContent.trim()) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  return nodes;
}

function applyVocabularyToNode(node, entries) {
  const original = originalTextMap.has(node) ? originalTextMap.get(node) : node.textContent;
  let next = original;

  entries.forEach(({ term, translation }) => {
    next = replaceWithMark(next, term, translation);
  });

  if (next !== original) {
    if (!originalTextMap.has(node)) {
      originalTextMap.set(node, original);
    }
    node.textContent = next;
  } else if (originalTextMap.has(node)) {
    node.textContent = originalTextMap.get(node);
    originalTextMap.delete(node);
  }
}

function applyVocabulary() {
  const entries = Array.from(vocabularyMap.values());
  if (!entries.length) {
    originalTextMap.forEach((original, node) => {
      if (node.textContent !== original) {
        node.textContent = original;
      }
    });
    originalTextMap.clear();
    return;
  }
  const nodes = getTextNodes(document.body);
  nodes.forEach((node) => applyVocabularyToNode(node, entries));
}

function handleApplyTranslation(payload) {
  vocabularyMap.set(payload.term, payload);
  applyVocabulary();
}

function handleRemoveTranslation(payload) {
  vocabularyMap.delete(payload.term);
  applyVocabulary();
}

function handleTranslateAll(payload) {
  vocabularyMap.clear();
  (payload.vocabulary || []).forEach((item) => {
    if (item?.term) {
      vocabularyMap.set(item.term, item);
    }
  });
  applyVocabulary();
}

function handleResetPage() {
  vocabularyMap.clear();
  applyVocabulary();
}


chrome.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) return;
  switch (message.type) {
    case 'APPLY_TRANSLATION':
      handleApplyTranslation(message.payload || {});
      break;
    case 'REMOVE_TRANSLATION':
      handleRemoveTranslation(message.payload || {});
      break;
    case 'TRANSLATE_ALL':
      handleTranslateAll(message.payload || {});
      break;
    case 'RESET_PAGE':
      handleResetPage();
      break;
    default:
      break;
  }
});

let selectionDebounce = null;
let lastSelectionText = '';

function notifySelectionChange(nextText) {
  if (nextText === lastSelectionText) {
    return;
  }
  lastSelectionText = nextText;
  chrome.runtime.sendMessage({
    type: 'SELECTION_CHANGED',
    payload: { selectionText: nextText }
  });
}

function readCurrentSelection() {
  try {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : '';
  } catch {
    return '';
  }
}

function scheduleSelectionNotification() {
  if (selectionDebounce) {
    clearTimeout(selectionDebounce);
  }
  selectionDebounce = setTimeout(() => {
    const text = readCurrentSelection();
    notifySelectionChange(text);
  }, 150);
}

document.addEventListener('selectionchange', scheduleSelectionNotification, {
  passive: true
});

notifySelectionChange('');
