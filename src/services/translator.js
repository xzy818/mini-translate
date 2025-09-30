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

const QA_STUB_PREFIX = 'stub://translator';

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

// 移除XHR：MV3 Service Worker不提供XMLHttpRequest，统一使用fetch

/**
 * 带超时的 fetch 请求（极简：统一使用标准 fetch）
 */
async function fetchWithTimeout(url, options, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions = { ...options, signal: controller.signal };
    const response = await fetch(url, fetchOptions);
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw createTranslationError(TRANSLATION_ERRORS.TIMEOUT, `请求超时 (${timeout}ms)`);
    }

    // 统一网络错误
    const msg = error && error.message ? error.message : '网络错误';
    throw createTranslationError(TRANSLATION_ERRORS.NETWORK_ERROR, `网络错误: ${msg}`, error);
  }
}

/**
 * 辅助：规范化 baseUrl，确保以 /v1 结尾
 */
function buildApiBaseUrl(apiBaseUrl) {
  const base = String(apiBaseUrl || '').trim();
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

/**
 * 辅助：构建标准头
 */
function buildHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
}

/**
 * 辅助：构建统一 messages（最简：统一 system 提示 + user 文本）
 */
function buildMessages(text, withSystem = true) {
  const messages = [];
  if (withSystem) {
    messages.push({
      role: 'system',
      content: '你是一个专业的翻译助手。请将用户提供的文本翻译成中文，只返回翻译结果，不要添加任何解释或其他内容。'
    });
  }
  messages.push({ role: 'user', content: text });
  return messages;
}

/**
 * 辅助：解析 chat completion 响应
 */
function parseChatCompletion(data) {
  if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
    throw createTranslationError(TRANSLATION_ERRORS.API_ERROR, 'API 响应格式错误');
  }
  return String(data.choices[0].message.content || '').trim();
}

/**
 * DeepSeek V3 翻译实现
 */
async function translateWithDeepSeek(text, apiKey, apiBaseUrl) {
  // 处理API Base URL，如果已经包含路径则直接使用，否则添加默认路径
  const url = `${buildApiBaseUrl(apiBaseUrl)}/chat/completions`;
  const payload = {
    model: SUPPORTED_MODELS.DEEPSEEK_V3,
    messages: buildMessages(text, true),
    temperature: 0.3,
    max_tokens: 1000
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    // 记录模型与请求 URL 便于排查
    try { console.error('[Translator] API error', { model: SUPPORTED_MODELS.DEEPSEEK_V3, url }); } catch (_) {}
    const err = createTranslationError(TRANSLATION_ERRORS.API_ERROR, `DeepSeek API 错误 (${response.status}): ${errorText}`);
    err.statusCode = response.status;
    err.meta = { model: SUPPORTED_MODELS.DEEPSEEK_V3, url };
    throw err;
  }

  const data = await response.json();
  try {
    return parseChatCompletion(data);
  } catch (e) {
    // 兼容历史测试文案：DeepSeek API 响应格式错误
    const err = createTranslationError(TRANSLATION_ERRORS.API_ERROR, 'DeepSeek API 响应格式错误', e);
    throw err;
  }
}

/**
 * Qwen MT 翻译实现
 */
async function translateWithQwen(text, apiKey, apiBaseUrl, model) {
  // 处理API Base URL，如果已经包含路径则直接使用，否则添加默认路径
  const url = `${buildApiBaseUrl(apiBaseUrl)}/chat/completions`;
  const payload = {
    model,
    messages: buildMessages(text, false),
    temperature: 0.3,
    max_tokens: 1000
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    // 记录模型与请求 URL 便于排查
    try { console.error('[Translator] API error', { model, url }); } catch (_) {}
    const err = createTranslationError(TRANSLATION_ERRORS.API_ERROR, `Qwen API 错误 (${response.status}): ${errorText}`);
    err.statusCode = response.status;
    err.meta = { model, url };
    throw err;
  }

  const data = await response.json();
  return parseChatCompletion(data);
}

/**
 * OpenAI GPT-4o-mini 翻译实现
 */
async function translateWithOpenAI(text, apiKey, apiBaseUrl) {
  // 处理API Base URL，如果已经包含路径则直接使用，否则添加默认路径
  const url = `${buildApiBaseUrl(apiBaseUrl)}/chat/completions`;
  const payload = {
    model: SUPPORTED_MODELS.GPT_4O_MINI,
    messages: buildMessages(text, true),
    temperature: 0.3,
    max_tokens: 1000
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    // 记录模型与请求 URL 便于排查
    try { console.error('[Translator] API error', { model: SUPPORTED_MODELS.GPT_4O_MINI, url }); } catch (_) {}
    const err = createTranslationError(TRANSLATION_ERRORS.API_ERROR, `OpenAI API 错误 (${response.status}): ${errorText}`);
    err.statusCode = response.status;
    err.meta = { model: SUPPORTED_MODELS.GPT_4O_MINI, url };
    throw err;
  }

  const data = await response.json();
  return parseChatCompletion(data);
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
    // 在发生错误时记录模型与基础 URL（便于快速定位问题）
    try { console.error('[Translator] Translate failed', { model, url: buildApiBaseUrl(apiBaseUrl) }, error); } catch (_) {}
    // 统一补充错误元数据，便于上层 UI 捕获展示
    try {
      if (!error.meta) {
        error.meta = { model, url: buildApiBaseUrl(apiBaseUrl) };
      }
    } catch (_) {}
    // 如果是配置错误或认证错误，不重试
    if (error.type === TRANSLATION_ERRORS.INVALID_CONFIG || 
        error.message.includes('401') || 
        error.message.includes('403')) {
      throw error;
    }

    // 仅当网络错误或5xx时重试
    const shouldRetry = error.type === TRANSLATION_ERRORS.NETWORK_ERROR || (typeof error.statusCode === 'number' && error.statusCode >= 500);
    if (!shouldRetry) {
      throw error;
    }

    if (attempt >= RETRY_CONFIG.maxRetries) {
      throw error;
    }

    const delayMs = calculateDelay(attempt, RETRY_CONFIG.baseDelay, RETRY_CONFIG.maxDelay);
    await delay(delayMs);
    return translateWithRetry(translator, text, apiKey, apiBaseUrl, model, attempt + 1);
  }
}

