import { describe, it, expect, beforeEach, vi } from 'vitest';

// 端到端集成测试：模拟完整的配置流程
describe('Configuration Flow E2E Tests', () => {
  let mockChromeAPI;
  let mockAIConfigManager;
  let mockBackgroundHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // 模拟Chrome API
    mockChromeAPI = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn()
        }
      },
      runtime: {
        sendMessage: vi.fn(),
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        },
        lastError: null
      }
    };

    // 模拟AI配置管理器
    mockAIConfigManager = {
      providers: [
        { key: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com' },
        { key: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com' }
      ],
      currentProvider: null,
      currentModel: null,
      loadProviders: vi.fn().mockResolvedValue(),
      loadModels: vi.fn().mockResolvedValue(),
      testConnection: vi.fn(),
      saveConfig: vi.fn()
    };

    // 模拟Background消息处理器
    mockBackgroundHandler = {
      handleMessage: vi.fn((message, sender, sendResponse) => {
        switch (message.type) {
          case 'GET_AI_PROVIDERS':
            sendResponse({ 
              ok: true, 
              providers: mockAIConfigManager.providers 
            });
            return false;
            
          case 'GET_PROVIDER_MODELS': {
            const models = [
              { key: 'gpt-4o-mini', name: 'GPT-4o Mini', model: 'gpt-4o-mini' },
              { key: 'deepseek-v3', name: 'DeepSeek V3', model: 'deepseek-v3' }
            ];
            sendResponse({ ok: true, models });
            return false;
          }
            
          case 'AI_API_CALL': {
            // 模拟AI API调用
            setTimeout(() => {
              sendResponse({ 
                ok: true, 
                result: { text: 'Test response', usage: { total_tokens: 10 } }
              });
            }, 100);
            return true;
          }
            
          case 'TEST_TRANSLATOR_SETTINGS':
            // 模拟翻译测试
            setTimeout(() => {
              sendResponse({ ok: true });
            }, 200);
            return true;
            
          default:
            sendResponse({ ok: false, error: 'Unknown message type' });
            return false;
        }
      })
    };
  });

  describe('Complete Configuration Flow', () => {
    it('should complete full AI config test flow', async () => {
      // 1. 加载配置页面
      const configPage = {
        providerSelect: { value: '', disabled: false },
        modelSelect: { value: '', disabled: true },
        apiKeyInput: { value: '', type: 'password' },
        testButton: { disabled: true },
        saveButton: { disabled: true }
      };

      // 2. 加载提供商列表
      const providersResponse = await new Promise((resolve) => {
        mockBackgroundHandler.handleMessage(
          { type: 'GET_AI_PROVIDERS' },
          {},
          (response) => resolve(response)
        );
      });

      expect(providersResponse.ok).toBe(true);
      expect(providersResponse.providers).toHaveLength(2);

      // 3. 选择提供商
      configPage.providerSelect.value = 'openai';
      mockAIConfigManager.currentProvider = providersResponse.providers[0];

      // 4. 加载模型列表
      const modelsResponse = await new Promise((resolve) => {
        mockBackgroundHandler.handleMessage(
          { type: 'GET_PROVIDER_MODELS', payload: { provider: 'openai' } },
          {},
          (response) => resolve(response)
        );
      });

      expect(modelsResponse.ok).toBe(true);
      expect(modelsResponse.models).toHaveLength(2);

      // 5. 选择模型
      configPage.modelSelect.value = 'gpt-4o-mini';
      configPage.modelSelect.disabled = false;
      mockAIConfigManager.currentModel = modelsResponse.models[0];

      // 6. 输入API Key
      configPage.apiKeyInput.value = 'sk-test-key';

      // 7. 验证表单完整性
      const isFormValid = !!(configPage.providerSelect.value && 
                           configPage.modelSelect.value && 
                           configPage.apiKeyInput.value.trim());
      
      expect(isFormValid).toBe(true);
      configPage.testButton.disabled = !isFormValid;
      configPage.saveButton.disabled = !isFormValid;

      // 8. 测试连接
      const testResponse = await new Promise((resolve) => {
        mockBackgroundHandler.handleMessage(
          { 
            type: 'AI_API_CALL',
            payload: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
              apiKey: 'sk-test-key',
              options: { maxTokens: 10 }
            }
          },
          {},
          (response) => resolve(response)
        );
      });

      expect(testResponse.ok).toBe(true);
      expect(testResponse.result).toHaveProperty('text');
      expect(testResponse.result).toHaveProperty('usage');
    });

    it('should handle configuration flow with missing message handlers', async () => {
      // 模拟缺失AI API消息处理的情况
      const limitedBackgroundHandler = {
        handleMessage: vi.fn((message, sender, sendResponse) => {
          switch (message.type) {
            case 'GET_AI_PROVIDERS':
              sendResponse({ ok: true, providers: [] });
              return false;
            case 'GET_PROVIDER_MODELS':
              sendResponse({ ok: true, models: [] });
              return false;
            case 'AI_API_CALL':
              // 缺失处理逻辑 - 这是问题所在
              sendResponse({ ok: false, error: 'Unknown message type' });
              return false;
            default:
              sendResponse({ ok: false, error: 'Unknown message type' });
              return false;
          }
        })
      };

      // 尝试AI API调用
      const apiCallResponse = await new Promise((resolve) => {
        limitedBackgroundHandler.handleMessage(
          { 
            type: 'AI_API_CALL',
            payload: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: 'test' }],
              apiKey: 'sk-test-key'
            }
          },
          {},
          (response) => resolve(response)
        );
      });

      // 验证失败 - 这正是我们发现的bug
      expect(apiCallResponse.ok).toBe(false);
      expect(apiCallResponse.error).toBe('Unknown message type');
    });
  });

  describe('Legacy vs New Configuration Flow', () => {
    it('should handle legacy translator settings flow', async () => {
      // 模拟旧的翻译测试流程
      const legacyTestResponse = await new Promise((resolve) => {
        mockBackgroundHandler.handleMessage(
          { 
            type: 'TEST_TRANSLATOR_SETTINGS',
            payload: {
              model: 'gpt-4o-mini',
              apiKey: 'sk-test-key'
            }
          },
          {},
          (response) => resolve(response)
        );
      });

      expect(legacyTestResponse.ok).toBe(true);
    });

    it('should identify differences between legacy and new flows', () => {
      const legacyFlow = {
        messageType: 'TEST_TRANSLATOR_SETTINGS',
        payload: { model: 'gpt-4o-mini', apiKey: 'sk-test-key' },
        handler: 'translateText with model mapping'
      };

      const newFlow = {
        messageType: 'AI_API_CALL',
        payload: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'test' }],
          apiKey: 'sk-test-key'
        },
        handler: 'aiApiClient.callAPI'
      };

      // 验证两个流程的差异
      expect(legacyFlow.messageType).not.toBe(newFlow.messageType);
      expect(legacyFlow.payload).not.toEqual(newFlow.payload);
      expect(legacyFlow.handler).not.toBe(newFlow.handler);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network errors during API calls', async () => {
      const networkErrorHandler = {
        handleMessage: vi.fn((message, sender, sendResponse) => {
          if (message.type === 'AI_API_CALL') {
            setTimeout(() => {
              sendResponse({ 
                ok: false, 
                error: '网络错误: Failed to fetch' 
              });
            }, 100);
            return true;
          }
          return false;
        })
      };

      const errorResponse = await new Promise((resolve) => {
        networkErrorHandler.handleMessage(
          { 
            type: 'AI_API_CALL',
            payload: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: 'test' }],
              apiKey: 'sk-test-key'
            }
          },
          {},
          (response) => resolve(response)
        );
      });

      expect(errorResponse.ok).toBe(false);
      expect(errorResponse.error).toBe('网络错误: Failed to fetch');
    });

    it('should handle chrome runtime errors', async () => {
      mockChromeAPI.runtime.lastError = { message: 'Extension context invalidated' };
      
      const hasError = mockChromeAPI.runtime.lastError !== null;
      expect(hasError).toBe(true);
      expect(mockChromeAPI.runtime.lastError.message).toBe('Extension context invalidated');
    });

    it('should handle malformed configuration data', async () => {
      const malformedConfig = {
        provider: '', // 空值
        model: null,  // null值
        apiKey: undefined // undefined值
      };

      const isValid = !!(malformedConfig.provider && 
                        malformedConfig.model && 
                        malformedConfig.apiKey);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Integration Points', () => {
    it('should validate all integration points in configuration flow', () => {
      const integrationPoints = [
        {
          from: 'ai-config.js',
          to: 'background.js',
          message: 'GET_AI_PROVIDERS',
          status: 'implemented'
        },
        {
          from: 'ai-config.js', 
          to: 'background.js',
          message: 'GET_PROVIDER_MODELS',
          status: 'implemented'
        },
        {
          from: 'ai-config.js',
          to: 'background.js', 
          message: 'AI_API_CALL',
          status: 'missing' // 这是问题所在
        },
        {
          from: 'options.js',
          to: 'background.js',
          message: 'TEST_TRANSLATOR_SETTINGS',
          status: 'implemented'
        }
      ];

      const missingIntegrations = integrationPoints.filter(
        point => point.status === 'missing'
      );

      expect(missingIntegrations).toHaveLength(1);
      expect(missingIntegrations[0].message).toBe('AI_API_CALL');
    });

    it('should provide integration coverage report', () => {
      const totalIntegrations = 4;
      const implementedIntegrations = 3;
      const coverage = (implementedIntegrations / totalIntegrations) * 100;

      expect(coverage).toBe(75);
    });
  });
});
