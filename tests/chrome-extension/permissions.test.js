/**
 * Chrome扩展权限测试套件
 * 测试权限管理、动态权限请求等功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock Chrome APIs
const mockChrome = {
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
  storage: {
    local: {
      get: vi.fn()
    }
  }
};

global.chrome = mockChrome;

describe('Chrome扩展权限测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 设置默认返回值
    mockChrome.permissions.contains.mockResolvedValue(false);
    mockChrome.permissions.request.mockResolvedValue(true);
    mockChrome.permissions.getAll.mockResolvedValue({
      permissions: [],
      origins: []
    });
    mockChrome.storage.local.get.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('权限配置验证', () => {
    it('应该正确配置基础权限', async () => {
      const { PERMISSION_CONFIG } = await import('../../src/services/permission-manager.js');
      
      expect(PERMISSION_CONFIG.BASIC.permissions).toContain('storage');
      expect(PERMISSION_CONFIG.BASIC.permissions).toContain('contextMenus');
      expect(PERMISSION_CONFIG.BASIC.permissions).toContain('notifications');
      expect(PERMISSION_CONFIG.BASIC.host_permissions).toEqual([]);
    });

    it('应该正确配置OpenAI权限', async () => {
      const { PERMISSION_CONFIG } = await import('../../src/services/permission-manager.js');
      
      expect(PERMISSION_CONFIG.NETWORK.openai.permissions).toEqual([]);
      expect(PERMISSION_CONFIG.NETWORK.openai.host_permissions).toEqual(['https://api.openai.com/*']);
    });

    it('应该正确配置DashScope权限', async () => {
      const { PERMISSION_CONFIG } = await import('../../src/services/permission-manager.js');
      
      expect(PERMISSION_CONFIG.NETWORK.dashscope.permissions).toEqual([]);
      expect(PERMISSION_CONFIG.NETWORK.dashscope.host_permissions).toEqual(['https://dashscope.aliyuncs.com/*']);
    });

    it('应该正确配置DeepSeek权限', async () => {
      const { PERMISSION_CONFIG } = await import('../../src/services/permission-manager.js');
      
      expect(PERMISSION_CONFIG.NETWORK.deepseek.permissions).toEqual([]);
      expect(PERMISSION_CONFIG.NETWORK.deepseek.host_permissions).toEqual(['https://api.deepseek.com/*']);
    });

    it('应该正确配置高级功能权限', async () => {
      const { PERMISSION_CONFIG } = await import('../../src/services/permission-manager.js');
      
      expect(PERMISSION_CONFIG.ADVANCED.scripting.permissions).toEqual(['scripting', 'activeTab']);
      expect(PERMISSION_CONFIG.ADVANCED.offscreen.permissions).toEqual(['offscreen']);
    });
  });

  describe('权限检查功能', () => {
    it('应该检查普通权限', async () => {
      const { hasPermission } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.contains.mockResolvedValue(true);
      
      const result = await hasPermission('storage');
      expect(result).toBe(true);
      expect(mockChrome.permissions.contains).toHaveBeenCalledWith({
        permissions: ['storage']
      });
    });

    it('应该检查host权限', async () => {
      const { hasPermission } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.contains.mockResolvedValue(true);
      
      const result = await hasPermission('https://api.openai.com/*');
      expect(result).toBe(true);
      expect(mockChrome.permissions.contains).toHaveBeenCalledWith({
        origins: ['https://api.openai.com/*']
      });
    });

    it('应该处理权限检查失败', async () => {
      const { hasPermission } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.contains.mockRejectedValue(new Error('Permission check failed'));
      
      const result = await hasPermission('storage');
      expect(result).toBe(false);
    });
  });

  describe('权限请求功能', () => {
    it('应该请求普通权限', async () => {
      const { requestPermission } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.request.mockResolvedValue(true);
      
      const result = await requestPermission('storage');
      expect(result).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledWith({
        permissions: ['storage']
      });
    });

    it('应该请求host权限', async () => {
      const { requestPermission } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.request.mockResolvedValue(true);
      
      const result = await requestPermission('https://api.openai.com/*');
      expect(result).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledWith({
        origins: ['https://api.openai.com/*']
      });
    });

    it('应该处理权限请求被拒绝', async () => {
      const { requestPermission } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.request.mockResolvedValue(false);
      
      const result = await requestPermission('storage');
      expect(result).toBe(false);
    });

    it('应该处理权限请求失败', async () => {
      const { requestPermission } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.request.mockRejectedValue(new Error('Permission request failed'));
      
      const result = await requestPermission('storage');
      expect(result).toBe(false);
    });
  });

  describe('API权限管理', () => {
    it('应该获取OpenAI所需权限', async () => {
      const { getRequiredPermissions } = await import('../../src/services/permission-manager.js');
      
      const permissions = getRequiredPermissions('openai');
      expect(permissions).toEqual({
        permissions: [],
        host_permissions: ['https://api.openai.com/*']
      });
    });

    it('应该获取DashScope所需权限', async () => {
      const { getRequiredPermissions } = await import('../../src/services/permission-manager.js');
      
      const permissions = getRequiredPermissions('dashscope');
      expect(permissions).toEqual({
        permissions: [],
        host_permissions: ['https://dashscope.aliyuncs.com/*']
      });
    });

    it('应该获取DeepSeek所需权限', async () => {
      const { getRequiredPermissions } = await import('../../src/services/permission-manager.js');
      
      const permissions = getRequiredPermissions('deepseek');
      expect(permissions).toEqual({
        permissions: [],
        host_permissions: ['https://api.deepseek.com/*']
      });
    });

    it('应该处理不支持的API类型', async () => {
      const { getRequiredPermissions } = await import('../../src/services/permission-manager.js');
      
      expect(() => {
        getRequiredPermissions('unsupported-api');
      }).toThrow('不支持的API类型: unsupported-api');
    });

    it('应该检查API权限', async () => {
      const { checkApiPermissions } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.contains.mockResolvedValue(true);
      
      const result = await checkApiPermissions('openai');
      expect(result).toBe(true);
      expect(mockChrome.permissions.contains).toHaveBeenCalledWith({
        origins: ['https://api.openai.com/*']
      });
    });

    it('应该请求API权限', async () => {
      const { requestApiPermissions } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.contains.mockResolvedValue(false);
      mockChrome.permissions.request.mockResolvedValue(true);
      
      const result = await requestApiPermissions('openai');
      expect(result).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledWith({
        permissions: [],
        origins: ['https://api.openai.com/*']
      });
    });

    it('应该跳过已存在的API权限', async () => {
      const { requestApiPermissions } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.contains.mockResolvedValue(true);
      
      const result = await requestApiPermissions('openai');
      expect(result).toBe(true);
      expect(mockChrome.permissions.request).not.toHaveBeenCalled();
    });
  });

  describe('使用的API检测', () => {
    it('应该检测OpenAI API使用', async () => {
      const { getUsedApis } = await import('../../src/services/permission-manager.js');
      
      mockChrome.storage.local.get.mockResolvedValue({
        apiBaseUrl: 'https://api.openai.com/v1'
      });
      
      const apis = await getUsedApis();
      expect(apis).toContain('openai');
    });

    it('应该检测DashScope API使用', async () => {
      const { getUsedApis } = await import('../../src/services/permission-manager.js');
      
      mockChrome.storage.local.get.mockResolvedValue({
        apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      });
      
      const apis = await getUsedApis();
      expect(apis).toContain('dashscope');
    });

    it('应该检测DeepSeek API使用', async () => {
      const { getUsedApis } = await import('../../src/services/permission-manager.js');
      
      mockChrome.storage.local.get.mockResolvedValue({
        apiBaseUrl: 'https://api.deepseek.com/v1'
      });
      
      const apis = await getUsedApis();
      expect(apis).toContain('deepseek');
    });

    it('应该检测多个API使用', async () => {
      const { getUsedApis } = await import('../../src/services/permission-manager.js');
      
      mockChrome.storage.local.get.mockResolvedValue({
        apiBaseUrl: 'https://api.openai.com/v1,https://dashscope.aliyuncs.com/compatible-mode/v1'
      });
      
      const apis = await getUsedApis();
      expect(apis).toContain('openai');
      expect(apis).toContain('dashscope');
    });

    it('应该处理无API配置', async () => {
      const { getUsedApis } = await import('../../src/services/permission-manager.js');
      
      mockChrome.storage.local.get.mockResolvedValue({});
      
      const apis = await getUsedApis();
      expect(apis).toEqual([]);
    });

    it('应该处理存储读取失败', async () => {
      const { getUsedApis } = await import('../../src/services/permission-manager.js');
      
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage read failed'));
      
      const apis = await getUsedApis();
      expect(apis).toEqual([]);
    });
  });

  describe('权限清理功能', () => {
    it('应该移除不需要的权限', async () => {
      const { removeUnusedPermissions } = await import('../../src/services/permission-manager.js');
      
      // 模拟当前有不需要的权限
      mockChrome.permissions.getAll.mockResolvedValue({
        permissions: [],
        origins: ['https://unused-api.com/*']
      });
      
      mockChrome.storage.local.get.mockResolvedValue({
        apiBaseUrl: 'https://api.openai.com/v1'
      });
      
      mockChrome.permissions.remove.mockResolvedValue(true);
      
      await removeUnusedPermissions();
      
      expect(mockChrome.permissions.remove).toHaveBeenCalledWith({
        permissions: [],
        origins: ['https://unused-api.com/*']
      });
    });

    it('应该保留需要的权限', async () => {
      const { removeUnusedPermissions } = await import('../../src/services/permission-manager.js');
      
      // 模拟当前只有需要的权限
      mockChrome.permissions.getAll.mockResolvedValue({
        permissions: [],
        origins: ['https://api.openai.com/*']
      });
      
      mockChrome.storage.local.get.mockResolvedValue({
        apiBaseUrl: 'https://api.openai.com/v1'
      });
      
      await removeUnusedPermissions();
      
      expect(mockChrome.permissions.remove).not.toHaveBeenCalled();
    });
  });

  describe('权限监控', () => {
    it('应该设置权限变化监听器', async () => {
      const { setupPermissionMonitoring } = await import('../../src/services/permission-manager.js');
      
      setupPermissionMonitoring();
      
      expect(mockChrome.permissions.onAdded.addListener).toHaveBeenCalled();
      expect(mockChrome.permissions.onRemoved.addListener).toHaveBeenCalled();
    });
  });

  describe('权限管理器初始化', () => {
    it('应该初始化权限管理器', async () => {
      const { initializePermissionManager } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.contains.mockResolvedValue(true);
      mockChrome.storage.local.get.mockResolvedValue({
        apiBaseUrl: 'https://api.openai.com/v1'
      });
      
      await initializePermissionManager();
      
      expect(mockChrome.permissions.onAdded.addListener).toHaveBeenCalled();
      expect(mockChrome.permissions.onRemoved.addListener).toHaveBeenCalled();
    });

    it('应该处理初始化失败', async () => {
      const { initializePermissionManager } = await import('../../src/services/permission-manager.js');
      
      mockChrome.permissions.contains.mockRejectedValue(new Error('Permission check failed'));
      
      await initializePermissionManager();
      
      // 应该不抛出错误，而是记录错误
      expect(true).toBe(true);
    });
  });
});
