/**
 * 翻译服务抽象层
 * 支持多种翻译模型：DeepSeek V3、Qwen MT Turbo、Qwen MT Plus、gpt-4o-mini
 */

// 支持的模型类型
export const SUPPORTED_MODELS = {
  DEEPSEEK_V3: 'deepseek-v3',
  QWEN_MT_TURBO: 'qwen-mt-turbo',
  QWEN_MT_PLUS: 'qwen-mt-plus',
  GPT_4O_MINI: 'gpt-4o-mini'
};

// 默认超时时间（毫秒）
const DEFAULT_TIMEOUT = 10000;

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelay: 1000, // 基础延迟1秒
  maxDelay: 5000   // 最大延迟5秒
};

/**
 * 翻译错误类型
 */
export const TRANSLATION_ERRORS = {
  INVALID_CONFIG: 'INVALID_CONFIG',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  INSUFFICIENT_QUOTA: 'INSUFFICIENT_QUOTA',
  UNKNOWN: 'UNKNOWN'
};

/**
 * 创建翻译错误对象
 */
function createTranslationError(type, message, originalError = null) {
  const error = new Error(message);
  error.type = type;
  error.originalError = originalError;
  error.timestamp = new Date().toISOString();
  return error;
}

/**
 * 指数退避延迟计算
 */
function calculateDelay(attempt, baseDelay, maxDelay) {
  const delay = baseDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检测是否在Chrome扩展环境中
 */
function isChromeExtension() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
}

/**
 * Chrome扩展专用的网络请求函数
 * 使用Chrome扩展消息传递机制绕过Service Worker限制
 */
