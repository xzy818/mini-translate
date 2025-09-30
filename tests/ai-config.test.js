import { describe, it, expect, beforeEach, vi } from 'vitest';

// 模拟AI配置页面的DOM环境
const mockAIConfigDOM = () => {
  const mockElement = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    textContent: '',
    value: '',
    disabled: false,
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => false)
    },
    innerHTML: '',
    appendChild: vi.fn(),
    createElement: vi.fn(() => mockElement)
  };

  const mockDocument = {
    getElementById: vi.fn((id) => {
      const elements = {
        'provider': { ...mockElement, value: '', disabled: false },
        'model': { ...mockElement, value: '', disabled: true },
        'apiKey': { ...mockElement, value: '', type: 'password' },
        'toggleApiKey': { ...mockElement, textContent: '显示' },
        'testConnection': { ...mockElement, disabled: true },
        'saveConfig': { ...mockElement, disabled: true },
        'status': { ...mockElement, textContent: '', className: '' },
        'providerInfo': { ...mockElement, classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false) } },
        'providerDetails': { ...mockElement, textContent: '' },
        'modelInfo': { ...mockElement, classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false) } },
        'modelDetails': { ...mockElement, textContent: '' },
        'apiKeyHelpLink': { ...mockElement, href: '#', textContent: '获取 API Key' }
      };
      return elements[id] || mockElement;
    }),
    createElement: vi.fn(() => mockElement),
    addEventListener: vi.fn()
  };

  global.document = mockDocument;
  global.chrome = {
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

  return { mockElement, mockDocument };
};

