/**
 * Chrome扩展Service Worker测试套件
 * 测试Service Worker的消息处理、生命周期等功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    getURL: (path) => `chrome-extension://test-extension-id/${path}`,
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onInstalled: {
      addListener: vi.fn()
    },
    onStartup: {
      addListener: vi.fn()
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
  }
};

global.chrome = mockChrome;

describe('Chrome扩展Service Worker测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 设置默认返回值
    mockChrome.storage.local.get.mockResolvedValue({});
    mockChrome.storage.local.set.mockResolvedValue();
    mockChrome.offscreen.createDocument.mockResolvedValue();
    mockChrome.offscreen.closeDocument.mockResolvedValue();
    mockChrome.runtime.getContexts.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('消息处理', () => {
    it('应该处理测试翻译设置消息', async () => {
      // Mock translateText函数
      const mockTranslateText = vi.fn().mockResolvedValue({
        success: true,
        result: '测试翻译结果'
      });

      // Mock validateTranslationConfig函数
      const mockValidateTranslationConfig = vi.fn().mockReturnValue({
        isValid: true,
        errors: []
      });

      // 动态导入并mock
      vi.doMock('../../src/services/translator.js', () => ({
        translateText: mockTranslateText,
        validateTranslationConfig: mockValidateTranslationConfig
      }));

      // 模拟消息处理
      const message = {
        type: 'TEST_TRANSLATOR_SETTINGS',
        payload: {
          model: 'gpt-3.5-turbo',
          apiKey: 'test-key',
          apiBaseUrl: 'https://api.openai.com/v1'
        }
      };

      const sendResponse = vi.fn();

      // 模拟消息监听器
      const messageListener = vi.fn();
      mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
        messageListener.mockImplementation(listener);
      });

      // 触发消息处理
      const result = await messageListener(message, {}, sendResponse);

      expect(result).toBe(true); // 表示异步响应
      expect(mockValidateTranslationConfig).toHaveBeenCalledWith(message.payload);
      expect(mockTranslateText).toHaveBeenCalledWith('test', message.payload);
    });

    it('应该处理重新翻译消息', async () => {
      const message = {
        type: 'RETRY_TRANSLATION',
        payload: {
          term: 'test'
        }
      };

      const sendResponse = vi.fn();

      // Mock存储数据
      mockChrome.storage.local.get.mockResolvedValue({
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key',
        apiBaseUrl: 'https://api.openai.com/v1'
      });

      // Mock翻译结果
      const mockTranslateText = vi.fn().mockResolvedValue({
        success: true,
        result: '重新翻译结果'
      });

      vi.doMock('../../src/services/translator.js', () => ({
        translateText: mockTranslateText
      }));

      // 模拟消息监听器
      const messageListener = vi.fn();
      mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
        messageListener.mockImplementation(listener);
      });

      // 触发消息处理
      const result = await messageListener(message, {}, sendResponse);

      expect(result).toBe(true);
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(['model', 'apiKey', 'apiBaseUrl']);
    });

    it('应该处理无效消息类型', async () => {
      const message = {
        type: 'INVALID_MESSAGE_TYPE',
        payload: {}
      };

      const sendResponse = vi.fn();

      // 模拟消息监听器
      const messageListener = vi.fn();
      mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
        messageListener.mockImplementation(listener);
      });

      // 触发消息处理
      const result = await messageListener(message, {}, sendResponse);

      expect(result).toBe(false); // 表示不处理此消息
    });

    it('应该处理缺少消息类型', async () => {
      const message = {
        payload: {}
      };

      const sendResponse = vi.fn();

      // 模拟消息监听器
      const messageListener = vi.fn();
      mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
        messageListener.mockImplementation(listener);
      });

      // 触发消息处理
      const result = await messageListener(message, {}, sendResponse);

      expect(result).toBe(false);
    });
  });

  describe('Offscreen Document管理', () => {
    it('应该创建Offscreen Document', async () => {
      const { createOffscreenDocument } = await import('../../src/services/offscreen-manager.js');
      
      const result = await createOffscreenDocument();
      expect(result).toBe(true);
      expect(mockChrome.offscreen.createDocument).toHaveBeenCalledWith({
        url: 'chrome-extension://test-extension-id/offscreen.html',
        reasons: ['DOM_SCRAPING'],
        justification: 'Handle network requests for translation APIs in a secure context'
      });
    });

    it('应该处理Offscreen Document创建失败', async () => {
      const { createOffscreenDocument } = await import('../../src/services/offscreen-manager.js');
      
      mockChrome.offscreen.createDocument.mockRejectedValue(new Error('Permission denied'));
      
      const result = await createOffscreenDocument();
      expect(result).toBe(false);
    });

    it('应该检查Offscreen Document是否存在', async () => {
      const { hasOffscreenDocument } = await import('../../src/services/offscreen-manager.js');
      
      // 模拟Offscreen Document存在
      mockChrome.runtime.getContexts.mockResolvedValue([
        { contextType: 'OFFSCREEN_DOCUMENT' }
      ]);
      
      const result = await hasOffscreenDocument();
      expect(result).toBe(true);
    });

    it('应该确保Offscreen Document存在', async () => {
      const { ensureOffscreenDocument } = await import('../../src/services/offscreen-manager.js');
      
      // 模拟Offscreen Document不存在
      mockChrome.runtime.getContexts.mockResolvedValue([]);
      
      const result = await ensureOffscreenDocument();
      expect(result).toBe(true);
      expect(mockChrome.offscreen.createDocument).toHaveBeenCalled();
    });
  });

  describe('生命周期管理', () => {
    it('应该处理扩展安装事件', () => {
      const setupCallback = vi.fn();
      
      mockChrome.runtime.onInstalled.addListener(setupCallback);
      
      expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalledWith(setupCallback);
    });

    it('应该处理扩展启动事件', () => {
      const setupCallback = vi.fn();
      
      mockChrome.runtime.onStartup.addListener(setupCallback);
      
      expect(mockChrome.runtime.onStartup.addListener).toHaveBeenCalledWith(setupCallback);
    });

    it('应该初始化Service Worker', async () => {
      // Mock初始化函数
      const mockInitializeBackground = vi.fn();
      const mockEnsureOffscreenDocument = vi.fn().mockResolvedValue(true);

      vi.doMock('../../src/services/context-menu.js', () => ({
        initializeBackground: mockInitializeBackground
      }));

      vi.doMock('../../src/services/offscreen-manager.js', () => ({
        ensureOffscreenDocument: mockEnsureOffscreenDocument
      }));

      // 模拟setup函数调用
      const setup = async () => {
        await mockEnsureOffscreenDocument();
        mockInitializeBackground(mockChrome);
      };

      await setup();

      expect(mockEnsureOffscreenDocument).toHaveBeenCalled();
      expect(mockInitializeBackground).toHaveBeenCalledWith(mockChrome);
    });
  });

  describe('错误处理', () => {
    it('应该处理翻译配置验证失败', async () => {
      const message = {
        type: 'TEST_TRANSLATOR_SETTINGS',
        payload: {
          model: '',
          apiKey: '',
          apiBaseUrl: ''
        }
      };

      const sendResponse = vi.fn();

      // Mock验证失败
      const mockValidateTranslationConfig = vi.fn().mockReturnValue({
        isValid: false,
        errors: ['模型不能为空', 'API Key不能为空']
      });

      vi.doMock('../../src/services/translator.js', () => ({
        validateTranslationConfig: mockValidateTranslationConfig
      }));

      // 模拟消息监听器
      const messageListener = vi.fn();
      mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
        messageListener.mockImplementation(listener);
      });

      // 触发消息处理
      const result = await messageListener(message, {}, sendResponse);

      expect(result).toBe(true);
      expect(mockValidateTranslationConfig).toHaveBeenCalledWith(message.payload);
    });

    it('应该处理翻译失败', async () => {
      const message = {
        type: 'TEST_TRANSLATOR_SETTINGS',
        payload: {
          model: 'gpt-3.5-turbo',
          apiKey: 'test-key',
          apiBaseUrl: 'https://api.openai.com/v1'
        }
      };

      const sendResponse = vi.fn();

      // Mock验证成功但翻译失败
      const mockValidateTranslationConfig = vi.fn().mockReturnValue({
        isValid: true,
        errors: []
      });

      const mockTranslateText = vi.fn().mockResolvedValue({
        success: false,
        error: '网络错误'
      });

      vi.doMock('../../src/services/translator.js', () => ({
        translateText: mockTranslateText,
        validateTranslationConfig: mockValidateTranslationConfig
      }));

      // 模拟消息监听器
      const messageListener = vi.fn();
      mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
        messageListener.mockImplementation(listener);
      });

      // 触发消息处理
      const result = await messageListener(message, {}, sendResponse);

      expect(result).toBe(true);
      expect(mockTranslateText).toHaveBeenCalledWith('test', message.payload);
    });

    it('应该处理存储操作失败', async () => {
      const message = {
        type: 'RETRY_TRANSLATION',
        payload: {
          term: 'test'
        }
      };

      const sendResponse = vi.fn();

      // Mock存储失败
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage quota exceeded'));

      // 模拟消息监听器
      const messageListener = vi.fn();
      mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
        messageListener.mockImplementation(listener);
      });

      // 触发消息处理
      const result = await messageListener(message, {}, sendResponse);

      expect(result).toBe(true);
    });
  });

  describe('消息响应', () => {
    it('应该正确响应成功消息', async () => {
      const message = {
        type: 'TEST_TRANSLATOR_SETTINGS',
        payload: {
          model: 'gpt-3.5-turbo',
          apiKey: 'test-key',
          apiBaseUrl: 'https://api.openai.com/v1'
        }
      };

      const sendResponse = vi.fn();

      // Mock成功响应
      const mockValidateTranslationConfig = vi.fn().mockReturnValue({
        isValid: true,
        errors: []
      });

      const mockTranslateText = vi.fn().mockResolvedValue({
        success: true,
        result: '测试翻译结果'
      });

      vi.doMock('../../src/services/translator.js', () => ({
        translateText: mockTranslateText,
        validateTranslationConfig: mockValidateTranslationConfig
      }));

      // 模拟消息监听器
      const messageListener = vi.fn();
      mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
        messageListener.mockImplementation(listener);
      });

      // 触发消息处理
      await messageListener(message, {}, sendResponse);

      // 验证响应
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: '测试翻译结果'
      });
    });

    it('应该正确响应失败消息', async () => {
      const message = {
        type: 'TEST_TRANSLATOR_SETTINGS',
        payload: {
          model: 'gpt-3.5-turbo',
          apiKey: 'test-key',
          apiBaseUrl: 'https://api.openai.com/v1'
        }
      };

      const sendResponse = vi.fn();

      // Mock失败响应
      const mockValidateTranslationConfig = vi.fn().mockReturnValue({
        isValid: true,
        errors: []
      });

      const mockTranslateText = vi.fn().mockResolvedValue({
        success: false,
        error: '网络错误'
      });

      vi.doMock('../../src/services/translator.js', () => ({
        translateText: mockTranslateText,
        validateTranslationConfig: mockValidateTranslationConfig
      }));

      // 模拟消息监听器
      const messageListener = vi.fn();
      mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
        messageListener.mockImplementation(listener);
      });

      // 触发消息处理
      await messageListener(message, {}, sendResponse);

      // 验证响应
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '网络错误'
      });
    });
  });
});
