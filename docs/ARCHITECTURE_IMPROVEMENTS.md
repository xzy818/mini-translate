# AI 配置架构改进设计文档

## 1. 需求概述

### 1.1 背景
当前 AI 配置系统存在以下问题：
- 配置硬编码，缺乏灵活性
- 错误处理不够细化
- 缺乏监控和日志能力
- 配置验证机制不完善

### 1.2 改进目标
- 实现动态配置管理
- 完善错误处理机制
- 添加监控和日志功能
- 提升系统健壮性和可维护性

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Configuration System                    │
├─────────────────────────────────────────────────────────────┤
│  Presentation Layer                                         │
│  ├── AI Config UI (ai-config.html/js)                       │
│  ├── Provider Selection                                     │
│  ├── Model Selection                                        │
│  └── API Key Management                                     │
├─────────────────────────────────────────────────────────────┤
│  Business Logic Layer                                       │
│  ├── ConfigManager (配置管理)                               │
│  ├── ProviderManager (提供商管理)                           │
│  ├── ModelManager (模型管理)                                │
│  └── ValidationService (验证服务)                           │
├─────────────────────────────────────────────────────────────┤
│  Service Layer                                              │
│  ├── AIApiClient (API 调用)                                │
│  ├── RequestQueue (请求队列)                                │
│  ├── ErrorHandler (错误处理)                                │
│  └── MonitorService (监控服务)                              │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                 │
│  ├── ConfigStorage (配置存储)                               │
│  ├── ProviderConfigs (提供商配置)                           │
│  └── UserSettings (用户设置)                                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件设计

#### 2.2.1 配置管理服务 (ConfigManager)

```javascript
export class ConfigManager {
  constructor() {
    this.providers = new Map();
    this.models = new Map();
    this.userConfig = null;
    this.validator = new ConfigValidator();
  }

  // 加载提供商配置
  async loadProviderConfigs() {
    try {
      const configs = await this.fetchProviderConfigs();
      this.providers = new Map(Object.entries(configs));
      return this.providers;
    } catch (error) {
      throw new ConfigLoadError('Failed to load provider configs', error);
    }
  }

  // 更新用户配置
  async updateUserConfig(config) {
    const validation = await this.validator.validateUserConfig(config);
    if (!validation.isValid) {
      throw new ConfigValidationError('Invalid configuration', validation.errors);
    }
    
    this.userConfig = config;
    await this.saveUserConfig(config);
    return config;
  }

  // 获取提供商配置
  getProviderConfig(providerKey) {
    return this.providers.get(providerKey);
  }

  // 获取模型列表
  getModels(providerKey) {
    const provider = this.getProviderConfig(providerKey);
    return provider ? Object.keys(provider.models) : [];
  }
}
```

#### 2.2.2 错误处理服务 (ErrorHandler)

```javascript
export class AIErrorHandler {
  static handleError(error, context) {
    const { provider, model, requestId } = context;
    
    // 记录错误日志
    MonitorService.logError(provider, model, error);
    
    // 根据错误类型返回具体错误
    if (error.status === 401) {
      return new APIKeyError('API Key 无效或已过期', {
        provider,
        model,
        requestId,
        suggestion: '请检查 API Key 是否正确'
      });
    } else if (error.status === 429) {
      return new RateLimitError('请求过于频繁，请稍后重试', {
        provider,
        model,
        requestId,
        retryAfter: error.headers['retry-after']
      });
    } else if (error.status === 503) {
      return new ServiceUnavailableError('服务暂时不可用', {
        provider,
        model,
        requestId,
        suggestion: '请稍后重试或联系服务商'
      });
    } else if (error.code === 'NETWORK_ERROR') {
      return new NetworkError('网络连接失败', {
        provider,
        model,
        requestId,
        suggestion: '请检查网络连接'
      });
    }
    
    return new GenericAIError('未知错误', {
      provider,
      model,
      requestId,
      originalError: error.message
    });
  }

  // 错误重试机制
  static async retryRequest(requestFn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await requestFn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        const retryDelay = delay * Math.pow(2, i); // 指数退避
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}
```

