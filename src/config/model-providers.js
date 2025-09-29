// 支持的模型服务商配置
// 硬编码所有支持的 API 端点，避免 CORS 拦截

export const MODEL_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    models: {
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini',
      'gpt-4-turbo': 'gpt-4-turbo',
      'gpt-4': 'gpt-4',
      'gpt-3.5-turbo': 'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k': 'gpt-3.5-turbo-16k'
    },
    endpoints: {
      chat: '/v1/chat/completions',
      completions: '/v1/completions'
    },
    headers: {
      'Authorization': 'Bearer {apiKey}',
      'Content-Type': 'application/json'
    }
  },
  
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: {
      'claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022': 'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229': 'claude-3-opus-20240229',
      'claude-3-sonnet-20240229': 'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307': 'claude-3-haiku-20240307'
    },
    endpoints: {
      chat: '/v1/messages'
    },
    headers: {
      'x-api-key': '{apiKey}',
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    }
  },
  
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: {
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-1.5-flash-8b': 'gemini-1.5-flash-8b',
      'gemini-1.0-pro': 'gemini-1.0-pro',
      'gemini-pro': 'gemini-pro'
    },
    endpoints: {
      chat: '/v1beta/models/{model}:generateContent'
    },
    headers: {
      'Authorization': 'Bearer {apiKey}',
      'Content-Type': 'application/json'
    }
  },
  
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: {
      'deepseek-chat': 'deepseek-chat',
      'deepseek-coder': 'deepseek-coder',
      'deepseek-chat-32k': 'deepseek-chat-32k',
      'deepseek-coder-33b-instruct': 'deepseek-coder-33b-instruct'
    },
    endpoints: {
      chat: '/v1/chat/completions'
    },
    headers: {
      'Authorization': 'Bearer {apiKey}',
      'Content-Type': 'application/json'
    }
  },
  
  qwen: {
    name: 'Qwen (通义千问)',
    baseUrl: 'https://dashscope.aliyuncs.com',
    models: {
      'qwen-turbo': 'qwen-turbo',
      'qwen-plus': 'qwen-plus',
      'qwen-max': 'qwen-max',
      'qwen-long': 'qwen-long',
      // 机器翻译（MT）特例：走兼容模式 Chat Completions 协议
      'qwen-mt-turbo': 'qwen-mt-turbo',
      'qwen-2.5-72b-instruct': 'qwen-2.5-72b-instruct',
      'qwen-2.5-32b-instruct': 'qwen-2.5-32b-instruct'
    },
    endpoints: {
      // 对于常规模型（非 MT）：使用 AIGC 文本生成端点
      chat: '/api/v1/services/aigc/text-generation/generation'
    },
    headers: {
      'Authorization': 'Bearer {apiKey}',
      'Content-Type': 'application/json'
    }
  }
};

// 获取所有支持的域名（用于 manifest.json 权限配置）
export const getAllowedDomains = () => {
  return Object.values(MODEL_PROVIDERS).map(provider => provider.baseUrl);
};

// 获取所有支持的模型列表
export const getAllSupportedModels = () => {
  const allModels = {};
  Object.entries(MODEL_PROVIDERS).forEach(([providerKey, provider]) => {
    Object.entries(provider.models).forEach(([key, value]) => {
      allModels[`${providerKey}:${key}`] = {
        provider: providerKey,
        model: value,
        name: `${provider.name} - ${key}`
      };
    });
  });
  return allModels;
};

// 根据提供商和模型获取配置
export const getProviderConfig = (providerKey, modelKey) => {
  const provider = MODEL_PROVIDERS[providerKey];
  if (!provider) return null;
  
  const model = provider.models[modelKey];
  if (!model) return null;
  
  return {
    ...provider,
    selectedModel: model,
    modelKey
  };
};
