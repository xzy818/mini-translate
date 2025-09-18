// Background entry for Mini Translate
// Settings quick validation for TEST button
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'TEST_TRANSLATOR_SETTINGS'){
    const s = msg.payload || {};
    if (!s.apiKey || !s.model || !s.apiBaseUrl){
      sendResponse({ ok: false, error: '配置不完整' });
      return true;
    }
    // 仅进行本地验证，不真正访问外部 API
    sendResponse({ ok: true });
    return true;
  }
});


