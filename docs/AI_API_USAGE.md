# AI API 使用指南

## 概述

本插件支持多个 AI 服务商的 API 调用，通过 Service Worker 避免 CORS 限制。

## 支持的提供商

### 1. OpenAI
- **域名**: api.openai.com
- **模型**: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
- **认证**: Bearer Token

### 2. Anthropic
- **域名**: api.anthropic.com
- **模型**: claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus
- **认证**: x-api-key

### 3. Google Gemini
- **域名**: generativelanguage.googleapis.com
- **模型**: gemini-1.5-pro, gemini-1.5-flash, gemini-1.0-pro
- **认证**: Bearer Token

### 4. DeepSeek
- **域名**: api.deepseek.com
- **模型**: deepseek-chat, deepseek-coder
- **认证**: Bearer Token

### 5. Qwen (通义千问)
- **域名**: dashscope.aliyuncs.com
- **模型**: qwen-turbo, qwen-plus, qwen-max
- **认证**: Bearer Token

## 使用方法

### 1. 在 Content Script 中使用

```javascript
import { aiApiFrontend } from './services/ai-api-frontend.js';

// 翻译文本
const result = await aiApiFrontend.translateText('Hello World', {
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: 'your-api-key',
  options: {
    temperature: 0.7,
    maxTokens: 1000
  }
});

console.log(result.translatedText);
```

### 2. 在 Options 页面中使用

```javascript
import { aiApiFrontend } from './services/ai-api-frontend.js';

// 获取支持的提供商
const providers = await aiApiFrontend.getProviders();
console.log(providers);

// 获取提供商的模型
const models = await aiApiFrontend.getProviderModels('openai');
console.log(models);
```

### 3. 批量翻译

```javascript
const texts = ['Hello', 'World', 'Test'];
const results = await aiApiFrontend.translateBatch(texts, {
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: 'your-api-key'
});

results.forEach(result => {
  console.log(`${result.originalText} -> ${result.translatedText}`);
});
```

## 配置说明

### 权限配置

在 `manifest.json` 中已预置所有支持的域名权限：

```json
{
  "host_permissions": [
    "https://api.openai.com/*",
    "https://api.anthropic.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://api.deepseek.com/*",
    "https://dashscope.aliyuncs.com/*"
  ]
}
```

### 环境变量

- **API Key**: 存储在 `chrome.storage.local` 中
- **Provider**: 用户选择的 AI 服务商
- **Model**: 用户选择的模型

## 错误处理

### 常见错误

1. **API Key 无效**: 检查 API Key 是否正确
2. **模型不支持**: 检查选择的模型是否在支持列表中
3. **网络错误**: 检查网络连接和域名权限
4. **速率限制**: 实现重试机制和延迟

### 错误处理示例

```javascript
try {
  const result = await aiApiFrontend.translateText(text, config);
  return result;
} catch (error) {
  if (error.message.includes('401')) {
    throw new Error('API Key 无效，请检查配置');
  } else if (error.message.includes('429')) {
    throw new Error('请求过于频繁，请稍后重试');
  } else {
    throw new Error(`翻译失败: ${error.message}`);
  }
}
```

## 性能优化

### 1. 速率限制
- 每个提供商每秒最多 1 个请求
- 批量翻译时自动添加延迟

### 2. 缓存机制
- 相同文本的翻译结果可以缓存
- 避免重复 API 调用

### 3. 超时处理
- 默认 30 秒超时
- 可配置超时时间

## 安全考虑

### 1. API Key 保护
- 不在日志中输出 API Key
- 使用 `chrome.storage.local` 存储
- 支持会话级别的临时存储

### 2. 数据隐私
- 不记录用户输入内容
- 不向第三方发送用户数据
- 本地处理所有翻译请求

## 扩展开发

### 添加新的提供商

1. 在 `src/config/model-providers.js` 中添加配置
2. 在 `manifest.json` 中添加域名权限
3. 实现对应的请求格式处理

### 示例：添加新的提供商

```javascript
// 在 model-providers.js 中添加
newProvider: {
  name: 'New Provider',
  baseUrl: 'https://api.newprovider.com',
  models: {
    'model-1': 'model-1',
    'model-2': 'model-2'
  },
  endpoints: {
    chat: '/v1/chat'
  },
  headers: {
    'Authorization': 'Bearer {apiKey}',
    'Content-Type': 'application/json'
  }
}
```

## 测试

### 单元测试
- 测试各个提供商的 API 调用
- 测试错误处理机制
- 测试速率限制

### 集成测试
- 测试完整的翻译流程
- 测试不同提供商的切换
- 测试批量翻译功能
