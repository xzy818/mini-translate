// 配置管理服务
// 负责动态配置管理、用户配置存储和配置验证

import { ConfigValidator } from './config-validator.js';
import { MonitorService } from './monitor-service.js';

export class ConfigManager {
  constructor() {
    this.providers = new Map();
    this.models = new Map();
    this.userConfig = null;
    this.validator = new ConfigValidator();
    this.initialized = false;
  }

  // 初始化配置管理器
  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.loadProviderConfigs();
      await this.loadUserConfig();
      this.initialized = true;
      
      MonitorService.logInfo('ConfigManager initialized successfully');
    } catch (error) {
      MonitorService.logError('ConfigManager initialization failed', error);
      throw new ConfigLoadError('Failed to initialize ConfigManager', error);
    }
  }

  // 加载提供商配置
  async loadProviderConfigs() {
    try {
      // 从本地配置文件加载（未来可扩展为远程加载）
      const { MODEL_PROVIDERS } = await import('../config/model-providers.js');
      
      this.providers = new Map(Object.entries(MODEL_PROVIDERS));
      
      // 构建模型映射
      this.buildModelMapping();
      
      MonitorService.logInfo('Provider configs loaded', {
        providerCount: this.providers.size,
        totalModels: this.models.size
      });
      
      return this.providers;
    } catch (error) {
      MonitorService.logError('Failed to load provider configs', error);
      throw new ConfigLoadError('Failed to load provider configurations', error);
    }
  }

  // 构建模型映射
  buildModelMapping() {
    this.models.clear();
    
    for (const [providerKey, provider] of this.providers) {
      for (const [modelKey, modelId] of Object.entries(provider.models)) {
        const fullKey = `${providerKey}:${modelKey}`;
        this.models.set(fullKey, {
          provider: providerKey,
          model: modelKey,
          modelId,
          providerName: provider.name,
          baseUrl: provider.baseUrl
        });
      }
    }
  }

  // 更新用户配置
  async updateUserConfig(config) {
    try {
      // 验证配置
      const validation = await this.validator.validateUserConfig(config);
      if (!validation.isValid) {
        throw new ConfigValidationError('Invalid configuration', validation.errors);
      }
      
      // 保存配置
      this.userConfig = {
        ...config,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      await this.saveUserConfig(this.userConfig);
      
      MonitorService.logInfo('User config updated', {
        provider: config.provider,
        model: config.model
      });
      
      return this.userConfig;
    } catch (error) {
      MonitorService.logError('Failed to update user config', error);
      throw error;
    }
  }

  // 获取提供商配置
  getProviderConfig(providerKey) {
    if (!this.initialized) {
      throw new ConfigNotInitializedError('ConfigManager not initialized');
    }
    
    const config = this.providers.get(providerKey);
    if (!config) {
      throw new ProviderNotFoundError(`Provider not found: ${providerKey}`);
    }
    
    return config;
  }

  // 获取模型列表
  getModels(providerKey) {
    const provider = this.getProviderConfig(providerKey);
    return Object.keys(provider.models);
  }

  // 获取所有提供商
  getProviders() {
    if (!this.initialized) {
      throw new ConfigNotInitializedError('ConfigManager not initialized');
    }
    
    return Array.from(this.providers.entries()).map(([key, config]) => ({
      key,
      name: config.name,
      baseUrl: config.baseUrl
    }));
  }

  // 获取用户配置
  getUserConfig() {
    return this.userConfig;
  }

  // 验证配置
  async validateConfig(config) {
    return await this.validator.validateUserConfig(config);
  }

  // 保存用户配置
  async saveUserConfig(config) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ aiConfig: config }, () => {
        if (chrome.runtime.lastError) {
          reject(new ConfigSaveError('Failed to save user config', chrome.runtime.lastError));
        } else {
          resolve(config);
        }
      });
    });
  }

  // 加载用户配置
  async loadUserConfig() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['aiConfig'], (result) => {
        if (chrome.runtime.lastError) {
          reject(new ConfigLoadError('Failed to load user config', chrome.runtime.lastError));
        } else {
          this.userConfig = result.aiConfig || null;
          resolve(this.userConfig);
        }
      });
    });
  }

  // 清除用户配置
  async clearUserConfig() {
    this.userConfig = null;
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(['aiConfig'], () => {
        if (chrome.runtime.lastError) {
          reject(new ConfigSaveError('Failed to clear user config', chrome.runtime.lastError));
        } else {
          resolve();
        }
      });
    });
  }

  // 获取配置统计
  getConfigStats() {
    return {
      providerCount: this.providers.size,
      modelCount: this.models.size,
      hasUserConfig: !!this.userConfig,
      initialized: this.initialized
    };
  }
}

// 错误类型定义
export class ConfigError extends Error {
  constructor(message, context) {
    super(message);
    this.name = 'ConfigError';
    this.context = context;
  }
}

export class ConfigLoadError extends ConfigError {
  constructor(message, context) {
    super(message, context);
    this.name = 'ConfigLoadError';
  }
}

export class ConfigSaveError extends ConfigError {
  constructor(message, context) {
    super(message, context);
    this.name = 'ConfigSaveError';
  }
}

export class ConfigValidationError extends ConfigError {
  constructor(message, context) {
    super(message, context);
    this.name = 'ConfigValidationError';
  }
}

export class ConfigNotInitializedError extends ConfigError {
  constructor(message, context) {
    super(message, context);
    this.name = 'ConfigNotInitializedError';
  }
}

export class ProviderNotFoundError extends ConfigError {
  constructor(message, context) {
    super(message, context);
    this.name = 'ProviderNotFoundError';
  }
}

// 导出单例实例
export const configManager = new ConfigManager();


