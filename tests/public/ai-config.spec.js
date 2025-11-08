import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// mock aiApiFrontend used by public/ai-config.js
vi.mock('../../public/services/ai-api-frontend.js', () => {
  return {
    aiApiFrontend: {
      getProviders: vi.fn(async () => [
        { key: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai' },
        { key: 'qwen', name: 'Qwen', baseUrl: 'https://dashscope.aliyun.com' }
      ]),
      getProviderModels: vi.fn(async (key) => {
        if (key === 'qwen') {
          return [
            { key: 'qwen-mt-turbo', name: 'Qwen MT Turbo', model: 'qwen-mt-turbo' },
            { key: 'qwen-mt', name: 'Qwen MT', model: 'qwen-mt' }
          ];
        }
        return [
          { key: 'gpt-4o-mini', name: 'GPT-4o Mini', model: 'gpt-4o-mini' }
        ];
      }),
      callAPI: vi.fn(async () => ({ ok: true }))
    }
  };
});

const buildDom = () => {
  document.body.innerHTML = `
    <div>
      <select id="provider"></select>
      <select id="model" disabled></select>
      <input id="apiKey" type="password" />
      <button id="toggleApiKey">显示</button>
      <a id="apiKeyHelpLink"></a>
      <div id="providerInfo" class="hidden"></div>
      <div id="providerDetails"></div>
      <div id="modelInfo" class="hidden"></div>
      <div id="modelDetails"></div>
      <div id="status" class="status hidden"></div>
      <button id="testConnection" disabled>测试连接</button>
      <button id="saveConfig" disabled>保存配置</button>
    </div>
  `;
};

describe('public/ai-config.js UI behaviors', () => {
  let chromeSetSpy;
  let chromeGetSpy;
  let closeSpy;

  beforeEach(() => {
    buildDom();
    // stub chrome.storage
    const store = {};
    chromeSetSpy = vi.fn(async (obj) => Object.assign(store, obj));
    chromeGetSpy = vi.fn(async (keys) => {
      if (Array.isArray(keys)) {
        const res = {};
        keys.forEach(k => { res[k] = store[k]; });
        return res;
      }
      return store;
    });
    vi.stubGlobal('chrome', { storage: { local: { set: chromeSetSpy, get: chromeGetSpy } } });
    closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    // import module (attaches DOMContentLoaded listener)
    // fresh import per test
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    closeSpy.mockRestore();
  });

  const fireReady = async () => {
    const mod = await import('../../public/ai-config.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    return mod;
  };
  const waitFor = async (fn, timeout = 1000, step = 10) => {
    const start = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        if (fn()) return;
      } catch (_) {}
      if (Date.now() - start > timeout) throw new Error('waitFor timeout');
      await new Promise(r => setTimeout(r, step));
    }
  };

  it('loads providers and preselects qwen with default model when available', async () => {
    await fireReady();
    const provider = document.getElementById('provider');
    const model = document.getElementById('model');
    // wait for async provider/model load
    await waitFor(() => provider.options.length > 1 && provider.value === 'qwen');
    await waitFor(() => model.disabled === false);
    expect(Array.from(model.options).some(o => o.value === 'qwen-mt-turbo')).toBe(true);
    expect(model.value).toBe('qwen-mt-turbo');
    // info sections visible
    expect(document.getElementById('providerInfo').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('modelInfo').classList.contains('hidden')).toBe(false);
  });

  it('enables provider/model UI after providers are loaded', async () => {
    await fireReady();
    const provider = document.getElementById('provider');
    const model = document.getElementById('model');
    await waitFor(() => provider.options.length > 1 && provider.value === 'qwen');
    await waitFor(() => model.disabled === false);
    expect(model.options.length).toBeGreaterThan(1);
  });

  it('enables test/save buttons only when form valid; tests success flow', async () => {
    const { aiApiFrontend } = await import('../../public/services/ai-api-frontend.js');
    await fireReady();
    const apiKey = document.getElementById('apiKey');
    const testBtn = document.getElementById('testConnection');
    const saveBtn = document.getElementById('saveConfig');

    // initially invalid (missing api key)
    expect(testBtn.disabled).toBe(true);
    expect(saveBtn.disabled).toBe(true);

    apiKey.value = 'sk-test-123';
    apiKey.dispatchEvent(new Event('input'));
    await waitFor(() => testBtn.disabled === false && saveBtn.disabled === false);

    // test connection success
    testBtn.click();
    // status set to testing then success
    await Promise.resolve();
    await Promise.resolve();
    expect(aiApiFrontend.callAPI).toHaveBeenCalled();
    const status = document.getElementById('status');
    expect(status.textContent).toContain('连接测试');

    // save config success
    vi.useFakeTimers();
    saveBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    vi.runAllTimers();
    expect(chromeSetSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('handles provider change and error paths gracefully', async () => {
    const { aiApiFrontend } = await import('../../public/services/ai-api-frontend.js');
    // make getProviderModels throw once to hit error branch
    aiApiFrontend.getProviderModels.mockImplementationOnce(async() => { throw new Error('boom'); });
    await fireReady();
    const provider = document.getElementById('provider');
    provider.value = 'openai';
    provider.dispatchEvent(new Event('change'));
    await Promise.resolve();
    const status = document.getElementById('status');
    expect(status.textContent).toContain('加载模型列表失败');
  });
});