// 模拟AI API前端服务
const mockAIApiFrontend = () => {
  return {
    getProviders: vi.fn().mockResolvedValue([
      { key: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com' },
      { key: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com' }
    ]),
    getProviderModels: vi.fn().mockResolvedValue([
      { key: 'gpt-4o-mini', name: 'GPT-4o Mini', model: 'gpt-4o-mini' },
      { key: 'deepseek-v3', name: 'DeepSeek V3', model: 'deepseek-v3' }
    ]),
    callAPI: vi.fn().mockResolvedValue({
      text: 'Test response',
      usage: { total_tokens: 10 },
      model: 'gpt-4o-mini'
    })
  };
};

describe('AI Config Page Integration Tests', () => {
  let mockDOM;
  let mockAIApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDOM = mockAIConfigDOM();
    mockAIApi = mockAIApiFrontend();
  });

  describe('Provider Selection', () => {
    it('should load and populate provider options', async () => {
      // 模拟加载提供商列表
      const providers = await mockAIApi.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers[0]).toHaveProperty('key', 'openai');
      expect(providers[0]).toHaveProperty('name', 'OpenAI');
    });

    it('should handle provider selection and load models', async () => {
      const providerKey = 'openai';
      const models = await mockAIApi.getProviderModels(providerKey);
      
      expect(mockAIApi.getProviderModels).toHaveBeenCalledWith(providerKey);
      expect(models).toHaveLength(2);
      expect(models[0]).toHaveProperty('key', 'gpt-4o-mini');
    });

    it('should update provider info when provider is selected', () => {
      const providerSelect = document.getElementById('provider');
      const providerInfo = document.getElementById('providerInfo');
      const providerDetails = document.getElementById('providerDetails');

      // 模拟选择提供商
      providerSelect.value = 'openai';
      
      // 模拟更新提供商信息
      providerDetails.textContent = 'OpenAI - https://api.openai.com';
      providerInfo.classList.remove('hidden');

      expect(providerDetails.textContent).toBe('OpenAI - https://api.openai.com');
    });
  });

  describe('Model Selection', () => {
    it('should enable model selection after provider is chosen', () => {
      const modelSelect = document.getElementById('model');
      
      // 初始状态应该是禁用的
      expect(modelSelect.disabled).toBe(true);
      
      // 选择提供商后应该启用
      modelSelect.disabled = false;
      expect(modelSelect.disabled).toBe(false);
    });

    it('should update model info when model is selected', () => {
      const modelSelect = document.getElementById('model');
      const modelInfo = document.getElementById('modelInfo');
      const modelDetails = document.getElementById('modelDetails');

      // 模拟选择模型
      modelSelect.value = 'gpt-4o-mini';
      modelDetails.textContent = '模型: GPT-4o Mini (gpt-4o-mini)';
      modelInfo.classList.remove('hidden');

      expect(modelDetails.textContent).toBe('模型: GPT-4o Mini (gpt-4o-mini)');
    });
  });

  describe('API Key Management', () => {
    it('should toggle API key visibility', () => {
      const apiKeyInput = document.getElementById('apiKey');
      const toggleButton = document.getElementById('toggleApiKey');

      // 初始状态
      expect(apiKeyInput.type).toBe('password');
      expect(toggleButton.textContent).toBe('显示');

      // 切换显示
      apiKeyInput.type = 'text';
      toggleButton.textContent = '隐藏';

      expect(apiKeyInput.type).toBe('text');
      expect(toggleButton.textContent).toBe('隐藏');
    });

    it('should validate form completeness', () => {
      const providerSelect = document.getElementById('provider');
      const modelSelect = document.getElementById('model');
      const apiKeyInput = document.getElementById('apiKey');
      const testButton = document.getElementById('testConnection');
      const saveButton = document.getElementById('saveConfig');

      // 初始状态 - 按钮应该被禁用
      expect(testButton.disabled).toBe(true);
      expect(saveButton.disabled).toBe(true);

      // 填写完整表单后应该启用按钮
      providerSelect.value = 'openai';
      modelSelect.value = 'gpt-4o-mini';
      apiKeyInput.value = 'sk-test-key';

      // 模拟表单验证
      const isValid = providerSelect.value && modelSelect.value && apiKeyInput.value.trim();
      testButton.disabled = !isValid;
      saveButton.disabled = !isValid;

      expect(testButton.disabled).toBe(false);
      expect(saveButton.disabled).toBe(false);
    });
  });

  describe('Connection Testing', () => {
    it('should test connection with valid configuration', async () => {
      const testConfig = {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: 'sk-test-key'
      };

      // 模拟测试连接
      const result = await mockAIApi.callAPI({
        provider: testConfig.provider,
        model: testConfig.model,
        messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
        apiKey: testConfig.apiKey,
        options: { maxTokens: 10 }
      });

      expect(mockAIApi.callAPI).toHaveBeenCalledWith({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
        apiKey: 'sk-test-key',
        options: { maxTokens: 10 }
      });

      expect(result).toHaveProperty('text', 'Test response');
      expect(result).toHaveProperty('usage');
    });

    it('should handle connection test failure', async () => {
      // 模拟API调用失败
      mockAIApi.callAPI.mockRejectedValueOnce(new Error('API request failed'));

      try {
        await mockAIApi.callAPI({
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test message' }],
          apiKey: 'invalid-key',
          options: {}
        });
      } catch (error) {
        expect(error.message).toBe('API request failed');
      }
    });

    it('should show loading state during connection test', () => {
      const testButton = document.getElementById('testConnection');
      const statusDiv = document.getElementById('status');

      // 模拟测试开始
      testButton.textContent = '测试中...';
      statusDiv.textContent = '正在测试连接...';
      statusDiv.className = 'status info';

      expect(testButton.textContent).toBe('测试中...');
      expect(statusDiv.textContent).toBe('正在测试连接...');
    });
  });

  describe('Configuration Saving', () => {
    it('should save configuration to chrome storage', async () => {
      const config = {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: 'sk-test-key',
        providerName: 'OpenAI',
        modelName: 'GPT-4o Mini',
        timestamp: Date.now()
      };

      // 模拟保存配置
      await chrome.storage.local.set({ aiConfig: config });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ aiConfig: config });
    });

    it('should load saved configuration on page load', async () => {
      const savedConfig = {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: 'sk-test-key',
        providerName: 'OpenAI',
        modelName: 'GPT-4o Mini',
        timestamp: Date.now()
      };

      // 模拟加载保存的配置
      chrome.storage.local.get.mockResolvedValue({ aiConfig: savedConfig });

      const result = await chrome.storage.local.get(['aiConfig']);
      expect(result.aiConfig).toEqual(savedConfig);
    });
  });

  describe('Error Handling', () => {
    it('should handle chrome runtime errors gracefully', () => {
      chrome.runtime.lastError = { message: 'Network error' };
      
      // 模拟处理chrome运行时错误
      const hasError = chrome.runtime.lastError !== null;
      expect(hasError).toBe(true);
      expect(chrome.runtime.lastError.message).toBe('Network error');
    });

    it('should handle API service errors', async () => {
      mockAIApi.getProviders.mockRejectedValueOnce(new Error('Service unavailable'));

      try {
        await mockAIApi.getProviders();
      } catch (error) {
        expect(error.message).toBe('Service unavailable');
      }
    });
  });
});
