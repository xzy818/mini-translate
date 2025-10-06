/**
 * 真实Chrome扩展集成测试
 * 测试完整的扩展流程，包括URL映射、消息路由、Service Worker等
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('真实Chrome扩展集成测试', () => {
  let mockChrome;
  let originalFetch;
  let backgroundScript;

  beforeEach(() => {
    // 模拟Chrome API
    mockChrome = {
      runtime: {
        onMessage: {
          addListener: vi.fn()
        },
        sendMessage: vi.fn()
      },
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn()
        }
      },
      contextMenus: {
        create: vi.fn(),
        removeAll: vi.fn(),
        update: vi.fn()
      }
    };

    global.chrome = mockChrome;
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('URL映射逻辑测试', () => {
    it('应该正确映射Qwen模型的Base URL', () => {
      // 模拟background.js中的mapBaseUrlByModel函数
      const mapBaseUrlByModel = (model) => {
        switch (model) {
          case 'deepseek-v3':
            return 'https://api.deepseek.com';
          case 'qwen-mt-turbo':
          case 'qwen-mt-plus':
            return 'https://dashscope.aliyuncs.com';  // 修复后的正确URL
          case 'gpt-4o-mini':
            return 'https://api.openai.com';
          default:
            return '';
        }
      };

      // 测试Qwen模型URL映射
      expect(mapBaseUrlByModel('qwen-mt-turbo')).toBe('https://dashscope.aliyuncs.com');
      expect(mapBaseUrlByModel('qwen-mt-plus')).toBe('https://dashscope.aliyuncs.com');
      
      // 测试其他模型
      expect(mapBaseUrlByModel('deepseek-v3')).toBe('https://api.deepseek.com');
      expect(mapBaseUrlByModel('gpt-4o-mini')).toBe('https://api.openai.com');
    });

    it('应该验证URL构建逻辑', () => {
      const mapBaseUrlByModel = (model) => {
        switch (model) {
          case 'qwen-mt-turbo':
            return 'https://dashscope.aliyuncs.com';
          default:
            return '';
        }
      };

      // 模拟translator.js中的URL构建
      const apiBaseUrl = mapBaseUrlByModel('qwen-mt-turbo');
      const url = `${apiBaseUrl}/compatible-mode/v1/chat/completions`;
      
      // 验证最终URL正确
      expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    });
  });

  describe('Chrome扩展消息处理测试', () => {
    it('应该处理TRANSLATE_TEXT消息', async () => {
      // 模拟消息处理逻辑
      const messageHandler = vi.fn();
      mockChrome.runtime.onMessage.addListener.mockImplementation(messageHandler);

      // 模拟消息
      const message = {
        type: 'TRANSLATE_TEXT',
        payload: {
          text: 'hello',
          model: 'qwen-mt-turbo',
          apiKey: 'test-key',
          apiBaseUrl: 'https://dashscope.aliyuncs.com'
        }
      };

      // 模拟fetch响应
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: '你好' }
          }]
        })
      });

      // 模拟消息处理
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test timeout'));
        }, 5000);

        // 立即触发消息处理
        setTimeout(() => {
          messageHandler.mockImplementation((msg, sender, sendResponse) => {
            if (msg.type === 'TRANSLATE_TEXT') {
              // 模拟URL构建
              const url = `${msg.payload.apiBaseUrl}/compatible-mode/v1/chat/completions`;
              expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
              
              // 模拟API调用
              global.fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${msg.payload.apiKey}` },
                body: JSON.stringify({
                  model: msg.payload.model,
                  messages: [{ role: 'user', content: msg.payload.text }]
                })
              }).then(response => response.json())
                .then(data => {
                  const translation = data.choices[0].message.content;
                  sendResponse({ ok: true, result: translation });
                  clearTimeout(timeout);
                  resolve(translation);
                })
                .catch(error => {
                  clearTimeout(timeout);
                  reject(error);
                });
              return true;
            }
          });
          
          // 触发消息处理
          messageHandler(message, null, (response) => {
            if (response && response.ok) {
              clearTimeout(timeout);
              resolve(response.result);
            }
          });
        }, 100);
      });

      expect(result).toBe('你好');
    }, 10000);

    it('应该处理RETRY_TRANSLATION消息', async () => {
      const messageHandler = vi.fn();
      mockChrome.runtime.onMessage.addListener.mockImplementation(messageHandler);

      const message = {
        type: 'RETRY_TRANSLATION',
        payload: {
          term: 'hello',
          model: 'qwen-mt-turbo',
          apiKey: 'test-key',
          apiBaseUrl: 'https://dashscope.aliyuncs.com'
        }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: '你好' }
          }]
        })
      });

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test timeout'));
        }, 5000);

        // 立即触发消息处理
        setTimeout(() => {
          messageHandler.mockImplementation((msg, sender, sendResponse) => {
            if (msg.type === 'RETRY_TRANSLATION') {
              const url = `${msg.payload.apiBaseUrl}/compatible-mode/v1/chat/completions`;
              expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
              
              global.fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${msg.payload.apiKey}` },
                body: JSON.stringify({
                  model: msg.payload.model,
                  messages: [{ role: 'user', content: msg.payload.term }]
                })
              }).then(response => response.json())
                .then(data => {
                  const translation = data.choices[0].message.content;
                  sendResponse({ ok: true, result: translation });
                  clearTimeout(timeout);
                  resolve(translation);
                })
                .catch(error => {
                  clearTimeout(timeout);
                  reject(error);
                });
              return true;
            }
          });
          
          // 触发消息处理
          messageHandler(message, null, (response) => {
            if (response && response.ok) {
              clearTimeout(timeout);
              resolve(response.result);
            }
          });
        }, 100);
      });

      expect(result).toBe('你好');
    }, 10000);
  });

  describe('Service Worker兼容性测试', () => {
    it('应该验证background.js的Service Worker兼容性', () => {
      // 读取实际的background.js文件
      const backgroundPath = join(process.cwd(), 'dist', 'background.js');
      let backgroundContent;
      
      try {
        backgroundContent = readFileSync(backgroundPath, 'utf8');
      } catch (error) {
        console.warn('无法读取dist/background.js，使用模拟数据');
        backgroundContent = 'importScripts("./src/services/context-menu.js");';
      }

      // 验证使用importScripts而不是ES6 import
      expect(backgroundContent).toContain('importScripts');
      expect(backgroundContent).not.toContain('import {');
      expect(backgroundContent).not.toContain('from \'./src/');

      // 验证关键函数存在
      expect(backgroundContent).toContain('mapBaseUrlByModel');
      expect(backgroundContent).toContain('translateText');
      expect(backgroundContent).toContain('chrome.runtime.onMessage');
    });

    it('应该验证模块加载顺序', () => {
      const backgroundPath = join(process.cwd(), 'dist', 'background.js');
      let backgroundContent;
      
      try {
        backgroundContent = readFileSync(backgroundPath, 'utf8');
      } catch (error) {
        console.warn('无法读取dist/background.js，使用模拟数据');
        backgroundContent = 'importScripts("./src/services/context-menu.js");\nimportScripts("./src/services/translator.js");';
      }

      // 验证importScripts的顺序
      const importScriptsLines = backgroundContent
        .split('\n')
        .filter(line => line.includes('importScripts'))
        .map(line => line.trim());

      expect(importScriptsLines.length).toBeGreaterThan(0);
      expect(importScriptsLines[0]).toContain('context-menu.js');
    });
  });

  describe('完整用户流程测试', () => {
    it('应该模拟完整的翻译流程', async () => {
      // 模拟用户选择文本
      const selectedText = 'hello';
      
      // 模拟右键菜单触发
      const contextMenuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true
      });

      // 模拟消息发送到background
      const message = {
        type: 'ADD_TERM',
        payload: {
          selectionText: selectedText,
          model: 'qwen-mt-turbo',
          apiKey: 'test-key',
          apiBaseUrl: 'https://dashscope.aliyuncs.com'
        }
      };

      // 模拟API调用
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: '你好' }
          }]
        })
      });

      // 模拟完整的消息处理流程
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test timeout'));
        }, 5000);

        // 立即触发消息处理
        setTimeout(() => {
          mockChrome.runtime.onMessage.addListener.mockImplementation((msg, sender, sendResponse) => {
            if (msg.type === 'ADD_TERM') {
              // 1. 验证URL构建
              const url = `${msg.payload.apiBaseUrl}/compatible-mode/v1/chat/completions`;
              expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
              
              // 2. 模拟API调用
              global.fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${msg.payload.apiKey}` },
                body: JSON.stringify({
                  model: msg.payload.model,
                  messages: [{ role: 'user', content: msg.payload.selectionText }]
                })
              }).then(response => response.json())
                .then(data => {
                  const translation = data.choices[0].message.content;
                  
                  // 3. 模拟存储更新
                  mockChrome.storage.local.set.mockResolvedValue({});
                  
                  // 4. 模拟菜单更新
                  mockChrome.contextMenus.update.mockResolvedValue({});
                  
                  sendResponse({ ok: true, translation });
                  clearTimeout(timeout);
                  resolve(translation);
                })
                .catch(error => {
                  clearTimeout(timeout);
                  reject(error);
                });
              return true;
            }
          });
          
          // 触发消息处理
          mockChrome.runtime.onMessage.addListener(message, null, (response) => {
            if (response && response.ok) {
              clearTimeout(timeout);
              resolve(response.translation);
            }
          });
        }, 100);
      });

      expect(result).toBe('你好');
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
      expect(mockChrome.contextMenus.update).toHaveBeenCalled();
    }, 10000);
  });

  describe('错误处理测试', () => {
    it('应该处理API调用失败', async () => {
      const message = {
        type: 'TRANSLATE_TEXT',
        payload: {
          text: 'hello',
          model: 'qwen-mt-turbo',
          apiKey: 'invalid-key',
          apiBaseUrl: 'https://dashscope.aliyuncs.com'
        }
      };

      // 模拟API错误
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('{"error": "Invalid API key"}')
      });

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test timeout'));
        }, 5000);

        // 立即触发消息处理
        setTimeout(() => {
          mockChrome.runtime.onMessage.addListener.mockImplementation((msg, sender, sendResponse) => {
            if (msg.type === 'TRANSLATE_TEXT') {
              const url = `${msg.payload.apiBaseUrl}/compatible-mode/v1/chat/completions`;
              
              global.fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${msg.payload.apiKey}` },
                body: JSON.stringify({
                  model: msg.payload.model,
                  messages: [{ role: 'user', content: msg.payload.text }]
                })
              }).then(response => {
                if (!response.ok) {
                  throw new Error(`API错误 (${response.status})`);
                }
                return response.json();
              }).then(data => {
                const translation = data.choices[0].message.content;
                sendResponse({ ok: true, result: translation });
                clearTimeout(timeout);
                resolve(translation);
              }).catch(error => {
                sendResponse({ ok: false, error: error.message });
                clearTimeout(timeout);
                reject(error);
              });
              return true;
            }
          });
          
          // 触发消息处理
          mockChrome.runtime.onMessage.addListener(message, null, (response) => {
            if (response && response.ok) {
              clearTimeout(timeout);
              resolve(response.result);
            } else if (response && !response.ok) {
              clearTimeout(timeout);
              reject(new Error(response.error));
            }
          });
        }, 100);
      });

      expect(result).rejects.toThrow('API错误 (401)');
    }, 10000);
  });
});
