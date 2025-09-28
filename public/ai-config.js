// AI 配置页面逻辑
// 实现两级选择：提供商 -> 模型，自动匹配 URL

import { aiApiFrontend } from '../src/services/ai-api-frontend.js';
import { configManager } from '../src/services/config-manager.js';
import { configValidator } from '../src/services/config-validator.js';
import { monitorService } from '../src/services/monitor-service.js';

class AIConfigManager {
  constructor() {
    this.providers = [];
    this.currentProvider = null;
    this.currentModel = null;
    
    this.initElements();
    this.loadProviders();
    this.bindEvents();
    this.loadSavedConfig();
  }

  initElements() {
    this.providerSelect = document.getElementById('provider');
    this.modelSelect = document.getElementById('model');
    this.apiKeyInput = document.getElementById('apiKey');
    this.testButton = document.getElementById('testConnection');
    this.saveButton = document.getElementById('saveConfig');
    this.statusDiv = document.getElementById('status');
    this.providerInfo = document.getElementById('providerInfo');
    this.providerDetails = document.getElementById('providerDetails');
    this.modelInfo = document.getElementById('modelInfo');
    this.modelDetails = document.getElementById('modelDetails');
    this.apiKeyHelpLink = document.getElementById('apiKeyHelpLink');
  }

  async loadProviders() {
    try {
      // 初始化配置管理器
      await configManager.loadProviderConfigs();
      
      // 获取提供商列表
      this.providers = configManager.getAllProvidersList();
      this.populateProviderSelect();
      
      // 记录加载成功
      monitorService.logRequest('system', 'providers', Date.now(), true, 0, null, null, this.providers.length);
    } catch (error) {
      monitorService.logRequest('system', 'providers', 'failure', Date.now(), error.constructor.name, error.message, null);
      this.showStatus('加载服务商列表失败: ' + error.message, 'error');
    }
  }

  populateProviderSelect() {
    this.providerSelect.innerHTML = '<option value="">请选择服务商...</option>';
    
    this.providers.forEach(provider => {
      const option = document.createElement('option');
      option.value = provider.key;
      option.textContent = provider.name;
      this.providerSelect.appendChild(option);
    });
  }

  async loadModels(providerKey) {
    try {
      // 使用配置管理器获取模型列表
      const models = configManager.getModelsListForProvider(providerKey);
      const modelList = models.map(model => ({
        key: model.key,
        name: model.name,
        model: model.key
      }));
      
      this.populateModelSelect(modelList);
      this.currentProvider = this.providers.find(p => p.key === providerKey);
      this.updateProviderInfo();
      
      // 记录模型加载
      monitorService.logRequest(providerKey, 'models', Date.now(), true, 0, null, null, models.length);
    } catch (error) {
      monitorService.logRequest(providerKey, 'models', 'failure', Date.now(), error.constructor.name, error.message, null);
      this.showStatus('加载模型列表失败: ' + error.message, 'error');
    }
  }