#### 2.2.3 请求队列管理 (RequestQueue)

```javascript
export class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.rateLimits = new Map();
    this.requestHistory = new Map();
  }

  // 添加请求到队列
  async addRequest(request) {
    const requestId = this.generateRequestId();
    const queuedRequest = {
      id: requestId,
      ...request,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    this.queue.push(queuedRequest);
    this.scheduleProcessing();
    
    return requestId;
  }

  // 处理队列
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      
      try {
        // 检查速率限制
        await this.checkRateLimit(request.provider);
        
        // 执行请求
        const result = await this.executeRequest(request);
        
        // 记录成功
        this.recordSuccess(request, result);
        
      } catch (error) {
        // 处理错误
        await this.handleRequestError(request, error);
      }
    }
    
    this.processing = false;
  }

  // 检查速率限制
  async checkRateLimit(provider) {
    const limit = this.rateLimits.get(provider);
    const now = Date.now();
    
    if (limit && now - limit.lastRequest < 1000) {
      const waitTime = 1000 - (now - limit.lastRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // 执行请求
  async executeRequest(request) {
    const { provider, model, messages, apiKey, options } = request;
    
    return await aiApiClient.callAPI({
      provider,
      model,
      messages,
      apiKey,
      options
    });
  }
}
```

#### 2.2.4 监控服务 (MonitorService)

```javascript
export class MonitorService {
  static logRequest(provider, model, duration, success, tokens) {
    const logEntry = {
      timestamp: Date.now(),
      provider,
      model,
      duration,
      success,
      tokens,
      type: 'request'
    };
    
    console.log('[AI Monitor]', logEntry);
    this.storeLogEntry(logEntry);
  }

  static logError(provider, model, error) {
    const logEntry = {
      timestamp: Date.now(),
      provider,
      model,
      error: error.message,
      status: error.status,
      type: 'error'
    };
    
    console.error('[AI Monitor]', logEntry);
    this.storeLogEntry(logEntry);
  }

  static trackUsage(provider, model, tokens) {
    const usage = {
      timestamp: Date.now(),
      provider,
      model,
      tokens,
      type: 'usage'
    };
    
    this.storeUsageEntry(usage);
  }

  static getMetrics(provider, timeRange = '24h') {
    // 获取性能指标
    return this.calculateMetrics(provider, timeRange);
  }

  static storeLogEntry(entry) {
    // 存储日志条目
    chrome.storage.local.get(['aiLogs'], (result) => {
      const logs = result.aiLogs || [];
      logs.push(entry);
      
      // 保持最近 1000 条日志
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000);
      }
      
      chrome.storage.local.set({ aiLogs: logs });
    });
  }
}
```

#### 2.2.5 配置验证服务 (ConfigValidator)

