/**
 * 翻译失败诊断测试环境设置
 * 提供安全的临时 Key 处理机制，确保不在任何地方保存真实 Key
 */

import { vi } from 'vitest';

// 临时 Key 存储（仅内存，测试结束后自动清除）
let temporaryKeys = {};

/**
 * 设置临时测试 Key（仅用于当前测试会话）
 * @param {string} provider - 服务商名称
 * @param {string} key - API Key
 */
export function setTemporaryKey(provider, key) {
  temporaryKeys[provider] = key;
}

/**
 * 获取临时测试 Key
 * @param {string} provider - 服务商名称
 * @returns {string|null} API Key 或 null
 */
export function getTemporaryKey(provider) {
  return temporaryKeys[provider] || null;
}

/**
 * 清除所有临时 Key
 */
export function clearTemporaryKeys() {
  temporaryKeys = {};
}

/**
 * 安全的 Key 掩码处理（用于日志输出）
 * @param {string} key - 原始 Key
 * @returns {string} 掩码后的 Key
 */
export function maskKey(key) {
  if (!key || key.length < 8) return '***';
  return key.substring(0, 4) + '***' + key.substring(key.length - 4);
}

// Mock Chrome Extension APIs
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() },
    lastError: null,
    getManifest: vi.fn(() => ({
      oauth2: {
        client_id: 'TEST_CLIENT_ID',
        scopes: ['openid', 'email', 'profile']
      }
    }))
  },
  identity: {
    getAuthToken: vi.fn(),
    removeCachedAuthToken: vi.fn(),
    onSignInChanged: {
      addListener: vi.fn()
    }
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn()
    }
  },
  tabs: {
    sendMessage: vi.fn()
  },
  notifications: {
    create: vi.fn()
  }
};

// 提供与 jest 兼容的别名，复用 vitest 的 mock 能力
global.jest = vi;

// Mock fetch with 安全日志记录
const _unused = global.fetch;
global.fetch = vi.fn().mockImplementation(async (url, options) => {
  // 记录请求但不包含真实 Key
  const maskedOptions = { ...options };
  if (maskedOptions.headers && maskedOptions.headers.Authorization) {
    const auth = maskedOptions.headers.Authorization;
    if (auth.startsWith('Bearer ')) {
      maskedOptions.headers.Authorization = `Bearer ${maskKey(auth.substring(7))}`;
    }
  }
  
  // eslint-disable-next-line no-console
    console.log('[Test] API Request:', {
    url,
    method: maskedOptions.method,
    headers: maskedOptions.headers
  });
  
  // 默认返回成功响应，具体测试可以覆盖这个mock
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      choices: [{
        message: {
          content: '测试翻译结果'
        }
      }]
    }),
    text: () => Promise.resolve('{"choices":[{"message":{"content":"测试翻译结果"}}]}')
  };
});

// 测试环境清理
afterEach(() => {
  clearTemporaryKeys();
  vi.clearAllMocks();
});

// 全局测试清理
afterAll(() => {
  clearTemporaryKeys();
});