  populateModelSelect(models) {
    this.modelSelect.innerHTML = '<option value="">请选择模型...</option>';
    
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.key;
      option.textContent = `${model.name} (${model.model})`;
      this.modelSelect.appendChild(option);
    });
    
    this.modelSelect.disabled = false;
  }

  updateProviderInfo() {
    if (this.currentProvider) {
      this.providerDetails.textContent = `${this.currentProvider.name} - ${this.currentProvider.baseUrl}`;
      this.providerInfo.classList.remove('hidden');
      this.updateApiKeyHelp();
    } else {
      this.providerInfo.classList.add('hidden');
    }
  }

  updateModelInfo() {
    if (this.currentModel) {
      this.modelDetails.textContent = `模型: ${this.currentModel.name} (${this.currentModel.model})`;
      this.modelInfo.classList.remove('hidden');
    } else {
      this.modelInfo.classList.add('hidden');
    }
  }

  updateApiKeyHelp() {
    if (!this.currentProvider) return;
    
    const helpUrls = {
      'openai': 'https://platform.openai.com/api-keys',
      'anthropic': 'https://console.anthropic.com/',
      'gemini': 'https://makersuite.google.com/app/apikey',
      'deepseek': 'https://platform.deepseek.com/api_keys',
      'qwen': 'https://dashscope.console.aliyun.com/apiKey'
    };
    
    const helpTexts = {
      'openai': 'OpenAI API Keys',
      'anthropic': 'Anthropic API Keys',
      'gemini': 'Google AI Studio API Key',
      'deepseek': 'DeepSeek API Keys',
      'qwen': '阿里云 DashScope API Key'
    };
    
    this.apiKeyHelpLink.href = helpUrls[this.currentProvider.key] || '#';
    this.apiKeyHelpLink.textContent = helpTexts[this.currentProvider.key] || '获取 API Key';
  }

  bindEvents() {
    this.providerSelect.addEventListener('change', (e) => {
      const providerKey = e.target.value;
      if (providerKey) {
        this.loadModels(providerKey);
        this.checkFormValidity();
      } else {
        this.modelSelect.innerHTML = '<option value="">请先选择服务商</option>';
        this.modelSelect.disabled = true;
        this.providerInfo.classList.add('hidden');
        this.modelInfo.classList.add('hidden');
        this.checkFormValidity();
      }
    });

    this.modelSelect.addEventListener('change', (e) => {
      const modelKey = e.target.value;
      if (modelKey) {
        this.currentModel = {
          key: modelKey,
          name: e.target.options[e.target.selectedIndex].textContent,
          model: e.target.options[e.target.selectedIndex].textContent.match(/\(([^)]+)\)/)?.[1] || modelKey
        };
        this.updateModelInfo();
      } else {
        this.modelInfo.classList.add('hidden');
        this.currentModel = null;
      }
      this.checkFormValidity();
    });

    this.apiKeyInput.addEventListener('input', () => {
      this.checkFormValidity();
    });

    this.testButton.addEventListener('click', () => {
      this.testConnection();
    });

    this.saveButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.saveConfig();
    });
  }

  checkFormValidity() {
    const isValid = this.providerSelect.value && 
                   this.modelSelect.value && 
                   this.apiKeyInput.value.trim();
    
    this.testButton.disabled = !isValid;
    this.saveButton.disabled = !isValid;
  }

  async testConnection() {
    if (!this.validateForm()) return;
    
    this.setLoading(true);
    this.showStatus('正在测试连接...', 'info');
    
    const startTime = Date.now();
    
    try {
      const result = await aiApiFrontend.callAPI({
        provider: this.providerSelect.value,
        model: this.modelSelect.value,
        messages: [
          { role: 'user', content: 'Hello, this is a test message.' }
        ],
        apiKey: this.apiKeyInput.value.trim(),
        options: { maxTokens: 10 }
      });
      
      const duration = Date.now() - startTime;
      
      // 记录成功的测试
      monitorService.logRequest(
        this.providerSelect.value,
        this.modelSelect.value,
        'success',
        duration,
        null,
        null,
        result.tokens || 0
      );
      
      this.showStatus('✅ 连接测试成功！模型响应正常。', 'success');
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 记录失败的测试
      monitorService.logRequest(
        this.providerSelect.value,
        this.modelSelect.value,
        'failure',
        duration,
        error.constructor.name,
        error.message,
        null
      );
      
      this.showStatus('❌ 连接测试失败: ' + error.message, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async saveConfig() {
    if (!this.validateForm()) return;
    
    this.setLoading(true);
    this.showStatus('正在保存配置...', 'info');
    
    try {
      const config = {
        provider: this.providerSelect.value,
        model: this.modelSelect.value,
        apiKey: this.apiKeyInput.value.trim(),
        providerName: this.currentProvider.name,
        modelName: this.currentModel.name,
        timestamp: Date.now()
      };
      
      // 使用配置管理器保存配置
      await configManager.saveUserConfig(config);
      
      // 记录配置保存
      monitorService.logRequest('system', 'config_save', 'success', Date.now(), null, null, null);
      
      this.showStatus('✅ 配置保存成功！', 'success');
      
      // 延迟跳转回主页面
      setTimeout(() => {
        window.close();
      }, 1500);
    } catch (error) {
      monitorService.logRequest('system', 'config_save', 'failure', Date.now(), error.constructor.name, error.message, null);
      this.showStatus('❌ 保存配置失败: ' + error.message, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  validateForm() {
    if (!this.providerSelect.value) {
      this.showStatus('请选择 AI 服务商', 'error');
      return false;
    }
    
    if (!this.modelSelect.value) {
      this.showStatus('请选择模型', 'error');
      return false;
    }
    
    if (!this.apiKeyInput.value.trim()) {
      this.showStatus('请输入 API Key', 'error');
      return false;
    }
    
    // 使用配置验证器进行验证
    try {
      const config = {
        provider: this.providerSelect.value,
        model: this.modelSelect.value,
        apiKey: this.apiKeyInput.value.trim()
      };
      
      configValidator.validateUserConfig(config);
      return true;
    } catch (error) {
      this.showStatus('配置验证失败: ' + error.message, 'error');
      return false;
    }
  }

  async loadSavedConfig() {
    try {
      // 使用配置管理器加载保存的配置
      const config = await configManager.loadUserConfig();
      if (config) {
        // 恢复提供商选择
        this.providerSelect.value = config.provider;
        if (config.provider) {
          await this.loadModels(config.provider);
          
          // 恢复模型选择
          this.modelSelect.value = config.model;
          if (config.model) {
            this.currentModel = {
              key: config.model,
              name: config.modelName || config.model,
              model: config.model
            };
            this.updateModelInfo();
          }
        }
        
        // 恢复 API Key
        this.apiKeyInput.value = config.apiKey || '';
        
        this.checkFormValidity();
        this.showStatus('已加载保存的配置', 'info');
      }
    } catch (error) {
      monitorService.logRequest('system', 'config_load', 'failure', Date.now(), error.constructor.name, error.message, null);
      console.error('加载配置失败:', error);
    }
  }

  showStatus(message, type) {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
    this.statusDiv.classList.remove('hidden');
    
    // 自动隐藏成功消息
    if (type === 'success') {
      setTimeout(() => {
        this.statusDiv.classList.add('hidden');
      }, 3000);
    }
  }

  setLoading(loading) {
    if (loading) {
      document.body.classList.add('loading');
      this.testButton.textContent = '测试中...';
      this.saveButton.textContent = '保存中...';
    } else {
      document.body.classList.remove('loading');
      this.testButton.textContent = '测试连接';
      this.saveButton.textContent = '保存配置';
    }
  }
}

// 初始化配置管理器
document.addEventListener('DOMContentLoaded', () => {
  new AIConfigManager();
});
