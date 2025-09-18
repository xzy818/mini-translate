/* global showToast */
(function(){
  const $ = (id) => document.getElementById(id);
  const modelEl = $('model');
  const baseEl = $('base');
  const keyEl = $('key');
  const toggleKeyEl = $('toggleKey');
  const saveEl = $('save');
  const testEl = $('test');

  async function loadSettings(){
    try {
      const { settings } = await chrome.storage.local.get(['settings']);
      if (settings){
        modelEl.value = settings.model || modelEl.value;
        baseEl.value = settings.apiBaseUrl || '';
        keyEl.value = settings.apiKey || '';
      }
    } catch(e){
      console.error('loadSettings error', e);
      showToast('读取设置失败');
    }
  }

  async function saveSettings(){
    const settings = {
      model: modelEl.value,
      apiBaseUrl: baseEl.value.trim(),
      apiKey: keyEl.value.trim()
    };
    try {
      await chrome.storage.local.set({ settings });
      // 广播设置更新
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', payload: settings });
      showToast('已保存');
    } catch(e){
      console.error('saveSettings error', e);
      showToast('保存失败');
    }
  }

  function toggleKey(){
    if (keyEl.type === 'password'){
      keyEl.type = 'text';
      toggleKeyEl.textContent = '隐藏';
    } else {
      keyEl.type = 'password';
      toggleKeyEl.textContent = '显示';
    }
  }

  async function testSettings(){
    const s = {
      model: modelEl.value,
      apiBaseUrl: baseEl.value.trim(),
      apiKey: keyEl.value.trim()
    };
    try {
      const res = await chrome.runtime.sendMessage({ type: 'TEST_TRANSLATOR_SETTINGS', payload: s });
      if (res && res.ok){
        showToast('测试通过');
      } else {
        showToast(res && res.error ? ('测试失败: ' + res.error) : '测试失败');
      }
    } catch(e){
      console.error('testSettings error', e);
      showToast('测试异常');
    }
  }

  toggleKeyEl.addEventListener('click', toggleKey);
  saveEl.addEventListener('click', saveSettings);
  testEl.addEventListener('click', testSettings);
  document.addEventListener('DOMContentLoaded', loadSettings);
})();


