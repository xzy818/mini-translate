(() => {
  if (window.__miniTranslateQA) {
    return;
  }
  let requestId = 0;
  const pending = new Map();

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) {
      return;
    }
    const { qaResponse, qaRequestId, success, result, error } = event.data;
    if (!qaResponse || !qaRequestId || !pending.has(qaRequestId)) {
      return;
    }
    const { resolve, reject } = pending.get(qaRequestId);
    pending.delete(qaRequestId);
    if (success) {
      resolve(result);
    } else {
      reject(new Error(error || 'QA bridge error'));
    }
  });

  function call(action, payload) {
    const id = `qa_${Date.now()}_${++requestId}`;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      window.postMessage({ qaAction: action, qaRequestId: id, payload }, '*');
    });
  }

  // 获取当前 tabId
  function getCurrentTabId() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'QA_WHOAMI' }, (response) => {
        if (chrome.runtime.lastError) {
          // 如果无法获取 tabId，返回 null
          resolve(null);
        } else {
          resolve(response?.tabId || null);
        }
      });
    });
  }

  // 发送 QA 消息到 background
  function sendQaMessage(type, payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.ok) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'QA message failed'));
        }
      });
    });
  }

  window.__miniTranslateQA = {
    // 原有方法
    add(selectionText) {
      return call('add', { selectionText });
    },
    remove(selectionText) {
      return call('remove', { selectionText });
    },
    toggle() {
      return call('toggle', {});
    },
    
    // 新增 QA 方法
    async applyTerm(term, translation, tabId = null) {
      const targetTabId = tabId || await getCurrentTabId();
      return sendQaMessage('QA_APPLY_TERM', { term, translation, tabId: targetTabId });
    },
    
    async removeTerm(term, tabId = null) {
      const targetTabId = tabId || await getCurrentTabId();
      return sendQaMessage('QA_REMOVE_TERM', { term, tabId: targetTabId });
    },
    
    async queryTerm(term, tabId = null) {
      const targetTabId = tabId || await getCurrentTabId();
      return sendQaMessage('QA_QUERY_TERM', { term, tabId: targetTabId });
    },
    
    async resetWorker() {
      return sendQaMessage('QA_RESET_WORKER', {});
    },
    
    // 获取当前 tabId
    getCurrentTabId
  };
})();
