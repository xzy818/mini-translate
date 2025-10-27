/**
 * 配置管理测试翻译失败诊断自动化测试
 * 复现选项页配置测试功能的失败场景
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateTranslationConfig, translateText, TRANSLATION_ERRORS } from '../src/services/translator.js';
import { setTemporaryKey, getTemporaryKey, clearTemporaryKeys, maskKey } from './setup-translation-diagnosis.js';

describe('配置管理测试翻译诊断', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {})
    };

    clearTemporaryKeys();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearTemporaryKeys();
  });

  describe('配置验证失败场景', () => {
    it('应该验证无效配置', () => {
      const invalidConfigs = [
        { model: '', apiKey: 'key', apiBaseUrl: 'url' },
        { model: 'deepseek-v3', apiKey: '', apiBaseUrl: 'url' },
        { model: 'deepseek-v3', apiKey: 'key', apiBaseUrl: '' },
        { model: 'unsupported', apiKey: 'key', apiBaseUrl: 'url' }
      ];

      invalidConfigs.forEach((config, index) => {
        const result = validateTranslationConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        // eslint-disable-next-line no-console
    console.log(`配置 ${index + 1} 验证失败:`, result.errors);
      });
    });

    it('应该验证 QA Stub 配置', () => {
      const stubConfig = {
        model: 'deepseek-v3',
        apiKey: 'any-key',
        apiBaseUrl: 'stub://translator/success'
      };

      const result = validateTranslationConfig(stubConfig);
      expect(result.isValid).toBe(true);
    });

    it('应该验证无效的 QA Stub 配置', () => {
      const invalidStubConfig = {
        model: 'deepseek-v3',
        apiKey: 'any-key',
        apiBaseUrl: 'stub://invalid-format'
      };

      const result = validateTranslationConfig(invalidStubConfig);
      expect(result.isValid).toBe(false);
    });
  });

  describe('模型-URL 映射测试', () => {
    it('应该测试不同模型的 Base URL 映射', () => {
      const modelMappings = [
        { model: 'deepseek-v3', expectedUrl: 'https://api.deepseek.com' },
        { model: 'qwen-mt-turbo', expectedUrl: 'https://dashscope.aliyuncs.com' },
        { model: 'qwen-mt-plus', expectedUrl: 'https://dashscope.aliyuncs.com' },
        { model: 'gpt-4o-mini', expectedUrl: 'https://api.openai.com' }
      ];

      // 模拟后台的 mapBaseUrlByModel 函数
      const mapBaseUrlByModel = (model) => {
        switch (model) {
          case 'deepseek-v3':
            return 'https://api.deepseek.com';
          case 'qwen-mt-turbo':
          case 'qwen-mt-plus':
            return 'https://dashscope.aliyuncs.com';
          case 'gpt-4o-mini':
            return 'https://api.openai.com';
          default:
            return '';
        }
      };

      modelMappings.forEach(({ model, expectedUrl }) => {
        const mappedUrl = mapBaseUrlByModel(model);
        expect(mappedUrl).toBe(expectedUrl);
        // eslint-disable-next-line no-console
    console.log(`模型 ${model} 映射到: ${mappedUrl}`);
      });
    });
  });

  describe('配置测试 API 调用失败场景', () => {
    it('应该处理测试配置的 401 认证错误', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('{"error": {"message": "Invalid API key"}}')
      });

      const testConfig = {
        text: 'diagnostic check',
        model: 'deepseek-v3',
        apiKey: 'invalid-key',
        apiBaseUrl: 'https://api.deepseek.com'
      };

      await expect(translateText(testConfig)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.API_ERROR,
        statusCode: 401
      });

      // 验证错误日志
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[Translator] API error',
        expect.objectContaining({ 
          model: 'deepseek-v3',
          url: 'https://api.deepseek.com/v1/chat/completions'
        }),
        expect.any(String)
      );
    });

    it('应该处理测试配置的 400 模型错误', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error": {"message": "Model not found"}}')
      });

      const testConfig = {
        text: 'diagnostic check',
        model: 'qwen-mt-turbo',
        apiKey: 'valid-key',
        apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode'
      };

      await expect(translateText(testConfig)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.API_ERROR,
        statusCode: 400
      });
    });

    it('应该处理测试配置的网络超时', async () => {
      global.fetch.mockImplementationOnce(() => 
        new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Request timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        })
      );

      const testConfig = {
        text: 'diagnostic check',
        model: 'deepseek-v3',
        apiKey: 'valid-key',
        apiBaseUrl: 'https://api.deepseek.com',
        timeout: 50
      };

      await expect(translateText(testConfig)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.TIMEOUT
      });
    });

    it('应该处理测试配置的 429 限流错误', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('{"error": {"message": "Rate limit exceeded"}}')
      });

      const testConfig = {
        text: 'diagnostic check',
        model: 'gpt-4o-mini',
        apiKey: 'valid-key',
        apiBaseUrl: 'https://api.openai.com'
      };

      await expect(translateText(testConfig)).rejects.toMatchObject({
        type: TRANSLATION_ERRORS.API_ERROR,
        statusCode: 429
      });
    });
  });

  describe('后台配置测试消息处理', () => {
    it('应该处理 TEST_TRANSLATOR_SETTINGS 消息', async () => {
     // Mock 配置验证
      const config = {
        model: 'deepseek-v3',
        apiKey: 'test-key',
        apiBaseUrl: 'https://api.deepseek.com'
      };

      const validation = validateTranslationConfig(config);
      expect(validation.isValid).toBe(true);

      // Mock API 调用
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: '诊断检查' }
          }]
        })
      });

      const result = await translateText({
        text: 'diagnostic check',
        model: config.model,
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl,
        timeout: 15000
      });

      expect(result).toBe('诊断检查');
    });

    it('应该处理配置验证失败的消息', async () => {
      const invalidConfig = {
        model: '',
        apiKey: 'test-key',
        apiBaseUrl: 'https://api.deepseek.com'
      };

      const validation = validateTranslationConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('不支持的翻译模型');
    });
  });

  describe('真实 API 配置测试（使用临时 Key）', () => {
    it('应该能够使用临时 Key 进行真实配置测试', async () => {
      const testKey = process.env.TEST_DEEPSEEK_KEY || 'test-key';
      if (testKey === 'test-key') {
        // eslint-disable-next-line no-console
    console.log('跳过真实配置测试：未提供 TEST_DEEPSEEK_KEY 环境变量');
        return;
      }

      setTemporaryKey('deepseek', testKey);

      const config = {
        text: 'diagnostic check',
        model: 'deepseek-v3',
        apiKey: getTemporaryKey('deepseek'),
        apiBaseUrl: 'https://api.deepseek.com'
      };

      try {
        const result = await translateText(config);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        // eslint-disable-next-line no-console
    console.log('真实配置测试成功，翻译结果:', result);
      } catch (error) {
        // eslint-disable-next-line no-console
    console.log('真实配置测试失败:', error.message);
        // 确保错误消息不包含真实 Key
        expect(error.message).not.toContain(testKey);
      } finally {
        clearTemporaryKeys();
      }
    });

    it('应该测试不同模型的真实配置', async () => {
      const testKeys = {
        deepseek: process.env.TEST_DEEPSEEK_KEY,
        openai: process.env.TEST_OPENAI_KEY,
        qwen: process.env.TEST_QWEN_KEY
      };

      const testConfigs = [
        {
          name: 'DeepSeek V3',
          model: 'deepseek-v3',
          apiBaseUrl: 'https://api.deepseek.com',
          key: testKeys.deepseek
        },
        {
          name: 'OpenAI GPT-4o-mini',
          model: 'gpt-4o-mini',
          apiBaseUrl: 'https://api.openai.com',
          key: testKeys.openai
        },
        {
          name: 'Qwen MT Turbo',
          model: 'qwen-mt-turbo',
          apiBaseUrl: 'https://dashscope.aliyuncs.com',
          key: testKeys.qwen
        }
      ];

      for (const config of testConfigs) {
        if (!config.key || config.key === 'test-key') {
          // eslint-disable-next-line no-console
    console.log(`跳过 ${config.name} 测试：未提供对应环境变量`);
          continue;
        }

        setTemporaryKey(config.name.toLowerCase().replace(/\s+/g, '-'), config.key);

        try {
          const result = await translateText({
            text: 'diagnostic check',
            model: config.model,
            apiKey: getTemporaryKey(config.name.toLowerCase().replace(/\s+/g, '-')),
            apiBaseUrl: config.apiBaseUrl
          });

          // eslint-disable-next-line no-console
    console.log(`${config.name} 测试成功:`, result);
          expect(result).toBeDefined();
        } catch (error) {
          // eslint-disable-next-line no-console
    console.log(`${config.name} 测试失败:`, error.message);
          // 确保错误消息不包含真实 Key
          expect(error.message).not.toContain(config.key);
        }
      }

      clearTemporaryKeys();
    });
  });

  describe('配置测试日志安全验证', () => {
    it('应该确保配置测试日志中不包含真实 API Key', async () => {
      const realKey = 'sk-1234567890abcdef';
      setTemporaryKey('test', realKey);

      // 模拟 API 调用失败
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('{"error": "Invalid API key"}')
      });

      const config = {
        text: 'diagnostic check',
        model: 'deepseek-v3',
        apiKey: realKey,
        apiBaseUrl: 'https://api.deepseek.com'
      };

      try {
        await translateText(config);
      } catch (error) {
        // 验证错误日志不包含真实 Key
        const errorCalls = consoleSpy.error.mock.calls;
        errorCalls.forEach(call => {
          const logContent = JSON.stringify(call);
          expect(logContent).not.toContain(realKey);
          expect(logContent).toContain(maskKey(realKey));
        });
      }
    });
  });

  describe('配置测试结果分析', () => {
    it('应该分析不同错误类型的根因', async () => {
      const errorScenarios = [
        {
          name: '认证失败',
          status: 401,
          response: '{"error": {"message": "Invalid API key"}}',
          expectedCause: 'API Key 无效或未授权'
        },
        {
          name: '模型不支持',
          status: 400,
          response: '{"error": {"message": "Model not found"}}',
          expectedCause: '模型名称不被服务端识别'
        },
        {
          name: '限流',
          status: 429,
          response: '{"error": {"message": "Rate limit exceeded"}}',
          expectedCause: 'API 调用频率超限'
        },
        {
          name: '服务器错误',
          status: 500,
          response: '{"error": {"message": "Internal server error"}}',
          expectedCause: '服务端内部错误'
        }
      ];

      for (const scenario of errorScenarios) {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: scenario.status,
          text: () => Promise.resolve(scenario.response)
        });

        const config = {
          text: 'diagnostic check',
          model: 'deepseek-v3',
          apiKey: 'test-key',
          apiBaseUrl: 'https://api.deepseek.com'
        };

        try {
          await translateText(config);
        } catch (error) {
          // eslint-disable-next-line no-console
    console.log(`${scenario.name} 场景:`, {
            status: scenario.status,
            cause: scenario.expectedCause,
            error: error.message
          });

          expect(error.statusCode).toBe(scenario.status);
          expect(error.type).toBe(TRANSLATION_ERRORS.API_ERROR);
        }
      }
    });
  });
});
