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

function createChromeStub({ settings = {} } = {}) {
  const store = { settings };
  return {
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
    }
  };
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
    // base 字段已不再由 UI 控件承载，此断言移除
    expect(elements.key.value).toBe('secret');
    expect(elements.key.value).toBe('secret');
  });

  it('saves settings and notifies chrome runtime', async () => {
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    controller.bind();
    elements.model.value = 'deepseek-v3';
    // base 不再由用户输入
    elements.key.value = 'new-secret';
    await controller.save();
    expect(notify).toHaveBeenCalledWith('已保存');
    expect(chromeStub.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'SETTINGS_UPDATED', payload: expect.objectContaining({ model: 'deepseek-v3' }) },
      expect.any(Function)
    );
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
    await controller.testConnection();
    expect(chromeStub.runtime.sendMessage).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('测试通过');
  });

  it('notifies error message when runtime returns failure', async () => {
    chromeStub.runtime.sendMessage.mockImplementation((_message, cb) => {
      cb({ ok: false, error: '认证失败' });
    });
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    await controller.testConnection();
    expect(notify).toHaveBeenCalledWith('测试失败: 认证失败');
  });

  it('handles runtime.lastError gracefully', async () => {
    chromeStub.runtime.sendMessage.mockImplementation((_message, cb) => {
      chromeStub.runtime.lastError = { message: '网络错误' };
      cb(null);
      chromeStub.runtime.lastError = null;
    });
    const controller = createSettingsController({ chromeLike: chromeStub, notify, elements });
    await controller.testConnection();
    expect(notify).toHaveBeenCalledWith('测试异常');
  });
});
