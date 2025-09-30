// 统一的 AI API 调用服务
// 通过 Service Worker 发起请求，避免 CORS 限制

import { MODEL_PROVIDERS, getProviderConfig } from '../config/model-providers.js';

export class AIApiClient {
  constructor() {
    this.requestQueue = new Map();
    this.rateLimits = new Map();
  }

  // 统一的 API 调用方法
  async callAPI({ provider, model, messages, apiKey, options = {} }) {
    const config = getProviderConfig(provider, model);
    if (!config) {
      throw new Error(`Unsupported provider/model: ${provider}/${model}`);
    }

    const requestId = this.generateRequestId();
    const url = this.buildUrl(config);
    const headers = this.buildHeaders(config, apiKey);
    const body = this.buildRequestBody(config, messages, options);

    try {
      // 检查速率限制
      await this.checkRateLimit(provider);
      
      // 发起请求
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options.signal
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      // 处理响应
      const result = await this.processResponse(response, config);
      
      // 更新速率限制
      this.updateRateLimit(provider);
      
      return result;
    } catch (error) {
      console.error(`[AI API] Request failed for ${provider}/${model}:`, error);
      throw error;
    }
  }

  // 构建请求 URL
  buildUrl(config) {
    const { baseUrl, endpoints } = config;
    const endpoint = endpoints.chat;
    
    // 处理 Gemini 的模型参数
    if (config.name === 'Google Gemini') {
      return `${baseUrl}${endpoint.replace('{model}', config.selectedModel)}`;
    }
    
    return `${baseUrl}${endpoint}`;
  }

  // 构建请求头
  buildHeaders(config, apiKey) {
    const headers = { ...config.headers };
    
    // 替换 API Key
    Object.keys(headers).forEach(key => {
      if (typeof headers[key] === 'string') {
        headers[key] = headers[key].replace('{apiKey}', apiKey);
      }
    });
    
    return headers;
  }

  // 构建请求体
  buildRequestBody(config, messages, options) {
    const { name } = config;
    
    switch (name) {
      case 'OpenAI':
      case 'DeepSeek':
        return {
          model: config.selectedModel,
          messages: this.formatMessages(messages),
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1000
        };
        
      case 'Anthropic':
        return {
          model: config.selectedModel,
          max_tokens: options.maxTokens || 1000,
          messages: this.formatMessages(messages)
        };
        
      case 'Google Gemini':
        return {
          contents: this.formatGeminiMessages(messages),
          generationConfig: {
            temperature: options.temperature || 0.7,
            maxOutputTokens: options.maxTokens || 1000
          }
        };
        
      case 'Qwen (通义千问)':
        return {
          model: config.selectedModel,
          input: {
            messages: this.formatMessages(messages)
          },
          parameters: {
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 1000
          }
        };
        
      default:
        throw new Error(`Unsupported provider: ${name}`);
    }
  }

  // 格式化消息为通用格式
  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  // 格式化 Gemini 消息
  formatGeminiMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }

  // 处理响应
  async processResponse(response, config) {
    const { name } = config;
    const data = await response.json();
    
    switch (name) {
      case 'OpenAI':
      case 'DeepSeek':
        return {
          text: data.choices[0]?.message?.content || '',
          usage: data.usage,
          model: data.model
        };
        
      case 'Anthropic':
        return {
          text: data.content[0]?.text || '',
          usage: data.usage,
          model: data.model
        };
        
      case 'Google Gemini':
        return {
          text: data.candidates[0]?.content?.parts[0]?.text || '',
          usage: data.usageMetadata,
          model: data.model
        };
        
      case 'Qwen (通义千问)':
        return {
          text: data.output?.text || '',
          usage: data.usage,
          model: data.model
        };
        
      default:
        throw new Error(`Unsupported provider: ${name}`);
    }
  }

  // 检查速率限制
  async checkRateLimit(provider) {
    const now = Date.now();
    const limit = this.rateLimits.get(provider);
    
    if (limit && now - limit.lastRequest < 1000) { // 1秒限制
      const waitTime = 1000 - (now - limit.lastRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // 更新速率限制
  updateRateLimit(provider) {
    this.rateLimits.set(provider, {
      lastRequest: Date.now(),
      requestCount: (this.rateLimits.get(provider)?.requestCount || 0) + 1
    });
  }

  // 生成请求 ID
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // 获取支持的提供商列表
  getSupportedProviders() {
    return Object.keys(MODEL_PROVIDERS).map(key => ({
      key,
      name: MODEL_PROVIDERS[key].name,
      baseUrl: MODEL_PROVIDERS[key].baseUrl
    }));
  }

  // 获取提供商支持的模型
  getProviderModels(providerKey) {
    const provider = MODEL_PROVIDERS[providerKey];
    if (!provider) return [];
    
    return Object.keys(provider.models).map(key => ({
      key,
      name: key,
      model: provider.models[key]
    }));
  }
}

// 导出单例实例
export const aiApiClient = new AIApiClient();