function isQaStubBase(apiBaseUrl) {
  return typeof apiBaseUrl === 'string' && apiBaseUrl.startsWith(QA_STUB_PREFIX);
}

function parseQaStub(apiBaseUrl) {
  if (!isQaStubBase(apiBaseUrl)) {
    return null;
  }
  const normalized = apiBaseUrl
    .replace(QA_STUB_PREFIX, 'http://qa-stub')
    .replace(/([^:])\/\//g, '$1/');
  try {
    const url = new URL(normalized);
    const rawScenario = url.pathname.replace(/^\/+|\/+$/g, '') || 'success';
    const params = Object.fromEntries(url.searchParams.entries());
    return { scenario: rawScenario, params };
  } catch (error) {
    throw createTranslationError(
      TRANSLATION_ERRORS.INVALID_CONFIG,
      `QA Stub 解析失败: ${error.message}`,
      error
    );
  }
}

function runQaStub(stubConfig, { text, model }) {
  const params = stubConfig?.params || {};
  const scenario = stubConfig?.scenario || 'success';

  switch (scenario) {
    case 'success':
    case 'ok': {
      const translation = params.translation || `[stub:${model}] ${text}`;
      return translation;
    }
    case 'auth-error':
    case 'unauthorized': {
      throw createTranslationError(
        TRANSLATION_ERRORS.API_ERROR,
        params.message || '认证失败 (QA Stub)'
      );
    }
    case 'timeout': {
      throw createTranslationError(
        TRANSLATION_ERRORS.TIMEOUT,
        params.message || '请求超时 (QA Stub)'
      );
    }
    case 'network-error': {
      throw createTranslationError(
        TRANSLATION_ERRORS.NETWORK_ERROR,
        params.message || '网络错误 (QA Stub)'
      );
    }
    case 'rate-limit': {
      throw createTranslationError(
        TRANSLATION_ERRORS.RATE_LIMIT,
        params.message || '命中频率限制 (QA Stub)'
      );
    }
    default: {
      throw createTranslationError(
        TRANSLATION_ERRORS.UNKNOWN,
        params.message || `未识别的 QA Stub 场景: ${scenario}`
      );
    }
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

  const stubActive = isQaStubBase(apiBaseUrl);

  if (!stubActive) {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      throw createTranslationError(TRANSLATION_ERRORS.INVALID_CONFIG, 'API Key 未配置或无效');
    }

    if (!apiBaseUrl || typeof apiBaseUrl !== 'string' || !apiBaseUrl.trim()) {
      throw createTranslationError(TRANSLATION_ERRORS.INVALID_CONFIG, 'API Base URL 未配置或无效');
    }
  } else if (!apiBaseUrl || typeof apiBaseUrl !== 'string' || !apiBaseUrl.trim()) {
    throw createTranslationError(TRANSLATION_ERRORS.INVALID_CONFIG, 'QA Stub Base URL 无效');
  }

  const trimmedText = text.trim();

  if (stubActive) {
    const stubConfig = parseQaStub(apiBaseUrl.trim());
    return runQaStub(stubConfig, { text: trimmedText, model });
  }

  // 获取对应的翻译器
  const translator = getTranslator(model);

  return translateWithRetry(translator, trimmedText, apiKey.trim(), apiBaseUrl.trim(), model);
}

/**
 * 验证翻译配置
 * @param {Object} config - 配置对象
 * @returns {Object} 验证结果
 */
export function validateTranslationConfig(config) {
  const errors = [];

  const stubActive = isQaStubBase(config?.apiBaseUrl);

  if (!config.model || !Object.values(SUPPORTED_MODELS).includes(config.model)) {
    errors.push('不支持的翻译模型');
  }

  if (!stubActive) {
    if (!config.apiKey || typeof config.apiKey !== 'string' || !config.apiKey.trim()) {
      errors.push('API Key 未配置或无效');
    }

    if (!config.apiBaseUrl || typeof config.apiBaseUrl !== 'string' || !config.apiBaseUrl.trim()) {
      errors.push('API Base URL 未配置或无效');
    }
  } else if (!config.apiBaseUrl || typeof config.apiBaseUrl !== 'string' || !config.apiBaseUrl.trim()) {
    errors.push('QA Stub Base URL 无效');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
