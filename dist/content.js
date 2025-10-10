const vocabularyMap = new Map();
const originalTextMap = new WeakMap();

function canonicalizeTerm(term) {
  return typeof term === 'string' ? term.trim().toLowerCase() : '';
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildWordRegex(term) {
  const esc = escapeRegExp(term);
  return new RegExp('\\b' + esc + '\\b', 'gi');
}

function replaceWithMark(text, term, translation) {
  const re = buildWordRegex(term);
  // 修复：当翻译为空时，不显示翻译标记，避免显示"T"
  if (!translation || translation.trim() === '') {
    return text; // 不进行替换，保持原文
  }
  return text.replace(re, (match) => `${match}(${translation})`);
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
  const canonical = canonicalizeTerm(payload.term);
  if (!canonical) {
    return;
  }
  vocabularyMap.set(canonical, { ...payload, term: payload.term });
  applyVocabulary();
}

function handleRemoveTranslation(payload) {
  const canonical = canonicalizeTerm(payload.term);
  if (!canonical) {
    return;
  }
  vocabularyMap.delete(canonical);
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
  try {
    // 当扩展被重载/卸载或不可注入页时，可能触发以下错误：
    // - Extension context invalidated
    // - Could not establish connection / Receiving end does not exist
    if (!chrome || !chrome.runtime || !chrome.runtime.id) {
      return;
    }
    chrome.runtime.sendMessage({
      type: 'SELECTION_CHANGED',
      payload: { selectionText: nextText }
    }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        const msg = String(err.message || '');
        if (
          msg.includes('Could not establish connection') ||
          msg.includes('Receiving end does not exist') ||
          msg.includes('Extension context invalidated') ||
          msg.includes('The message port closed')
        ) {
          return; // 忽略噪音
        }
      }
    });
  } catch (e) {
    // 忽略在上下文无效期间的异常
  }
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

function sendQaMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function extractSelectionFromEvent(event) {
  if (event?.detail) {
    if (typeof event.detail === 'string') {
      return event.detail.trim();
    }
    if (typeof event.detail.selectionText === 'string') {
      return event.detail.selectionText.trim();
    }
  }
  return readCurrentSelection();
}

document.addEventListener('mt-qa-selection', (event) => {
  const selection = extractSelectionFromEvent(event);
  sendQaMessage('QA_CONTEXT_ADD', { selectionText: selection }).catch(() => {});
});

document.addEventListener('mt-qa-remove', (event) => {
  const selection = extractSelectionFromEvent(event);
  sendQaMessage('QA_CONTEXT_REMOVE', { selectionText: selection }).catch(() => {});
});

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;
  const { qaAction, qaRequestId, payload } = event.data;
  if (!qaAction || !qaRequestId) return;
  let messageType = null;
  if (qaAction === 'add') messageType = 'QA_CONTEXT_ADD';
  else if (qaAction === 'remove') messageType = 'QA_CONTEXT_REMOVE';
  if (!messageType) return;
  const selectionText = (payload?.selectionText || readCurrentSelection()).trim();
  sendQaMessage(messageType, { selectionText })
    .then((result) => {
      window.postMessage({ qaResponse: qaAction, qaRequestId, success: true, result }, '*');
    })
    .catch((error) => {
      window.postMessage({ qaResponse: qaAction, qaRequestId, success: false, error: error.message }, '*');
    });
});

const bridgeScript = document.createElement('script');
bridgeScript.src = chrome.runtime.getURL('qa-bridge.js');
bridgeScript.type = 'text/javascript';
bridgeScript.async = false;
document.documentElement?.appendChild(bridgeScript);
bridgeScript.addEventListener('load', () => {
  bridgeScript.remove();
});
