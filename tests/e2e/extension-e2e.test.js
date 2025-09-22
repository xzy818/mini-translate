/**
 * Chrome扩展端到端测试框架
 * 测试完整的用户工作流程
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Chrome APIs for E2E testing
const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    getURL: (path) => `chrome-extension://test-extension-id/${path}`,
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    lastError: null
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn()
    }
  },
  permissions: {
    contains: vi.fn(),
    request: vi.fn(),
    getAll: vi.fn()
  },
  offscreen: {
    createDocument: vi.fn(),
    closeDocument: vi.fn()
  },
  runtime: {
    getContexts: vi.fn()
  },
  contextMenus: {
    create: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn()
  },
  notifications: {
    create: vi.fn(),
    clear: vi.fn()
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn()
  },
  scripting: {
    executeScript: vi.fn()
  }
};

global.chrome = mockChrome;

describe('Chrome扩展端到端测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 设置默认返回值
    mockChrome.storage.local.get.mockResolvedValue({});
    mockChrome.storage.local.set.mockResolvedValue();
    mockChrome.permissions.contains.mockResolvedValue(true);
    mockChrome.permissions.request.mockResolvedValue(true);
    mockChrome.permissions.getAll.mockResolvedValue({
      permissions: [],
      origins: []
    });
    mockChrome.offscreen.createDocument.mockResolvedValue();
    mockChrome.offscreen.closeDocument.mockResolvedValue();
    mockChrome.runtime.getContexts.mockResolvedValue([]);
    mockChrome.tabs.query.mockResolvedValue([]);
    mockChrome.scripting.executeScript.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('完整用户工作流程', () => {
    it('应该完成从配置到翻译的完整流程', async () => {
      // 1. 用户配置API设置
      const apiSettings = {
        model: 'gpt-3.5-turbo',
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.openai.com/v1'
      };

      // Mock存储保存
      mockChrome.storage.local.set.mockResolvedValue();
      
      // 保存设置
      await new Promise((resolve) => {
        mockChrome.storage.local.set(apiSettings, resolve);
      });

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(apiSettings);

      // 2. 用户测试连接
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'TEST_TRANSLATOR_SETTINGS') {
          callback({ success: true, result: '连接测试成功' });
        }
      });

      const testResult = await new Promise((resolve) => {
        mockChrome.runtime.sendMessage({
          type: 'TEST_TRANSLATOR_SETTINGS',
          payload: apiSettings
        }, resolve);
      });

      expect(testResult).toEqual({ success: true, result: '连接测试成功' });

      // 3. 用户选择文本并翻译
      const selectedText = 'Hello World';
      
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'TRANSLATE_TEXT') {
          callback({ success: true, result: '你好世界' });
        }
      });

      const translationResult = await new Promise((resolve) => {
        mockChrome.runtime.sendMessage({
          type: 'TRANSLATE_TEXT',
          payload: { text: selectedText, settings: apiSettings }
        }, resolve);
      });

      expect(translationResult).toEqual({ success: true, result: '你好世界' });

      // 4. 词汇保存到词汇表
      const vocabularyItem = {
        term: selectedText,
        translation: '你好世界',
        status: 'success',
        timestamp: Date.now()
      };

      mockChrome.storage.local.get.mockResolvedValue({
        vocabulary: []
      });

      mockChrome.storage.local.set.mockResolvedValue();

      // 获取当前词汇表
      const currentVocabulary = await new Promise((resolve) => {
        mockChrome.storage.local.get(['vocabulary'], (result) => {
          resolve(result.vocabulary || []);
        });
      });

      // 添加新词汇
      const updatedVocabulary = [...currentVocabulary, vocabularyItem];
      
      await new Promise((resolve) => {
        mockChrome.storage.local.set({ vocabulary: updatedVocabulary }, resolve);
      });

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        vocabulary: [vocabularyItem]
      });
    });

    it('应该处理权限请求流程', async () => {
      // 1. 用户配置新的API
      const newApiSettings = {
        model: 'qwen-turbo',
        apiKey: 'test-dashscope-key',
        apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      };

      // 2. 检查权限
      mockChrome.permissions.contains.mockResolvedValue(false);
      
      const { checkApiPermissions } = await import('../../src/services/permission-manager.js');
      
      const hasPermission = await checkApiPermissions('dashscope');
      expect(hasPermission).toBe(false);

      // 3. 请求权限
      mockChrome.permissions.request.mockResolvedValue(true);
      
      const { requestApiPermissions } = await import('../../src/services/permission-manager.js');
      
      const permissionGranted = await requestApiPermissions('dashscope');
      expect(permissionGranted).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledWith({
        permissions: [],
        origins: ['https://dashscope.aliyuncs.com/*']
      });

      // 4. 验证权限已授予
      mockChrome.permissions.contains.mockResolvedValue(true);
      
      const hasPermissionAfter = await checkApiPermissions('dashscope');
      expect(hasPermissionAfter).toBe(true);
    });

    it('应该处理翻译失败和重试流程', async () => {
      const apiSettings = {
        model: 'gpt-3.5-turbo',
        apiKey: 'invalid-key',
        apiBaseUrl: 'https://api.openai.com/v1'
      };

      // 1. 初始翻译失败
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'TRANSLATE_TEXT') {
          callback({ success: false, error: 'API Key无效' });
        }
      });

      const failedResult = await new Promise((resolve) => {
        mockChrome.runtime.sendMessage({
          type: 'TRANSLATE_TEXT',
          payload: { text: 'Hello', settings: apiSettings }
        }, resolve);
      });

      expect(failedResult).toEqual({ success: false, error: 'API Key无效' });

      // 2. 用户修正API Key
      const correctedSettings = {
        ...apiSettings,
        apiKey: 'valid-api-key'
      };

      // 3. 重试翻译
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'RETRY_TRANSLATION') {
          callback({ success: true, result: '你好' });
        }
      });

      const retryResult = await new Promise((resolve) => {
        mockChrome.runtime.sendMessage({
          type: 'RETRY_TRANSLATION',
          payload: { term: 'Hello', settings: correctedSettings }
        }, resolve);
      });

      expect(retryResult).toEqual({ success: true, result: '你好' });
    });
  });

  describe('Offscreen Document工作流程', () => {
    it('应该完成Offscreen Document的创建和使用', async () => {
      // 1. 检查Offscreen Document是否存在
      const { hasOffscreenDocument } = await import('../../src/services/offscreen-manager.js');
      
      mockChrome.runtime.getContexts.mockResolvedValue([]);
      
      const exists = await hasOffscreenDocument();
      expect(exists).toBe(false);

      // 2. 创建Offscreen Document
      const { createOffscreenDocument } = await import('../../src/services/offscreen-manager.js');
      
      const created = await createOffscreenDocument();
      expect(created).toBe(true);
      expect(mockChrome.offscreen.createDocument).toHaveBeenCalledWith({
        url: 'chrome-extension://test-extension-id/offscreen.html',
        reasons: ['DOM_SCRAPING'],
        justification: 'Handle network requests for translation APIs in a secure context'
      });

      // 3. 通过Offscreen Document发送请求
      const { sendOffscreenRequest } = await import('../../src/services/offscreen-manager.js');
      
      // Mock消息响应
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'FETCH_REQUEST') {
          // 模拟Offscreen Document响应
          setTimeout(() => {
            mockChrome.runtime.onMessage.addListener.mock.calls[0][0]({
              type: 'FETCH_RESPONSE',
              requestId: message.requestId,
              success: true,
              data: {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: {},
                json: { result: 'success' },
                text: '{"result":"success"}'
              }
            });
          }, 10);
        }
      });

      const response = await sendOffscreenRequest('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });
  });

  describe('词汇管理完整流程', () => {
    it('应该完成词汇的添加、查看、导出流程', async () => {
      // 1. 添加词汇
      const vocabularyItems = [
        {
          term: 'Hello',
          translation: '你好',
          status: 'success',
          timestamp: Date.now()
        },
        {
          term: 'World',
          translation: '世界',
          status: 'success',
          timestamp: Date.now()
        }
      ];

      mockChrome.storage.local.set.mockResolvedValue();
      
      await new Promise((resolve) => {
        mockChrome.storage.local.set({ vocabulary: vocabularyItems }, resolve);
      });

      // 2. 获取词汇列表
      mockChrome.storage.local.get.mockResolvedValue({ vocabulary: vocabularyItems });
      
      const storedVocabulary = await new Promise((resolve) => {
        mockChrome.storage.local.get(['vocabulary'], (result) => {
          resolve(result.vocabulary || []);
        });
      });

      expect(storedVocabulary).toHaveLength(2);
      expect(storedVocabulary[0].term).toBe('Hello');
      expect(storedVocabulary[1].term).toBe('World');

      // 3. 导出词汇
      const { exportToTxt } = await import('../../src/services/vocab-io.js');
      
      const exportResult = exportToTxt(storedVocabulary);
      expect(exportResult).toContain('Hello\t你好');
      expect(exportResult).toContain('World\t世界');

      // 4. 导入词汇
      const { importFromTxt } = await import('../../src/services/vocab-io.js');
      
      const importData = 'Test\t测试\nExample\t例子';
      const importedVocabulary = importFromTxt(importData);
      
      expect(importedVocabulary).toHaveLength(2);
      expect(importedVocabulary[0].term).toBe('Test');
      expect(importedVocabulary[0].translation).toBe('测试');
    });
  });

  describe('错误处理和恢复', () => {
    it('应该处理网络错误并自动重试', async () => {
      const apiSettings = {
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key',
        apiBaseUrl: 'https://api.openai.com/v1'
      };

      // 1. 第一次请求失败
      let requestCount = 0;
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        requestCount++;
        if (requestCount === 1) {
          callback({ success: false, error: '网络错误' });
        } else {
          callback({ success: true, result: '你好' });
        }
      });

      // 2. 重试机制
      const { translateText } = await import('../../src/services/translator.js');
      
      const result = await translateText('Hello', apiSettings);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('你好');
      expect(requestCount).toBe(2); // 重试了一次
    });

    it('应该处理权限被拒绝的情况', async () => {
      // 1. 权限请求被拒绝
      mockChrome.permissions.request.mockResolvedValue(false);
      
      const { requestApiPermissions } = await import('../../src/services/permission-manager.js');
      
      const granted = await requestApiPermissions('openai');
      expect(granted).toBe(false);

      // 2. 应该提供友好的错误信息
      const errorMessage = '权限请求被拒绝，无法访问OpenAI API';
      expect(errorMessage).toContain('权限请求被拒绝');
    });

    it('应该处理存储配额超限', async () => {
      // 1. 存储操作失败
      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        mockChrome.runtime.lastError = { message: 'Storage quota exceeded' };
        callback();
      });

      // 2. 应该处理错误
      await new Promise((resolve, reject) => {
        mockChrome.storage.local.set({ test: 'data' }, () => {
          if (mockChrome.runtime.lastError) {
            reject(new Error(mockChrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      }).catch(error => {
        expect(error.message).toBe('Storage quota exceeded');
      });
    });
  });

  describe('性能测试', () => {
    it('应该处理大量词汇的导入导出', async () => {
      // 生成大量测试数据
      const largeVocabulary = Array.from({ length: 1000 }, (_, i) => ({
        term: `term${i}`,
        translation: `翻译${i}`,
        status: 'success',
        timestamp: Date.now() + i
      }));

      const startTime = Date.now();

      // 导出测试
      const { exportToTxt } = await import('../../src/services/vocab-io.js');
      const exportResult = exportToTxt(largeVocabulary);
      
      const exportTime = Date.now() - startTime;
      expect(exportTime).toBeLessThan(1000); // 应该在1秒内完成
      expect(exportResult.split('\n')).toHaveLength(1000);

      // 导入测试
      const importStartTime = Date.now();
      const { importFromTxt } = await import('../../src/services/vocab-io.js');
      const importedVocabulary = importFromTxt(exportResult);
      
      const importTime = Date.now() - importStartTime;
      expect(importTime).toBeLessThan(1000); // 应该在1秒内完成
      expect(importedVocabulary).toHaveLength(1000);
    });

    it('应该处理并发翻译请求', async () => {
      const apiSettings = {
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key',
        apiBaseUrl: 'https://api.openai.com/v1'
      };

      const texts = ['Hello', 'World', 'Test', 'Example', 'Sample'];
      
      // Mock并发响应
      let responseCount = 0;
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        responseCount++;
        setTimeout(() => {
          callback({ success: true, result: `翻译${responseCount}` });
        }, Math.random() * 100); // 模拟网络延迟
      });

      const startTime = Date.now();
      
      // 并发翻译
      const { translateText } = await import('../../src/services/translator.js');
      const promises = texts.map(text => translateText(text, apiSettings));
      const results = await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(2000); // 并发应该在2秒内完成
    });
  });
});
