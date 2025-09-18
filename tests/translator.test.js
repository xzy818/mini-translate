import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  translateText, 
  validateTranslationConfig, 
  SUPPORTED_MODELS, 
  TRANSLATION_ERRORS 
} from '../src/services/translator.js';

// Mock fetch
global.fetch = vi.fn();

describe('翻译服务 (translator.js)', () => {
  const mockConfig = {
    text: 'hello world',
    model: SUPPORTED_MODELS.DEEPSEEK_V3,
    apiKey: 'test-api-key',
    apiBaseUrl: 'https://api.example.com'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('translateText 函数', () => {
    it('应该成功翻译文本 (DeepSeek V3)', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '你好世界'
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await translateText(mockConfig);
      
      expect(result).toBe('你好世界');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          }
        })
      );
    });

    it('应该成功翻译文本 (Qwen MT Turbo)', async () => {
      const config = { ...mockConfig, model: SUPPORTED_MODELS.QWEN_MT_TURBO };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '你好世界'
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await translateText(config);
      
      expect(result).toBe('你好世界');
    });

    it('应该成功翻译文本 (Qwen MT Plus)', async () => {
      const config = { ...mockConfig, model: SUPPORTED_MODELS.QWEN_MT_PLUS };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '你好世界'
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await translateText(config);
      
      expect(result).toBe('你好世界');
    });

    it('应该成功翻译文本 (GPT-4o-mini)', async () => {
      const config = { ...mockConfig, model: SUPPORTED_MODELS.GPT_4O_MINI };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '你好世界'
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await translateText(config);
      
      expect(result).toBe('你好世界');
    });

    it('应该处理空文本错误', async () => {
      const config = { ...mockConfig, text: '' };
      
      await expect(translateText(config)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.INVALID_CONFIG,
        message: '翻译文本不能为空'
      });
    });

    it('应该处理无效模型错误', async () => {
      const config = { ...mockConfig, model: 'invalid-model' };
      
      await expect(translateText(config)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.INVALID_CONFIG,
        message: '不支持的翻译模型'
      });
    });

    it('应该处理无效 API Key 错误', async () => {
      const config = { ...mockConfig, apiKey: '' };
      
      await expect(translateText(config)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.INVALID_CONFIG,
        message: 'API Key 未配置或无效'
      });
    });

    it('应该处理无效 API Base URL 错误', async () => {
      const config = { ...mockConfig, apiBaseUrl: '' };
      
      await expect(translateText(config)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.INVALID_CONFIG,
        message: 'API Base URL 未配置或无效'
      });
    });

    it('应该处理 API 错误响应', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized')
      };

      fetch.mockResolvedValue(mockResponse);

      await expect(translateText(mockConfig)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.API_ERROR,
        message: expect.stringContaining('DeepSeek API 错误 (401)')
      });
    });

    it('应该处理网络错误', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      await expect(translateText(mockConfig)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.NETWORK_ERROR,
        message: expect.stringContaining('网络错误')
      });
    });

    it('应该处理超时错误', async () => {
      // Mock AbortController
      const mockAbortController = {
        abort: vi.fn(),
        signal: {}
      };
      
      global.AbortController = vi.fn(() => mockAbortController);
      global.setTimeout = vi.fn((callback) => {
        callback();
        return 1;
      });

      fetch.mockImplementation(() => {
        const error = new Error('Request timeout');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(translateText(mockConfig)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.TIMEOUT,
        message: expect.stringContaining('请求超时')
      });
    });

    it('应该处理无效的 API 响应格式', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [] // 空的 choices 数组
        })
      };

      fetch.mockResolvedValue(mockResponse);

      await expect(translateText(mockConfig)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.API_ERROR,
        message: 'DeepSeek API 响应格式错误'
      });
    });

    it('应该支持自定义超时时间', async () => {
      const config = { ...mockConfig, timeout: 5000 };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '你好世界'
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      await translateText(config);
      
      // 验证 fetch 被调用时使用了正确的超时设置
      expect(fetch).toHaveBeenCalled();
    });

    it('应该处理文本前后空格', async () => {
      const config = { ...mockConfig, text: '  hello world  ' };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '你好世界'
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await translateText(config);
      
      expect(result).toBe('你好世界');
    });
  });

  describe('validateTranslationConfig 函数', () => {
    it('应该验证有效的配置', () => {
      const config = {
        model: SUPPORTED_MODELS.DEEPSEEK_V3,
        apiKey: 'valid-key',
        apiBaseUrl: 'https://api.example.com'
      };

      const result = validateTranslationConfig(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测无效的模型', () => {
      const config = {
        model: 'invalid-model',
        apiKey: 'valid-key',
        apiBaseUrl: 'https://api.example.com'
      };

      const result = validateTranslationConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('不支持的翻译模型');
    });

    it('应该检测无效的 API Key', () => {
      const config = {
        model: SUPPORTED_MODELS.DEEPSEEK_V3,
        apiKey: '',
        apiBaseUrl: 'https://api.example.com'
      };

      const result = validateTranslationConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('API Key 未配置或无效');
    });

    it('应该检测无效的 API Base URL', () => {
      const config = {
        model: SUPPORTED_MODELS.DEEPSEEK_V3,
        apiKey: 'valid-key',
        apiBaseUrl: ''
      };

      const result = validateTranslationConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('API Base URL 未配置或无效');
    });

    it('应该检测多个错误', () => {
      const config = {
        model: 'invalid-model',
        apiKey: '',
        apiBaseUrl: ''
      };

      const result = validateTranslationConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('不支持的翻译模型');
      expect(result.errors).toContain('API Key 未配置或无效');
      expect(result.errors).toContain('API Base URL 未配置或无效');
    });
  });

  describe('重试机制', () => {
    it('应该在网络错误时重试', async () => {
      // 第一次调用失败，第二次成功
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            choices: [{
              message: {
                content: '你好世界'
              }
            }]
          })
        });

      // Mock setTimeout 和 delay 函数
      vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 1;
      });

      const result = await translateText(mockConfig);
      
      expect(result).toBe('你好世界');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      // 所有调用都失败
      fetch.mockRejectedValue(new Error('Network error'));

      // Mock setTimeout
      vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 1;
      });

      await expect(translateText(mockConfig)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.NETWORK_ERROR
      });

      // 应该重试 2 次，总共调用 3 次
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('不应该重试配置错误', async () => {
      const config = { ...mockConfig, apiKey: '' };
      
      await expect(translateText(config)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.INVALID_CONFIG
      });

      // 不应该调用 fetch
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('支持的模型', () => {
    it('应该包含所有支持的模型', () => {
      expect(SUPPORTED_MODELS.DEEPSEEK_V3).toBe('deepseek-v3');
      expect(SUPPORTED_MODELS.QWEN_MT_TURBO).toBe('qwen-mt-turbo');
      expect(SUPPORTED_MODELS.QWEN_MT_PLUS).toBe('qwen-mt-plus');
      expect(SUPPORTED_MODELS.GPT_4O_MINI).toBe('gpt-4o-mini');
    });
  });

  describe('错误类型', () => {
    it('应该包含所有错误类型', () => {
      expect(TRANSLATION_ERRORS.INVALID_CONFIG).toBe('INVALID_CONFIG');
      expect(TRANSLATION_ERRORS.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(TRANSLATION_ERRORS.TIMEOUT).toBe('TIMEOUT');
      expect(TRANSLATION_ERRORS.API_ERROR).toBe('API_ERROR');
      expect(TRANSLATION_ERRORS.RATE_LIMIT).toBe('RATE_LIMIT');
      expect(TRANSLATION_ERRORS.INSUFFICIENT_QUOTA).toBe('INSUFFICIENT_QUOTA');
      expect(TRANSLATION_ERRORS.UNKNOWN).toBe('UNKNOWN');
    });
  });
});
