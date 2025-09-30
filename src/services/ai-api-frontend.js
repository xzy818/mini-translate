// 前端 AI API 调用封装
// 通过消息传递调用 Service Worker 中的 AI API 服务

export class AIApiFrontend {
  constructor() {
    this.requestId = 0;
  }

  // 调用 AI API
  async callAPI({ provider, model, messages, apiKey, options = {} }) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      
      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error('AI API request timeout'));
      }, 30000); // 30秒超时

      // 监听响应
      const handleResponse = (response) => {
        if (response.requestId === requestId) {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(handleResponse);
          
          if (response.ok) {
            resolve(response.result);
          } else {
            reject(new Error(response.error));
          }
        }
      };

      chrome.runtime.onMessage.addListener(handleResponse);

      // 发送请求
      chrome.runtime.sendMessage({
        type: 'AI_API_CALL',
        payload: {
          provider,
          model,
          messages,
          apiKey,
          options,
          requestId
        }
      });
    });
  }

  // 获取支持的提供商
  async getProviders() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_AI_PROVIDERS' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.ok) {
          resolve(response.providers);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  // 获取提供商的模型列表
  async getProviderModels(provider) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'GET_PROVIDER_MODELS',
        payload: { provider }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.ok) {
          resolve(response.models);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  // 翻译文本（使用 AI API）
  async translateText(text, { provider, model, apiKey, options = {} }) {
    const messages = [
      {
        role: 'system',
        content: 'You are a professional translator. Translate the given text accurately while maintaining the original meaning and context.'
      },
      {
        role: 'user',
        content: `Please translate the following text: "${text}"`
      }
    ];

    try {
      const result = await this.callAPI({
        provider,
        model,
        messages,
        apiKey,
        options
      });

      return {
        originalText: text,
        translatedText: result.text,
        provider,
        model,
        usage: result.usage
      };
    } catch (error) {
      console.error('[AI API Frontend] Translation failed:', error);
      throw error;
    }
  }

  // 批量翻译
  async translateBatch(texts, { provider, model, apiKey, options = {} }) {
    const results = [];
    
    for (const text of texts) {
      try {
        const result = await this.translateText(text, { provider, model, apiKey, options });
        results.push(result);
        
        // 添加延迟避免速率限制
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          originalText: text,
          translatedText: '',
          error: error.message,
          provider,
          model
        });
      }
    }
    
    return results;
  }
}

// 导出单例实例
export const aiApiFrontend = new AIApiFrontend();


