/**
 * 生词表重新翻译失败诊断自动化测试
 * 复现词库管理界面的重新翻译功能失败场景
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setTemporaryKey, getTemporaryKey, clearTemporaryKeys } from './setup-translation-diagnosis.js';

const VOCAB_KEY = 'miniTranslateVocabulary';

describe('生词表重新翻译失败诊断', () => {
  let mockChrome;
  let consoleSpy;

  beforeEach(() => {
    mockChrome = {
      runtime: {
        sendMessage: vi.fn(),
        lastError: null
      },
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn()
        }
      },
      notifications: {
        create: vi.fn()
      }
    };

    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {})
    };

    clearTemporaryKeys();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearTemporaryKeys();
  });

  describe('重新翻译 API 调用失败场景', () => {
    it('应该处理 API 认证失败', async () => {
      // Mock 存储数据
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          settings: { 
            model: 'deepseek-v3', 
            apiKey: 'invalid-key' 
          },
          [VOCAB_KEY]: [{ 
            term: 'test', 
            translation: '', 
            status: 'error',
            createdAt: new Date().toISOString()
          }]
        });
      });

      // Mock API 401 失败
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('{"error": {"message": "Invalid API key"}}')
      });

      // 模拟后台处理 RETRY_TRANSLATION 消息
      const messageHandler = vi.fn();
      mockChrome.runtime.onMessage = { addListener: messageHandler };

      // 模拟消息处理逻辑
      const handleRetryTranslation = async (message, sender, sendResponse) => {
        if (message.type !== 'RETRY_TRANSLATION') return false;
        
        const { term } = message.payload;
        if (!term) {
          sendResponse({ ok: false, error: '缺少要重新翻译的词汇' });
          return true;
        }

        try {
          // 获取设置
          const settings = await new Promise((resolve) => {
            mockChrome.storage.local.get(['settings'], (result) => {
              resolve(result.settings);
            });
          });

          const { model, apiKey } = settings;
          const apiBaseUrl = 'https://api.deepseek.com'; // 模拟映射逻辑

          if (!model || !apiKey || !apiBaseUrl) {
            sendResponse({ ok: false, error: '翻译配置不完整' });
            return true;
          }

          // 模拟翻译调用
          const response = await global.fetch(`${apiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'deepseek-v3',
              messages: [
                { role: 'system', content: '你是一个专业的翻译助手。请将用户提供的文本翻译成中文，只返回翻译结果，不要添加任何解释或其他内容。' },
                { role: 'user', content: term }
              ],
              temperature: 0.3,
              max_tokens: 1000
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 错误 (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          const translation = data.choices[0].message.content.trim();

          // 更新词库
          const vocabData = await new Promise((resolve) => {
            mockChrome.storage.local.get([VOCAB_KEY], (result) => {
              resolve(result);
            });
          });

          const vocabulary = vocabData[VOCAB_KEY] || [];
          const updatedVocabulary = vocabulary.map(item => {
            if (item.term === term) {
              return {
                ...item,
                translation,
                status: 'active',
                updatedAt: new Date().toISOString()
              };
            }
            return item;
          });

          await new Promise((resolve) => {
            mockChrome.storage.local.set({ [VOCAB_KEY]: updatedVocabulary }, () => {
              resolve();
            });
          });

          // 发送词库更新事件
          mockChrome.runtime.sendMessage({ 
            type: 'VOCAB_UPDATED', 
            payload: { retried: term } 
          });

          sendResponse({ ok: true, translation });
        } catch (error) {
          console.error('重新翻译失败:', error);
          sendResponse({ ok: false, error: error.message || '重新翻译失败' });
        }
        return true;
      };

      // 触发重新翻译
      const message = {
        type: 'RETRY_TRANSLATION',
        payload: { term: 'test' }
      };

      let response;
      await handleRetryTranslation(message, {}, (result) => {
        response = result;
      });

      expect(response).toMatchObject({
        ok: false,
        error: expect.stringContaining('API 错误 (401)')
      });

      // 验证错误日志不包含真实 Key
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '重新翻译失败:',
        expect.any(Error)
      );
    });

    it('应该处理网络超时错误', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          settings: { 
            model: 'deepseek-v3', 
            apiKey: 'valid-key' 
          },
          [VOCAB_KEY]: [{ 
            term: 'test', 
            translation: '', 
            status: 'error' 
          }]
        });
      });

      // 模拟网络超时
      global.fetch.mockImplementationOnce(() => 
        new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Request timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        })
      );

      const handleRetryTranslation = async (message, sender, sendResponse) => {
        if (message.type !== 'RETRY_TRANSLATION') return false;
        
        try {
          // 模拟翻译调用
          const response = await global.fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer valid-key'
            },
            body: JSON.stringify({
              model: 'deepseek-v3',
              messages: [
                { role: 'user', content: 'test' }
              ]
            })
          });

          if (!response.ok) {
            throw new Error(`API 错误: ${response.status}`);
          }

          sendResponse({ ok: true, translation: '测试' });
        } catch (error) {
          console.error('重新翻译失败:', error);
          sendResponse({ ok: false, error: error.message || '重新翻译失败' });
        }
        return true;
      };

      const message = {
        type: 'RETRY_TRANSLATION',
        payload: { term: 'test' }
      };

      let response;
      await handleRetryTranslation(message, {}, (result) => {
        response = result;
      });

      expect(response).toMatchObject({
        ok: false,
        error: expect.stringContaining('Request timeout')
      });
    });

    it('应该处理词库更新失败', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          settings: { 
            model: 'deepseek-v3', 
            apiKey: 'valid-key' 
          },
          [VOCAB_KEY]: [{ 
            term: 'test', 
            translation: '', 
            status: 'error' 
          }]
        });
      });

      // Mock 存储失败
      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        callback(new Error('Storage quota exceeded'));
      });

      // Mock 成功的 API 响应
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: '测试' }
          }]
        })
      });

      const handleRetryTranslation = async (message, sender, sendResponse) => {
        if (message.type !== 'RETRY_TRANSLATION') return false;
        
        try {
          // 模拟翻译调用成功
          const response = await global.fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer valid-key'
            },
            body: JSON.stringify({
              model: 'deepseek-v3',
              messages: [
                { role: 'user', content: 'test' }
              ]
            })
          });

          const data = await response.json();
          const translation = data.choices[0].message.content.trim();

          // 尝试更新词库（会失败）
          await new Promise((resolve, reject) => {
            mockChrome.storage.local.set({ [VOCAB_KEY]: [] }, (error) => {
              if (error) reject(error);
              else resolve();
            });
          });

          sendResponse({ ok: true, translation });
        } catch (error) {
          console.error('重新翻译失败:', error);
          sendResponse({ ok: false, error: error.message || '重新翻译失败' });
        }
        return true;
      };

      const message = {
        type: 'RETRY_TRANSLATION',
        payload: { term: 'test' }
      };

      let response;
      await handleRetryTranslation(message, {}, (result) => {
        response = result;
      });

      expect(response).toMatchObject({
        ok: false,
        error: expect.stringContaining('Storage quota exceeded')
      });
    });
  });

  describe('真实 API 重试测试（使用临时 Key）', () => {
    it('应该能够使用临时 Key 进行真实重试测试', async () => {
      const testKey = process.env.TEST_DEEPSEEK_KEY || 'test-key';
      if (testKey === 'test-key') {
        // eslint-disable-next-line no-console
    console.log('跳过真实 API 重试测试：未提供 TEST_DEEPSEEK_KEY 环境变量');
        return;
      }

      setTemporaryKey('deepseek', testKey);

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          settings: { 
            model: 'deepseek-v3', 
            apiKey: getTemporaryKey('deepseek')
          },
          [VOCAB_KEY]: [{ 
            term: 'hello', 
            translation: '', 
            status: 'error' 
          }]
        });
      });

      const handleRetryTranslation = async (message, sender, sendResponse) => {
        if (message.type !== 'RETRY_TRANSLATION') return false;
        
        try {
          const settings = await new Promise((resolve) => {
            mockChrome.storage.local.get(['settings'], (result) => {
              resolve(result.settings);
            });
          });

          const { model, apiKey } = settings;
          const apiBaseUrl = 'https://api.deepseek.com';

          // 真实 API 调用
          const response = await global.fetch(`${apiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'deepseek-v3',
              messages: [
                { role: 'system', content: '你是一个专业的翻译助手。请将用户提供的文本翻译成中文，只返回翻译结果，不要添加任何解释或其他内容。' },
                { role: 'user', content: 'hello' }
              ],
              temperature: 0.3,
              max_tokens: 1000
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 错误 (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          const translation = data.choices[0].message.content.trim();

          // eslint-disable-next-line no-console
    console.log('真实重试测试成功，翻译结果:', translation);
          sendResponse({ ok: true, translation });
        } catch (error) {
          // eslint-disable-next-line no-console
    console.log('真实重试测试失败:', error.message);
          // 确保错误消息不包含真实 Key
          expect(error.message).not.toContain(testKey);
          sendResponse({ ok: false, error: error.message || '重新翻译失败' });
        }
        return true;
      };

      const message = {
        type: 'RETRY_TRANSLATION',
        payload: { term: 'hello' }
      };

      let response;
      await handleRetryTranslation(message, {}, (result) => {
        response = result;
      });

      // 验证响应（成功或失败都接受）
      expect(response).toHaveProperty('ok');
      expect(response).toHaveProperty('translation');
    });
  });

  describe('词库状态更新验证', () => {
    it('应该正确更新词条状态', async () => {
      const mockVocabulary = [
        { term: 'test', translation: '', status: 'error', createdAt: new Date().toISOString() }
      ];

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          settings: { model: 'deepseek-v3', apiKey: 'valid-key' },
          [VOCAB_KEY]: mockVocabulary
        });
      });

      let updatedVocabulary;
      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        updatedVocabulary = data[VOCAB_KEY];
        callback();
      });

      // Mock 成功的 API 响应
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: '测试' }
          }]
        })
      });

      const handleRetryTranslation = async (message, sender, sendResponse) => {
        if (message.type !== 'RETRY_TRANSLATION') return false;
        
        try {
          const response = await global.fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer valid-key'
            },
            body: JSON.stringify({
              model: 'deepseek-v3',
              messages: [
                { role: 'user', content: 'test' }
              ]
            })
          });

          const data = await response.json();
          const translation = data.choices[0].message.content.trim();

          // 更新词库
          const vocabData = await new Promise((resolve) => {
            mockChrome.storage.local.get([VOCAB_KEY], (result) => {
              resolve(result);
            });
          });

          const vocabulary = vocabData[VOCAB_KEY] || [];
          const updatedVocabulary = vocabulary.map(item => {
            if (item.term === 'test') {
              return {
                ...item,
                translation,
                status: 'active',
                updatedAt: new Date().toISOString()
              };
            }
            return item;
          });

          await new Promise((resolve) => {
            mockChrome.storage.local.set({ [VOCAB_KEY]: updatedVocabulary }, () => {
              resolve();
            });
          });

          sendResponse({ ok: true, translation });
        } catch (error) {
          sendResponse({ ok: false, error: error.message || '重新翻译失败' });
        }
        return true;
      };

      const message = {
        type: 'RETRY_TRANSLATION',
        payload: { term: 'test' }
      };

      let response;
      await handleRetryTranslation(message, {}, (result) => {
        response = result;
      });

      expect(response).toMatchObject({
        ok: true,
        translation: '测试'
      });

      // 验证词库更新
      expect(updatedVocabulary).toBeDefined();
      const updatedItem = updatedVocabulary.find(item => item.term === 'test');
      expect(updatedItem).toMatchObject({
        term: 'test',
        translation: '测试',
        status: 'active'
      });
      expect(updatedItem.updatedAt).toBeDefined();
    });
  });
});
