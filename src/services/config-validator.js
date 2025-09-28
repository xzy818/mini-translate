// 配置验证服务
// 负责验证用户配置、API Key 格式、提供商和模型的有效性

import { MODEL_PROVIDERS } from '../config/model-providers.js';

export class ConfigValidator {
  constructor() {
    this.apiKeyPatterns = {
      'openai': /^sk-[A-Za-z0-9]{48}$/,
      'anthropic': /^sk-ant-[A-Za-z0-9]{40}$/,
      'gemini': /^[A-Za-z0-9_-]{39}$/,
      'deepseek': /^sk-[A-Za-z0-9]{48}$/,
      'qwen': /^sk-[A-Za-z0-9]{32}$/
    };
    
    this.validProviders = Object.keys(MODEL_PROVIDERS);
  }

  // 验证提供商
  validateProvider(provider) {
    if (!provider || typeof provider !== 'string') {
      return { isValid: false, error: '提供商不能为空' };
    }
    
    if (!this.validProviders.includes(provider)) {
      return { 
        isValid: false, 
        error: `不支持的提供商: ${provider}。支持的提供商: ${this.validProviders.join(', ')}` 
      };
    }
    
    return { isValid: true };
  }

  // 验证模型
  validateModel(provider, model) {
    const providerValidation = this.validateProvider(provider);
    if (!providerValidation.isValid) {
      return providerValidation;
    }
    
    if (!model || typeof model !== 'string') {
      return { isValid: false, error: '模型不能为空' };
    }
    
    const providerConfig = MODEL_PROVIDERS[provider];
    if (!providerConfig) {
      return { isValid: false, error: `提供商配置不存在: ${provider}` };
    }
    
    if (!providerConfig.models || !providerConfig.models.hasOwnProperty(model)) {
      const availableModels = Object.keys(providerConfig.models || {});
      return { 
        isValid: false, 
        error: `模型不存在: ${model}。可用模型: ${availableModels.join(', ')}` 
      };
    }
    
    return { isValid: true };
  }

  // 验证 API Key
  validateAPIKey(apiKey, provider) {
    if (!apiKey || typeof apiKey !== 'string') {
      return { isValid: false, error: 'API Key 不能为空' };
    }
    
    if (apiKey.trim().length === 0) {
      return { isValid: false, error: 'API Key 不能为空' };
    }
    
    // 验证提供商
    const providerValidation = this.validateProvider(provider);
    if (!providerValidation.isValid) {
      return providerValidation;
    }
    
    // 验证格式
    const pattern = this.apiKeyPatterns[provider];
    if (!pattern) {
      return { isValid: false, error: `不支持的提供商: ${provider}` };
    }
    
    if (!pattern.test(apiKey.trim())) {
      return { 
        isValid: false, 
        error: this.getAPIKeyFormatError(provider) 
      };
    }
    
    return { isValid: true };
  }

  // 获取 API Key 格式错误信息
  getAPIKeyFormatError(provider) {
    const formatHints = {
      'openai': 'OpenAI API Key 格式: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'anthropic': 'Anthropic API Key 格式: sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'gemini': 'Google Gemini API Key 格式: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'deepseek': 'DeepSeek API Key 格式: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'qwen': 'Qwen API Key 格式: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    };
    
    return `API Key 格式不正确。${formatHints[provider] || '请检查 API Key 格式'}`;
  }

  // 验证完整用户配置
  async validateUserConfig(config) {
    const errors = [];
    const warnings = [];
    
    // 验证必需字段
    if (!config) {
      return { isValid: false, errors: ['配置不能为空'] };
    }
    
    // 验证提供商
    const providerValidation = this.validateProvider(config.provider);
    if (!providerValidation.isValid) {
      errors.push(providerValidation.error);
    }
    
    // 验证模型
    const modelValidation = this.validateModel(config.provider, config.model);
    if (!modelValidation.isValid) {
      errors.push(modelValidation.error);
    }
    
    // 验证 API Key
    const apiKeyValidation = this.validateAPIKey(config.apiKey, config.provider);
    if (!apiKeyValidation.isValid) {
      errors.push(apiKeyValidation.error);
    }
    
    // 验证时间戳
    if (config.timestamp && typeof config.timestamp !== 'number') {
      warnings.push('时间戳格式不正确');
    }
    
    // 验证版本
    if (config.version && typeof config.version !== 'string') {
      warnings.push('版本格式不正确');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // 验证配置一致性
  validateConfigConsistency(config) {
    const issues = [];
    
    // 检查提供商和模型的匹配
    if (config.provider && config.model) {
      const providerConfig = MODEL_PROVIDERS[config.provider];
      if (providerConfig && !providerConfig.models[config.model]) {
        issues.push(`模型 ${config.model} 不属于提供商 ${config.provider}`);
      }
    }
    
    // 检查 API Key 和提供商的匹配
    if (config.apiKey && config.provider) {
      const apiKeyValidation = this.validateAPIKey(config.apiKey, config.provider);
      if (!apiKeyValidation.isValid) {
        issues.push(apiKeyValidation.error);
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  // 获取提供商信息
  getProviderInfo(provider) {
    const providerConfig = MODEL_PROVIDERS[provider];
    if (!providerConfig) {
      return null;
    }
    
    return {
      name: providerConfig.name,
      baseUrl: providerConfig.baseUrl,
      modelCount: Object.keys(providerConfig.models).length,
      supportedModels: Object.keys(providerConfig.models)
    };
  }

  // 获取模型信息
  getModelInfo(provider, model) {
    const providerConfig = MODEL_PROVIDERS[provider];
    if (!providerConfig || !providerConfig.models[model]) {
      return null;
    }
    
    return {
      provider,
      model,
      modelId: providerConfig.models[model],
      providerName: providerConfig.name,
      baseUrl: providerConfig.baseUrl
    };
  }

  // 验证配置完整性
  validateConfigCompleteness(config) {
    const requiredFields = ['provider', 'model', 'apiKey'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      return {
        isValid: false,
        error: `缺少必需字段: ${missingFields.join(', ')}`
      };
    }
    
    return { isValid: true };
  }

  // 获取验证规则
  getValidationRules() {
    return {
      providers: this.validProviders,
      apiKeyPatterns: this.apiKeyPatterns,
      requiredFields: ['provider', 'model', 'apiKey']
    };
  }
}

// 导出单例实例
export const configValidator = new ConfigValidator();
