/**
 * Chrome扩展环境测试套件
 * 测试Chrome扩展特有的功能和环境
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    getURL: vi.fn((path) => `chrome-extension://test-extension-id/${path}`),
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
  permissions: {
    contains: vi.fn(),
    request: vi.fn(),
    remove: vi.fn(),
    getAll: vi.fn(),
    onAdded: {
      addListener: vi.fn()
    },
    onRemoved: {
      addListener: vi.fn()
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

// 设置全局Chrome mock
global.chrome = mockChrome;

describe('Chrome扩展环境测试', () => {
  beforeEach(() => {
    // 重置所有mock
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('环境检测', () => {
    it('应该正确检测Chrome扩展环境', async () => {
      const { isChromeExtension } = await import('../../src/services/translator.js');
      
      expect(isChromeExtension()).toBe(true);
    });

    it('应该正确获取扩展ID', async () => {
      const { isChromeExtension } = await import('../../src/services/translator.js');
      
      const result = isChromeExtension();
      expect(result).toBe('test-extension-id');
    });
  });

  describe('权限管理', () => {
    it('应该检查权限是否存在', async () => {
      const { hasPermission } = await import('../../src/services/permission-manager.js');
      
      const result = await hasPermission('storage');
      expect(result).toBe(true);
      expect(mockChrome.permissions.contains).toHaveBeenCalledWith({
        permissions: ['storage']
      });
    });

    it('应该检查host权限', async () => {
      const { hasPermission } = await import('../../src/services/permission-manager.js');
      
      const result = await hasPermission('https://api.openai.com/*');
      expect(result).toBe(true);
      expect(mockChrome.permissions.contains).toHaveBeenCalledWith({
        origins: ['https://api.openai.com/*']
      });
    });

    it('应该请求权限', async () => {
      const { requestPermission } = await import('../../src/services/permission-manager.js');
      
      const result = await requestPermission('storage');
      expect(result).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledWith({
        permissions: ['storage']
      });
    });

    it('应该请求host权限', async () => {
      const { requestPermission } = await import('../../src/services/permission-manager.js');
      
      const result = await requestPermission('https://api.openai.com/*');
      expect(result).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledWith({
        origins: ['https://api.openai.com/*']
      });
    });

    it('应该获取API所需权限', async () => {
      const { getRequiredPermissions } = await import('../../src/services/permission-manager.js');
      
      const openaiPermissions = getRequiredPermissions('openai');
      expect(openaiPermissions).toEqual({
        permissions: [],
        host_permissions: ['https://api.openai.com/*']
      });

      const dashscopePermissions = getRequiredPermissions('dashscope');
      expect(dashscopePermissions).toEqual({
        permissions: [],
        host_permissions: ['https://dashscope.aliyuncs.com/*']
      });
    });

    it('应该检查API权限', async () => {
      const { checkApiPermissions } = await import('../../src/services/permission-manager.js');
      
      const result = await checkApiPermissions('openai');
      expect(result).toBe(true);
      expect(mockChrome.permissions.contains).toHaveBeenCalledWith({
        origins: ['https://api.openai.com/*']
      });
    });

    it('应该请求API权限', async () => {
      const { requestApiPermissions } = await import('../../src/services/permission-manager.js');
      
      const result = await requestApiPermissions('openai');
      expect(result).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledWith({
        permissions: [],
        origins: ['https://api.openai.com/*']
      });
    });
  });

  describe('Offscreen Document管理', () => {
    it('应该检查Offscreen Document是否存在', async () => {
      const { hasOffscreenDocument } = await import('../../src/services/offscreen-manager.js');
      
      const result = await hasOffscreenDocument();
      expect(result).toBe(false);
      expect(mockChrome.runtime.getContexts).toHaveBeenCalledWith({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
    });

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

    it('应该关闭Offscreen Document', async () => {
      const { closeOffscreenDocument } = await import('../../src/services/offscreen-manager.js');
      
      await closeOffscreenDocument();
      expect(mockChrome.offscreen.closeDocument).toHaveBeenCalled();
    });

    it('应该确保Offscreen Document存在', async () => {
      // 模拟Offscreen Document不存在
      mockChrome.runtime.getContexts.mockResolvedValue([]);
      
      const { ensureOffscreenDocument } = await import('../../src/services/offscreen-manager.js');
      
      const result = await ensureOffscreenDocument();
      expect(result).toBe(true);
      expect(mockChrome.offscreen.createDocument).toHaveBeenCalled();
    });
  });

  describe('存储操作', () => {
    it('应该保存设置到Chrome存储', async () => {
      const settings = {
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key',
        apiBaseUrl: 'https://api.openai.com/v1'
      };

      await new Promise((resolve) => {
        mockChrome.storage.local.set(settings, resolve);
      });

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(settings);
    });

    it('应该从Chrome存储读取设置', async () => {
      const mockSettings = {
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key',
        apiBaseUrl: 'https://api.openai.com/v1'
      };

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(mockSettings);
      });

      const result = await new Promise((resolve) => {
        mockChrome.storage.local.get(['model', 'apiKey', 'apiBaseUrl'], resolve);
      });

      expect(result).toEqual(mockSettings);
    });
  });

  describe('消息传递', () => {
    it('应该发送消息到Service Worker', async () => {
      const message = {
        type: 'TEST_TRANSLATOR_SETTINGS',
        payload: { model: 'gpt-3.5-turbo' }
      };

      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true });
      });

      const result = await new Promise((resolve) => {
        mockChrome.runtime.sendMessage(message, resolve);
      });

      expect(result).toEqual({ success: true });
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(message, expect.any(Function));
    });

    it('应该处理消息监听器', () => {
      const listener = vi.fn();
      
      mockChrome.runtime.onMessage.addListener(listener);
      
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(listener);
    });
  });

  describe('错误处理', () => {
    it('应该处理权限请求失败', async () => {
      mockChrome.permissions.request.mockResolvedValue(false);
      
      const { requestPermission } = await import('../../src/services/permission-manager.js');
      
      const result = await requestPermission('storage');
      expect(result).toBe(false);
    });

    it('应该处理存储操作失败', async () => {
      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        mockChrome.runtime.lastError = { message: 'Storage quota exceeded' };
        callback();
      });

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

    it('应该处理Offscreen Document创建失败', async () => {
      mockChrome.offscreen.createDocument.mockRejectedValue(new Error('Permission denied'));
      
      const { createOffscreenDocument } = await import('../../src/services/offscreen-manager.js');
      
      const result = await createOffscreenDocument();
      expect(result).toBe(false);
    });
  });

  describe('扩展生命周期', () => {
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
  });
});
