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

  window.__miniTranslateQA = {
    add(selectionText) {
      return call('add', { selectionText });
    },
    remove(selectionText) {
      return call('remove', { selectionText });
    },
    toggle() {
      return call('toggle', {});
    }
  };
})();