```javascript
export class ConfigValidator {
  static validateProvider(provider) {
    const validProviders = ['openai', 'anthropic', 'gemini', 'deepseek', 'qwen'];
    return validProviders.includes(provider);
  }

  static validateModel(provider, model) {
    const providerConfig = MODEL_PROVIDERS[provider];
    return providerConfig?.models?.hasOwnProperty(model);
  }

  static validateAPIKey(apiKey, provider) {
    if (!apiKey || typeof apiKey !== 'string') {
      return { isValid: false, error: 'API Key 不能为空' };
    }

    const patterns = {
      'openai': /^sk-[A-Za-z0-9]{48}$/,
      'anthropic': /^sk-ant-[A-Za-z0-9]{40}$/,
      'gemini': /^[A-Za-z0-9_-]{39}$/,
      'deepseek': /^sk-[A-Za-z0-9]{48}$/,
      'qwen': /^sk-[A-Za-z0-9]{32}$/
    };

    const pattern = patterns[provider];
    if (!pattern) {
      return { isValid: false, error: '不支持的提供商' };
    }

    if (!pattern.test(apiKey)) {
      return { isValid: false, error: 'API Key 格式不正确' };
    }

    return { isValid: true };
  }

  static async validateUserConfig(config) {
    const errors = [];

    // 验证提供商
    if (!this.validateProvider(config.provider)) {
      errors.push('无效的提供商');
    }

    // 验证模型
    if (!this.validateModel(config.provider, config.model)) {
      errors.push('无效的模型');
    }

    // 验证 API Key
    const apiKeyValidation = this.validateAPIKey(config.apiKey, config.provider);
    if (!apiKeyValidation.isValid) {
      errors.push(apiKeyValidation.error);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

## 3. 实现计划

### 3.1 阶段 1: 核心服务实现 (1-2 周)
- [ ] 实现 ConfigManager 配置管理服务
- [ ] 实现 ErrorHandler 错误处理服务
- [ ] 实现 ConfigValidator 配置验证服务
- [ ] 更新现有代码集成新服务

### 3.2 阶段 2: 高级功能实现 (2-3 周)
- [ ] 实现 RequestQueue 请求队列管理
- [ ] 实现 MonitorService 监控服务
- [ ] 添加性能指标收集
- [ ] 实现错误重试机制

### 3.3 阶段 3: 优化和测试 (1-2 周)
- [ ] 性能优化和测试
- [ ] 用户体验优化
- [ ] 文档完善
- [ ] 集成测试

## 4. 技术规范

### 4.1 错误类型定义
```javascript
export class AIError extends Error {
  constructor(message, context) {
    super(message);
    this.name = 'AIError';
    this.context = context;
  }
}

export class APIKeyError extends AIError {
  constructor(message, context) {
    super(message, context);
    this.name = 'APIKeyError';
  }
}

export class RateLimitError extends AIError {
  constructor(message, context) {
    super(message, context);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends AIError {
  constructor(message, context) {
    super(message, context);
    this.name = 'ServiceUnavailableError';
  }
}

export class NetworkError extends AIError {
  constructor(message, context) {
    super(message, context);
    this.name = 'NetworkError';
  }
}

export class ConfigValidationError extends AIError {
  constructor(message, context) {
    super(message, context);
    this.name = 'ConfigValidationError';
  }
}
```

### 4.2 配置存储结构
```javascript
// 用户配置存储结构
const userConfig = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: 'sk-...',
  providerName: 'OpenAI',
  modelName: 'GPT-4o Mini',
  timestamp: Date.now(),
  version: '1.0'
};

// 提供商配置存储结构
const providerConfig = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    models: { /* ... */ },
    endpoints: { /* ... */ },
    headers: { /* ... */ },
    rateLimit: { requests: 1, window: 1000 },
    retryPolicy: { maxRetries: 3, backoff: 'exponential' }
  }
};
```

## 5. 测试策略

### 5.1 单元测试
- ConfigManager 配置管理测试
- ErrorHandler 错误处理测试
- ConfigValidator 验证服务测试
- RequestQueue 队列管理测试

### 5.2 集成测试
- 端到端配置流程测试
- 多提供商切换测试
- 错误恢复测试
- 性能压力测试

### 5.3 用户验收测试
- 配置界面用户体验测试
- 错误提示友好性测试
- 性能指标监控测试

## 6. 风险评估

### 6.1 技术风险
- **配置迁移风险**: 现有用户配置需要平滑迁移
- **性能影响**: 新增服务可能影响响应速度
- **兼容性风险**: 新架构可能与现有代码不兼容

### 6.2 缓解措施
- 实现配置版本管理和迁移机制
- 性能监控和优化
- 渐进式部署和回滚机制

## 7. 成功标准

### 7.1 功能标准
- [ ] 支持动态配置管理
- [ ] 完善的错误处理和用户提示
- [ ] 实时监控和日志记录
- [ ] 配置验证和一致性检查

### 7.2 性能标准
- [ ] 配置加载时间 < 500ms
- [ ] API 调用成功率 > 99%
- [ ] 错误恢复时间 < 5s
- [ ] 内存使用增长 < 20%

### 7.3 用户体验标准
- [ ] 配置流程简化 50%
- [ ] 错误提示友好性提升
- [ ] 系统稳定性提升
- [ ] 用户满意度 > 90%
