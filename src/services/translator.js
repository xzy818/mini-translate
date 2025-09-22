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
 * 使用chrome.scripting.executeScript在普通网页中执行fetch
 */
async function chromeExtensionFetch(url, options) {
  return new Promise((resolve, reject) => {
    console.log('🔍 Chrome扩展专用fetch请求:', { url, options });
    
    // 设置超时处理
    const timeout = setTimeout(() => {
      reject(new Error('Chrome extension fetch timeout'));
    }, options.timeout || 30000);
    
    // 查找一个可用的标签页（非扩展页面）
    chrome.tabs.query({}, (tabs) => {
      // 过滤掉扩展页面，找一个普通的网页
      const availableTabs = tabs.filter(tab => 
        tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('moz-extension://') &&
        !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('about:')
      );
      
      if (availableTabs.length === 0) {
        clearTimeout(timeout);
        reject(new Error('No available tab found for script injection'));
        return;
      }
      
      // 使用第一个可用的标签页
      const tabId = availableTabs[0].id;
      console.log('🔍 使用标签页进行脚本注入:', tabId, availableTabs[0].url);
      
      // 动态注入脚本执行fetch请求
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: async (url, options) => {
          try {
            console.log('🔍 注入脚本执行fetch请求:', { url, options });
            const response = await fetch(url, options);
            const responseText = await response.text();
            
            let responseData;
            try {
              responseData = JSON.parse(responseText);
            } catch {
              responseData = responseText;
            }
            
            return {
              success: true,
              data: {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                json: responseData,
                text: responseText
              }
            };
          } catch (error) {
            console.log('❌ 注入脚本fetch失败:', error);
            return {
              success: false,
              error: error.message
            };
          }
        },
        args: [url, options]
      }, (results) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (results && results[0] && results[0].result) {
          const result = results[0].result;
          if (result.success) {
            // 创建一个模拟的Response对象
            const mockResponse = {
              ok: result.data.ok,
              status: result.data.status,
              statusText: result.data.statusText,
              headers: new Map(Object.entries(result.data.headers || {})),
              json: () => Promise.resolve(result.data.json),
              text: () => Promise.resolve(result.data.text)
            };
            resolve(mockResponse);
          } else {
            reject(new Error(result.error));
          }
        } else {
          reject(new Error('No result from injected script'));
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