async function chromeExtensionFetch(url, options) {
  return new Promise((resolve, reject) => {
    console.log('🔍 Chrome扩展专用fetch请求:', { url, options });
    
    // 创建一个唯一的消息ID
    const messageId = `fetch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 设置超时处理
    const timeout = setTimeout(() => {
      reject(new Error('Chrome extension fetch timeout'));
    }, options.timeout || 30000);
    
    // 监听响应消息
    const messageListener = (message, sender, sendResponse) => {
      if (message.type === 'FETCH_RESPONSE' && message.messageId === messageId) {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(messageListener);
        
        if (message.success) {
          // 创建一个模拟的Response对象
          const mockResponse = {
            ok: message.data.ok,
            status: message.data.status,
            statusText: message.data.statusText,
            headers: new Map(Object.entries(message.data.headers || {})),
            json: () => Promise.resolve(message.data.json),
            text: () => Promise.resolve(message.data.text)
          };
          resolve(mockResponse);
        } else {
          reject(new Error(message.error));
        }
      }
    };
    
    // 添加消息监听器
    chrome.runtime.onMessage.addListener(messageListener);
    
    // 发送fetch请求消息到content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length === 0) {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(messageListener);
        reject(new Error('No active tab found'));
        return;
      }
      
      const tabId = tabs[0].id;
      
      // 发送消息到content script执行fetch
      chrome.tabs.sendMessage(tabId, {
        type: 'EXECUTE_FETCH',
        messageId: messageId,
        url: url,
        options: options
      }, (response) => {
        if (chrome.runtime.lastError) {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(messageListener);
          reject(new Error(chrome.runtime.lastError.message));
        }
      });
    });
  });
}

/**
 * 带超时的 fetch 请求
 * 针对Chrome扩展环境进行优化
 */
async function fetchWithTimeout(url, options, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // 检测环境并调整请求选项
    const isExtension = isChromeExtension();
    console.log('🔍 环境检测:', { isExtension, url });
    
    const fetchOptions = {
      ...options,
      signal: controller.signal
    };
    
    // 在Chrome扩展环境中添加特定选项
    if (isExtension) {
      fetchOptions.mode = 'cors';
      fetchOptions.credentials = 'omit';
      fetchOptions.cache = 'no-cache';
    }
    
    console.log('🔍 发送fetch请求:', { url, options: fetchOptions });
    
    let response;
    
    // 在Chrome扩展环境中使用专用fetch函数
    if (isExtension) {
      console.log('🔍 使用Chrome扩展专用fetch');
      response = await chromeExtensionFetch(url, fetchOptions);
    } else {
      console.log('🔍 使用标准fetch');
      response = await fetch(url, fetchOptions);
    }
    
    clearTimeout(timeoutId);
    
    console.log('🔍 fetch响应:', { 
      status: response.status, 
      statusText: response.statusText
    });
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    console.log('❌ fetch请求失败:', { 
      name: error.name, 
      message: error.message, 
      stack: error.stack 
    });
    
    if (error.name === 'AbortError') {
      throw createTranslationError(TRANSLATION_ERRORS.TIMEOUT, `请求超时 (${timeout}ms)`);
    }
    
    // 针对Chrome扩展环境的特殊错误处理
    if (error.message.includes('Failed to fetch')) {
      const isExtension = isChromeExtension();
      if (isExtension) {
        throw createTranslationError(TRANSLATION_ERRORS.NETWORK_ERROR, `Chrome扩展网络请求失败，请检查扩展权限和网络连接`, error);
      } else {
        throw createTranslationError(TRANSLATION_ERRORS.NETWORK_ERROR, `网络连接失败，请检查网络连接和API配置`, error);
      }
    }
    
    throw createTranslationError(TRANSLATION_ERRORS.NETWORK_ERROR, `网络错误: ${error.message}`, error);
  }
}

/**
 * DeepSeek V3 翻译实现
 */
async function translateWithDeepSeek(text, apiKey, apiBaseUrl) {
  // 处理API Base URL，如果已经包含路径则直接使用，否则添加默认路径
  const baseUrl = apiBaseUrl.endsWith('/v1') ? apiBaseUrl : `${apiBaseUrl}/v1`;
  const url = `${baseUrl}/chat/completions`;
  const payload = {
    model: SUPPORTED_MODELS.DEEPSEEK_V3,
    messages: [
      {
        role: 'system',
        content: '你是一个专业的翻译助手。请将用户提供的文本翻译成中文，只返回翻译结果，不要添加任何解释或其他内容。'
      },
      {
        role: 'user',
        content: text
      }
    ],
    temperature: 0.3,
    max_tokens: 1000
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw createTranslationError(
      TRANSLATION_ERRORS.API_ERROR,
      `DeepSeek API 错误 (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw createTranslationError(TRANSLATION_ERRORS.API_ERROR, 'DeepSeek API 响应格式错误');
  }

  return data.choices[0].message.content.trim();
}

/**
 * Qwen MT 翻译实现
 */
async function translateWithQwen(text, apiKey, apiBaseUrl, model) {
  // 处理API Base URL，如果已经包含路径则直接使用，否则添加默认路径
  const baseUrl = apiBaseUrl.endsWith('/v1') ? apiBaseUrl : `${apiBaseUrl}/v1`;
  const url = `${baseUrl}/chat/completions`;
  const payload = {
    model,
    messages: [
      {
        role: 'user',
        content: `请将以下文本翻译成中文，只返回翻译结果，不要添加任何解释或其他内容：${text}`
      }
    ],
    temperature: 0.3,
    max_tokens: 1000
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw createTranslationError(
      TRANSLATION_ERRORS.API_ERROR,
      `Qwen API 错误 (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw createTranslationError(TRANSLATION_ERRORS.API_ERROR, 'Qwen API 响应格式错误');
  }

  return data.choices[0].message.content.trim();
}

/**
 * OpenAI GPT-4o-mini 翻译实现
 */
async function translateWithOpenAI(text, apiKey, apiBaseUrl) {
  // 处理API Base URL，如果已经包含路径则直接使用，否则添加默认路径
  const baseUrl = apiBaseUrl.endsWith('/v1') ? apiBaseUrl : `${apiBaseUrl}/v1`;
  const url = `${baseUrl}/chat/completions`;
  const payload = {
    model: SUPPORTED_MODELS.GPT_4O_MINI,
    messages: [
      {
        role: 'system',
        content: '你是一个专业的翻译助手。请将用户提供的文本翻译成中文，只返回翻译结果，不要添加任何解释或其他内容。'
      },
      {
        role: 'user',
        content: text
      }
    ],
    temperature: 0.3,
    max_tokens: 1000
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw createTranslationError(
      TRANSLATION_ERRORS.API_ERROR,
      `OpenAI API 错误 (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw createTranslationError(TRANSLATION_ERRORS.API_ERROR, 'OpenAI API 响应格式错误');
  }

  return data.choices[0].message.content.trim();
}

/**
 * 根据模型选择翻译实现
 */
function getTranslator(model) {
  switch (model) {
    case SUPPORTED_MODELS.DEEPSEEK_V3:
      return translateWithDeepSeek;
    case SUPPORTED_MODELS.QWEN_MT_TURBO:
    case SUPPORTED_MODELS.QWEN_MT_PLUS:
      return translateWithQwen;
    case SUPPORTED_MODELS.GPT_4O_MINI:
      return translateWithOpenAI;
    default:
      throw createTranslationError(
        TRANSLATION_ERRORS.INVALID_CONFIG,
        `不支持的模型: ${model}`
      );
  }
}

/**
 * 带重试的翻译函数
 */
async function translateWithRetry(translator, text, apiKey, apiBaseUrl, model, attempt = 0) {
  try {
    if (model === SUPPORTED_MODELS.QWEN_MT_TURBO || model === SUPPORTED_MODELS.QWEN_MT_PLUS) {
      return await translator(text, apiKey, apiBaseUrl, model);
    } else {
      return await translator(text, apiKey, apiBaseUrl);
    }
  } catch (error) {
    // 如果是配置错误或认证错误，不重试
    if (error.type === TRANSLATION_ERRORS.INVALID_CONFIG || 
        error.message.includes('401') || 
        error.message.includes('403')) {
      throw error;
    }

    // 如果达到最大重试次数，抛出错误
    if (attempt >= RETRY_CONFIG.maxRetries) {
      throw error;
    }

    // 计算延迟时间并重试
    const delayMs = calculateDelay(attempt, RETRY_CONFIG.baseDelay, RETRY_CONFIG.maxDelay);
    await delay(delayMs);
    
    return translateWithRetry(translator, text, apiKey, apiBaseUrl, model, attempt + 1);
  }
}

/**
 * 统一翻译接口
 * @param {Object} params - 翻译参数
 * @param {string} params.text - 要翻译的文本
 * @param {string} params.model - 翻译模型
 * @param {string} params.apiKey - API 密钥
 * @param {string} params.apiBaseUrl - API 基础 URL
 * @param {number} [params.timeout] - 超时时间（毫秒）
 * @returns {Promise<string>} 翻译结果
 */
export async function translateText({ text, model, apiKey, apiBaseUrl, timeout = DEFAULT_TIMEOUT }) {
  // 参数验证
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw createTranslationError(TRANSLATION_ERRORS.INVALID_CONFIG, '翻译文本不能为空');
  }

  if (!model || !Object.values(SUPPORTED_MODELS).includes(model)) {
    throw createTranslationError(TRANSLATION_ERRORS.INVALID_CONFIG, '不支持的翻译模型');
  }

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw createTranslationError(TRANSLATION_ERRORS.INVALID_CONFIG, 'API Key 未配置或无效');
  }

  if (!apiBaseUrl || typeof apiBaseUrl !== 'string' || !apiBaseUrl.trim()) {
    throw createTranslationError(TRANSLATION_ERRORS.INVALID_CONFIG, 'API Base URL 未配置或无效');
  }

  // 获取对应的翻译器
  const translator = getTranslator(model);

  // 执行翻译（带重试）
  return translateWithRetry(translator, text.trim(), apiKey.trim(), apiBaseUrl.trim(), model);
}

/**
 * 验证翻译配置
 * @param {Object} config - 配置对象
 * @returns {Object} 验证结果
 */
export function validateTranslationConfig(config) {
  const errors = [];

  if (!config.model || !Object.values(SUPPORTED_MODELS).includes(config.model)) {
    errors.push('不支持的翻译模型');
  }

  if (!config.apiKey || typeof config.apiKey !== 'string' || !config.apiKey.trim()) {
    errors.push('API Key 未配置或无效');
  }

  if (!config.apiBaseUrl || typeof config.apiBaseUrl !== 'string' || !config.apiBaseUrl.trim()) {
    errors.push('API Base URL 未配置或无效');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
