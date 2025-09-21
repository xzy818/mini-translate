/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsController } from '../public/options.js';

function buildDom() {
  document.body.innerHTML = `
    <select id="model">
      <option value="deepseek-v3">DeepSeek V3</option>
      <option value="gpt-4o-mini">gpt-4o-mini</option>
    </select>
    <input id="base" type="text" />
    <input id="key" type="password" />
    <button id="toggleKey">显示</button>
    <button id="save">保存</button>
    <button id="test">测试</button>
  `;
  return {
    model: document.getElementById('model'),
    base: document.getElementById('base'),
    key: document.getElementById('key'),
    toggle: document.getElementById('toggleKey'),
    save: document.getElementById('save'),
    test: document.getElementById('test')
  };
}

function createChromeStub({ settings = {}, permissionState } = {}) {
  const store = { settings };
  const state = {
    contains: permissionState?.contains ?? true,
    request: permissionState?.request ?? true,
    containsError: permissionState?.containsError ?? null,
    requestError: permissionState?.requestError ?? null,
    permissionsDisabled: permissionState?.disabled ?? false
  };
  const chromeStub = {
    storage: {
      local: {
        get(keys, cb) {
          const result = {};
          keys.forEach((key) => {
            result[key] = store[key];
          });
          cb(result);
        },
        set(payload, cb) {
          Object.assign(store, payload);
          cb && cb();
        }
      }
    },
    runtime: {
      lastError: null,
      sendMessage: vi.fn((_message, cb) => {
        cb({ ok: true });
      })
    },
    permissions: state.permissionsDisabled
      ? undefined
      : {
          contains: vi.fn((query, cb) => {
            if (state.containsError) {
              chromeStub.runtime.lastError = { message: state.containsError };
              cb(false);
              chromeStub.runtime.lastError = null;
              return;
            }
            cb(state.contains);
          }),
          request: vi.fn((query, cb) => {
            if (state.requestError) {
              chromeStub.runtime.lastError = { message: state.requestError };
              cb(false);
              chromeStub.runtime.lastError = null;
              return;
            }
            cb(state.request);
          })
        }
  };
  chromeStub.__store = store;
  chromeStub.__permissionState = state;
  return chromeStub;
}

describe('Settings controller', () => {
  let elements;
  let chromeStub;
  let notify;

  beforeEach(() => {
    elements = buildDom();
    chromeStub = createChromeStub({
      settings: {
        model: 'gpt-4o-mini',
        apiBaseUrl: 'https://api.example.com',
        apiKey: 'secret'
      }
    });
    notify = vi.fn();
  });

  it('loads existing settings into inputs', async () => {
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    controller.bind();
    await controller.load();
    expect(elements.model.value).toBe('gpt-4o-mini');
    expect(elements.base.value).toBe('https://api.example.com');
    expect(elements.key.value).toBe('secret');
  });

  it('saves settings and notifies chrome runtime', async () => {
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    controller.bind();
    elements.model.value = 'deepseek-v3';
    elements.base.value = 'https://deepseek.example';
    elements.key.value = 'new-secret';
    await controller.save();
    expect(chromeStub.permissions.contains).toHaveBeenCalledWith({ origins: ['https://deepseek.example/*'] }, expect.any(Function));
    expect(chromeStub.permissions.request?.mock.calls.length || 0).toBe(0);
    expect(notify).toHaveBeenCalledWith('已保存');
    expect(chromeStub.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'SETTINGS_UPDATED', payload: expect.objectContaining({ model: 'deepseek-v3' }) },
      expect.any(Function)
    );
  });

  it('normalizes base url when user提供完整接口路径', async () => {
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    controller.bind();
    elements.model.value = 'deepseek-v3';
    elements.base.value = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    elements.key.value = 'secret';

    await controller.save();

    expect(notify).toHaveBeenNthCalledWith(1, '已自动格式化 API 地址');
    expect(notify).toHaveBeenLastCalledWith('已保存');
    expect(elements.base.value).toBe('https://dashscope.aliyuncs.com/compatible-mode');
    expect(chromeStub.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'SETTINGS_UPDATED', payload: expect.objectContaining({ apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode' }) },
      expect.any(Function)
    );
    expect(chromeStub.__store.settings.apiBaseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode');
  });

  it('normalizes base url when user以 /v1 结尾', async () => {
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    controller.bind();
    elements.model.value = 'deepseek-v3';
    elements.base.value = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    elements.key.value = 'secret';

    await controller.save();

    expect(notify).toHaveBeenNthCalledWith(1, '已自动格式化 API 地址');
    expect(chromeStub.permissions.contains).toHaveBeenCalledWith(
      { origins: ['https://dashscope.aliyuncs.com/*'] },
      expect.any(Function)
    );
    expect(elements.base.value).toBe('https://dashscope.aliyuncs.com/compatible-mode');
    expect(chromeStub.__store.settings.apiBaseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode');
  });

  it('requests permission when missing and granted', async () => {
    elements = buildDom();
    chromeStub = createChromeStub({
      settings: {
        model: 'gpt-4o-mini',
        apiBaseUrl: 'https://api.example.com',
        apiKey: 'secret'
      },
      permissionState: { contains: false, request: true }
    });
    notify = vi.fn();
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    controller.bind();
    elements.model.value = 'qwen-mt-turbo';
    elements.base.value = 'https://dashscope.aliyuncs.com/compatible-mode';
    elements.key.value = 'secret';

    await controller.save();

    expect(chromeStub.permissions.contains).toHaveBeenCalled();
    expect(chromeStub.permissions.request).toHaveBeenCalled();
    expect(notify).toHaveBeenNthCalledWith(1, '已授权访问 https://dashscope.aliyuncs.com');
    expect(notify).toHaveBeenLastCalledWith('已保存');
    expect(chromeStub.__store.settings.apiBaseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode');
  });

  it('stops save when permission request denied', async () => {
    elements = buildDom();
    chromeStub = createChromeStub({
      settings: {
        model: 'gpt-4o-mini',
        apiBaseUrl: 'https://api.example.com',
        apiKey: 'secret'
      },
      permissionState: { contains: false, request: false }
    });
    notify = vi.fn();
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    controller.bind();
    elements.model.value = 'qwen-mt-turbo';
    elements.base.value = 'https://dashscope.aliyuncs.com/compatible-mode';
    elements.key.value = 'secret';

    await controller.save();

    expect(chromeStub.permissions.request).toHaveBeenCalled();
    expect(chromeStub.runtime.sendMessage).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('已取消授权：https://dashscope.aliyuncs.com');
  });

  it('toggleKeyVisibility switches input type', () => {
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    controller.toggleKeyVisibility();
    expect(elements.key.type).toBe('text');
    controller.toggleKeyVisibility();
    expect(elements.key.type).toBe('password');
  });

  it('tests settings via runtime message', async () => {
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    controller.bind();
    await controller.load();
    await controller.testConnection();
    expect(chromeStub.runtime.sendMessage).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('测试通过');
  });

  it('stops test when permission check fails', async () => {
    elements = buildDom();
    chromeStub = createChromeStub({
      settings: {
        model: 'gpt-4o-mini',
        apiBaseUrl: 'https://api.example.com',
        apiKey: 'secret'
      },
      permissionState: { contains: false, request: false }
    });
    notify = vi.fn();
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    controller.bind();
    await controller.load();
    await controller.testConnection();
    expect(chromeStub.permissions.request).toHaveBeenCalled();
    expect(chromeStub.runtime.sendMessage).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('已取消授权：https://api.example.com');
  });
});
