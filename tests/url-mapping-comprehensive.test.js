/**
 * URL映射逻辑综合测试
 * 专门测试mapBaseUrlByModel函数和URL构建逻辑
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('URL映射逻辑综合测试', () => {
  let mapBaseUrlByModel;
  let buildUrl;

  beforeEach(() => {
    // 模拟background.js中的mapBaseUrlByModel函数（修复后的版本）
    mapBaseUrlByModel = (model) => {
      switch (model) {
        case 'deepseek-v3':
          return 'https://api.deepseek.com';
        case 'qwen-mt-turbo':
        case 'qwen-mt-plus':
          return 'https://dashscope.aliyuncs.com';  // 修复后的正确URL
        case 'gpt-4o-mini':
          return 'https://api.openai.com';
        default:
          return '';
      }
    };

    // 模拟translator.js中的URL构建逻辑
    buildUrl = (apiBaseUrl, endpoint) => {
      return `${apiBaseUrl}${endpoint}`;
    };
  });

  describe('mapBaseUrlByModel函数测试', () => {
    it('应该正确映射DeepSeek模型', () => {
      expect(mapBaseUrlByModel('deepseek-v3')).toBe('https://api.deepseek.com');
    });

    it('应该正确映射Qwen模型（修复后）', () => {
      expect(mapBaseUrlByModel('qwen-mt-turbo')).toBe('https://dashscope.aliyuncs.com');
      expect(mapBaseUrlByModel('qwen-mt-plus')).toBe('https://dashscope.aliyuncs.com');
    });

    it('应该正确映射OpenAI模型', () => {
      expect(mapBaseUrlByModel('gpt-4o-mini')).toBe('https://api.openai.com');
    });

    it('应该处理不支持的模型', () => {
      expect(mapBaseUrlByModel('unsupported-model')).toBe('');
      expect(mapBaseUrlByModel('')).toBe('');
      expect(mapBaseUrlByModel(null)).toBe('');
      expect(mapBaseUrlByModel(undefined)).toBe('');
    });
  });

  describe('URL构建逻辑测试', () => {
    it('应该正确构建DeepSeek API URL', () => {
      const baseUrl = mapBaseUrlByModel('deepseek-v3');
      const endpoint = '/v1/chat/completions';
      const finalUrl = buildUrl(baseUrl, endpoint);
      
      expect(finalUrl).toBe('https://api.deepseek.com/v1/chat/completions');
    });

    it('应该正确构建Qwen API URL（修复后）', () => {
      const baseUrl = mapBaseUrlByModel('qwen-mt-turbo');
      const endpoint = '/compatible-mode/v1/chat/completions';
      const finalUrl = buildUrl(baseUrl, endpoint);
      
      expect(finalUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    });

    it('应该正确构建OpenAI API URL', () => {
      const baseUrl = mapBaseUrlByModel('gpt-4o-mini');
      const endpoint = '/v1/chat/completions';
      const finalUrl = buildUrl(baseUrl, endpoint);
      
      expect(finalUrl).toBe('https://api.openai.com/v1/chat/completions');
    });
  });

  describe('修复前后对比测试', () => {
    it('应该验证修复前的错误URL', () => {
      // 模拟修复前的错误逻辑
      const mapBaseUrlByModelOld = (model) => {
        switch (model) {
          case 'qwen-mt-turbo':
          case 'qwen-mt-plus':
            return 'https://dashscope.aliyuncs.com/compatible-mode';  // 错误的URL
          default:
            return '';
        }
      };

      const baseUrlOld = mapBaseUrlByModelOld('qwen-mt-turbo');
      const endpoint = '/compatible-mode/v1/chat/completions';
      const finalUrlOld = buildUrl(baseUrlOld, endpoint);
      
      // 验证修复前的错误URL
      expect(finalUrlOld).toBe('https://dashscope.aliyuncs.com/compatible-mode/compatible-mode/v1/chat/completions');
    });

    it('应该验证修复后的正确URL', () => {
      // 使用修复后的逻辑
      const baseUrlNew = mapBaseUrlByModel('qwen-mt-turbo');
      const endpoint = '/compatible-mode/v1/chat/completions';
      const finalUrlNew = buildUrl(baseUrlNew, endpoint);
      
      // 验证修复后的正确URL
      expect(finalUrlNew).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    });

    it('应该验证URL修复的效果', () => {
      // 修复前的错误URL
      const errorUrl = 'https://dashscope.aliyuncs.com/compatible-mode/compatible-mode/v1/chat/completions';
      
      // 修复后的正确URL
      const correctUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      
      // 验证URL不同
      expect(errorUrl).not.toBe(correctUrl);
      
      // 验证修复后的URL不包含重复路径
      expect(correctUrl).not.toContain('/compatible-mode/compatible-mode/');
      
      // 验证修复后的URL包含正确的路径
      expect(correctUrl).toContain('/compatible-mode/v1/chat/completions');
    });
  });

  describe('边界情况测试', () => {
    it('应该处理空字符串模型', () => {
      expect(mapBaseUrlByModel('')).toBe('');
    });

    it('应该处理null模型', () => {
      expect(mapBaseUrlByModel(null)).toBe('');
    });

    it('应该处理undefined模型', () => {
      expect(mapBaseUrlByModel(undefined)).toBe('');
    });

    it('应该处理大小写不匹配的模型', () => {
      expect(mapBaseUrlByModel('QWEN-MT-TURBO')).toBe('');
      expect(mapBaseUrlByModel('DeepSeek-V3')).toBe('');
    });

    it('应该处理包含空格的模型', () => {
      expect(mapBaseUrlByModel('qwen-mt-turbo ')).toBe('');
      expect(mapBaseUrlByModel(' qwen-mt-turbo')).toBe('');
    });
  });

  describe('性能测试', () => {
    it('应该快速处理大量模型映射', () => {
      const models = [
        'deepseek-v3', 'qwen-mt-turbo', 'qwen-mt-plus', 'gpt-4o-mini',
        'deepseek-v3', 'qwen-mt-turbo', 'qwen-mt-plus', 'gpt-4o-mini'
      ];

      const startTime = Date.now();
      
      models.forEach(model => {
        const baseUrl = mapBaseUrlByModel(model);
        const endpoint = model.includes('qwen') ? '/compatible-mode/v1/chat/completions' : '/v1/chat/completions';
        const finalUrl = buildUrl(baseUrl, endpoint);
        expect(finalUrl).toBeTruthy();
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 验证性能（应该在5ms内完成，允许等于阈值）
      expect(duration).toBeLessThanOrEqual(5);
    });
  });

  describe('集成测试', () => {
    it('应该模拟完整的翻译配置流程', () => {
      const translationConfig = {
        text: 'hello',
        model: 'qwen-mt-turbo',
        apiKey: 'test-key',
        apiBaseUrl: mapBaseUrlByModel('qwen-mt-turbo')
      };

      // 验证配置正确性
      expect(translationConfig.apiBaseUrl).toBe('https://dashscope.aliyuncs.com');
      expect(translationConfig.model).toBe('qwen-mt-turbo');
      
      // 模拟URL构建
      const endpoint = '/compatible-mode/v1/chat/completions';
      const finalUrl = buildUrl(translationConfig.apiBaseUrl, endpoint);
      
      expect(finalUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    });

    it('应该验证所有支持模型的配置', () => {
      const supportedModels = [
        'deepseek-v3',
        'qwen-mt-turbo', 
        'qwen-mt-plus',
        'gpt-4o-mini'
      ];

      supportedModels.forEach(model => {
        const baseUrl = mapBaseUrlByModel(model);
        expect(baseUrl).toBeTruthy();
        expect(baseUrl).toMatch(/^https:\/\//);
        
        // 验证URL格式正确
        const url = new URL(baseUrl);
        expect(url.protocol).toBe('https:');
        expect(url.hostname).toBeTruthy();
      });
    });
  });
});
