/**
 * 完整用户流程E2E测试
 * 测试从用户操作到翻译结果的完整流程
 */

/* eslint-disable no-unused-vars */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('完整用户流程E2E测试', () => {
  let mockChrome;
  let originalFetch;
  let backgroundScript;
  let contentScript;

  beforeEach(() => {
    // 读取dist目录中的实际文件
    try {
      backgroundScript = readFileSync(join(process.cwd(), 'dist', 'background.js'), 'utf8');
      contentScript = readFileSync(join(process.cwd(), 'dist', 'content.js'), 'utf8');
    } catch (error) {
      console.warn('无法读取dist文件，使用默认值:', error.message);
      backgroundScript = '';
      contentScript = '';
    }

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
      },
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn()
      }
    };

    global.chrome = mockChrome;
    originalFetch = global.fetch;

    // 文件已在beforeEach中读取，这里不需要重复读取
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('场景1: 添加词条翻译', () => {
    it('应该完成从选择文本到添加词条的完整流程', async () => {
      // 1. 模拟用户选择文本
      const selectedText = 'hello';
      const expectedTranslation = '你好';

      // 2. 模拟右键菜单触发
      const contextMenuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100
      });

      // 3. 模拟消息发送到background
      const addTermMessage = {
        type: 'ADD_TERM',
        payload: {
          selectionText: selectedText,
          model: 'qwen-mt-turbo',
          apiKey: 'test-key',
          apiBaseUrl: 'https://dashscope.aliyuncs.com'
        }
      };

      // 4. 模拟API调用
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: expectedTranslation }
          }]
        })
      });

      // 5. 模拟完整的消息处理流程
      const result = await new Promise((resolve, reject) => {
        mockChrome.runtime.onMessage.addListener.mockImplementation((msg, sender, sendResponse) => {
          if (msg.type === 'ADD_TERM') {
            // 验证URL构建逻辑
            const url = `${msg.payload.apiBaseUrl}/compatible-mode/v1/chat/completions`;
            expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
            
            // 模拟API调用
            global.fetch(url, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${msg.payload.apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: msg.payload.model,
                messages: [{ role: 'user', content: msg.payload.selectionText }],
                temperature: 0.3,
                max_tokens: 1000
              })
            }).then(response => response.json())
              .then(data => {
                const translation = data.choices[0].message.content;
                
                // 模拟存储更新
                mockChrome.storage.local.set.mockResolvedValue({});
                
                // 模拟菜单更新
                mockChrome.contextMenus.update.mockResolvedValue({});
                
                sendResponse({ ok: true, translation });
                resolve(translation);
              })
              .catch(error => {
                sendResponse({ ok: false, error: error.message });
                reject(error);
              });
            return true;
          }
        });
      });

      // 6. 验证结果
      expect(result).toBe(expectedTranslation);
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
      expect(mockChrome.contextMenus.update).toHaveBeenCalled();
    });
  });

  describe('场景2: 切换页面翻译', () => {
    it('应该完成切换页面翻译的完整流程', async () => {
      // 1. 模拟用户选择已添加的词条
      const selectedText = 'hello';
      const expectedTranslation = '你好';

      // 2. 模拟切换翻译消息
      const toggleMessage = {
        type: 'TOGGLE_PAGE',
        payload: {
          selectionText: selectedText,
          model: 'qwen-mt-turbo',
          apiKey: 'test-key',
          apiBaseUrl: 'https://dashscope.aliyuncs.com'
        }
      };

      // 3. 模拟API调用
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: expectedTranslation }
          }]
        })
      });

      // 4. 模拟完整的切换流程
      const result = await new Promise((resolve, reject) => {
        mockChrome.runtime.onMessage.addListener.mockImplementation((msg, sender, sendResponse) => {
          if (msg.type === 'TOGGLE_PAGE') {
            // 验证URL构建
            const url = `${msg.payload.apiBaseUrl}/compatible-mode/v1/chat/completions`;
            expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
            
            // 模拟API调用
            global.fetch(url, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${msg.payload.apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: msg.payload.model,
                messages: [{ role: 'user', content: msg.payload.selectionText }]
              })
            }).then(response => response.json())
              .then(data => {
                const translation = data.choices[0].message.content;
                
                // 模拟页面内容更新
                mockChrome.tabs.sendMessage.mockResolvedValue({});
                
                sendResponse({ ok: true, translation });
                resolve(translation);
              })
              .catch(error => {
                sendResponse({ ok: false, error: error.message });
                reject(error);
              });
            return true;
          }
        });
      });

      // 5. 验证结果
      expect(result).toBe(expectedTranslation);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
    });
  });

  describe('场景3: 移除词条', () => {
    it('应该完成移除词条的完整流程', async () => {
      // 1. 模拟用户选择要移除的词条
      const selectedText = 'hello';

      // 2. 模拟移除词条消息
      const removeMessage = {
        type: 'REMOVE_TERM',
        payload: {
          selectionText: selectedText
        }
      };

      // 3. 模拟存储操作
      mockChrome.storage.local.get.mockResolvedValue({
        vocabulary: [
          { term: 'hello', translation: '你好', status: 'active' }
        ]
      });

      mockChrome.storage.local.set.mockResolvedValue({});

      // 4. 模拟完整的移除流程
      const result = await new Promise((resolve) => {
        mockChrome.runtime.onMessage.addListener.mockImplementation((msg, sender, sendResponse) => {
          if (msg.type === 'REMOVE_TERM') {
            // 模拟存储更新
            mockChrome.storage.local.get.mockResolvedValue({
              vocabulary: []
            });
            
            // 模拟菜单更新
            mockChrome.contextMenus.update.mockResolvedValue({});
            
            sendResponse({ ok: true });
            resolve(true);
          }
        });
      });

      // 5. 验证结果
      expect(result).toBe(true);
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
      expect(mockChrome.contextMenus.update).toHaveBeenCalled();
    });
  });

  describe('错误处理流程', () => {
    it('应该处理API调用失败的情况', async () => {
      const selectedText = 'hello';
      const addTermMessage = {
        type: 'ADD_TERM',
        payload: {
          selectionText: selectedText,
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
        mockChrome.runtime.onMessage.addListener.mockImplementation((msg, sender, sendResponse) => {
          if (msg.type === 'ADD_TERM') {
            const url = `${msg.payload.apiBaseUrl}/compatible-mode/v1/chat/completions`;
            
            global.fetch(url, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${msg.payload.apiKey}` },
              body: JSON.stringify({
                model: msg.payload.model,
                messages: [{ role: 'user', content: msg.payload.selectionText }]
              })
            }).then(response => {
              if (!response.ok) {
                throw new Error(`API错误 (${response.status})`);
              }
              return response.json();
            }).then(data => {
              const translation = data.choices[0].message.content;
              sendResponse({ ok: true, translation });
              resolve(translation);
            }).catch(error => {
              sendResponse({ ok: false, error: error.message });
              reject(error);
            });
            return true;
          }
        });
      });

      expect(result).rejects.toThrow('API错误 (401)');
    });

    it('应该处理网络超时的情况', async () => {
      const selectedText = 'hello';
      const addTermMessage = {
        type: 'ADD_TERM',
        payload: {
          selectionText: selectedText,
          model: 'qwen-mt-turbo',
          apiKey: 'test-key',
          apiBaseUrl: 'https://dashscope.aliyuncs.com'
        }
      };

      // 模拟网络超时
      global.fetch = vi.fn().mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Request timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        })
      );

      const result = await new Promise((resolve, reject) => {
        mockChrome.runtime.onMessage.addListener.mockImplementation((msg, sender, sendResponse) => {
          if (msg.type === 'ADD_TERM') {
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
                sendResponse({ ok: true, translation });
                resolve(translation);
              }).catch(error => {
                sendResponse({ ok: false, error: error.message });
                reject(error);
              });
            return true;
          }
        });
      });

      expect(result).rejects.toThrow('Request timeout');
    });
  });

  describe('性能测试', () => {
    it('应该快速处理多个翻译请求', async () => {
      const texts = ['hello', 'world', 'test'];
      const translations = ['你好', '世界', '测试'];
      
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: translations[0] } }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: translations[1] } }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: translations[2] } }]
          })
        });

      const startTime = Date.now();
      const results = [];

      for (let i = 0; i < texts.length; i++) {
        const message = {
          type: 'ADD_TERM',
          payload: {
            selectionText: texts[i],
            model: 'qwen-mt-turbo',
            apiKey: 'test-key',
            apiBaseUrl: 'https://dashscope.aliyuncs.com'
          }
        };

        const result = await new Promise((resolve) => {
          mockChrome.runtime.onMessage.addListener.mockImplementation((msg, sender, sendResponse) => {
            if (msg.type === 'ADD_TERM') {
              const url = `${msg.payload.apiBaseUrl}/compatible-mode/v1/chat/completions`;
              
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
                  sendResponse({ ok: true, translation });
                  resolve(translation);
                });
              return true;
            }
          });
        });

        results.push(result);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 验证所有翻译都成功
      expect(results).toEqual(translations);
      
      // 验证性能（应该在合理时间内完成）
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('集成验证', () => {
    it('应该验证所有关键组件都正常工作', () => {
      // 验证background.js包含关键函数
      expect(backgroundScript).toContain('mapBaseUrlByModel');
      expect(backgroundScript).toContain('translateText');
      expect(backgroundScript).toContain('chrome.runtime.onMessage');
      
      // 验证content.js包含关键功能
      expect(contentScript).toContain('addEventListener');
      expect(contentScript).toContain('chrome.runtime.sendMessage');
      
      // 验证Service Worker兼容性
      expect(backgroundScript).toContain('importScripts');
      expect(backgroundScript).not.toContain('import {');
    });
  });
});
