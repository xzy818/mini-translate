import {
  initializeBackground,
  handleAddTerm,
  handleRemoveTerm,
  handleTogglePage,
  updateMenuForInfo
} from '../src/services/context-menu.js';
import {
  translateText,
  validateTranslationConfig,
  TRANSLATION_ERRORS
} from '../src/services/translator.js';
import { AIApiClient } from '../src/services/ai-api-client.js';
import { MODEL_PROVIDERS, getProviderConfig } from '../src/config/model-providers.js';

let initialized = false;
let aiApiClient = null;
 
// 根据模型映射 Base URL（内部使用）
function mapBaseUrlByModel(model) {
  switch (model) {
    case 'deepseek-v3':
      return 'https://api.deepseek.com';
    case 'qwen-mt-turbo':
    case 'qwen-mt-plus':
      return 'https://dashscope.aliyuncs.com/compatible-mode';
    case 'gpt-4o-mini':
      return 'https://api.openai.com';
    default:
      return '';
  }
}

function setup() {
  if (initialized) return;
  initializeBackground(chrome);
  aiApiClient = new AIApiClient();
  initialized = true;
}

self.addEventListener('unhandledrejection', (event) => {
  console.error('[qa] unhandled rejection', event.reason);
});

self.addEventListener('error', (event) => {
  console.error('[qa] worker error', event.message, event.error);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }
  console.warn('[qa] message received', message.type);
  // 统一日志，便于排查未覆盖类型
  // 调试日志（按eslint策略仅在error路径使用console）

  // AI API 相关消息处理
  if (message.type === 'AI_API_CALL') {
    const { provider, model, messages, apiKey, options, requestId } = message.payload || {};
    
    if (!aiApiClient) {
      sendResponse({ ok: false, error: 'AI API client not initialized', requestId });
      return false;
    }

    try {
      const result = await aiApiClient.callAPI({
        provider,
        model,
        messages,
        apiKey,
        options
      });
      
      sendResponse({ ok: true, result, requestId });
    } catch (error) {
      console.error('[AI API] Call failed:', error);
      sendResponse({ ok: false, error: error.message, requestId });
    }
    return true;
  }

  if (message.type === 'GET_AI_PROVIDERS') {
    try {
      const providers = Object.entries(MODEL_PROVIDERS).map(([key, provider]) => ({
        key,
        name: provider.name,
        baseUrl: provider.baseUrl
      }));
      sendResponse({ ok: true, providers });
    } catch (error) {
      console.error('[AI API] Get providers failed:', error);
      sendResponse({ ok: false, error: error.message });
    }
    return true;
  }

  if (message.type === 'GET_PROVIDER_MODELS') {
    const { provider } = message.payload || {};
    
    try {
      const providerConfig = MODEL_PROVIDERS[provider];
      if (!providerConfig) {
        sendResponse({ ok: false, error: `Unsupported provider: ${provider}` });
        return false;
      }

      const models = Object.entries(providerConfig.models).map(([key, model]) => ({
        key,
        name: key,
        model: model
      }));
      
      sendResponse({ ok: true, models });
    } catch (error) {
      console.error('[AI API] Get provider models failed:', error);
      sendResponse({ ok: false, error: error.message });
    }
    return true;
  }

  if (message.type === 'SETTINGS_UPDATED') {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'TEST_TRANSLATOR_SETTINGS') {
    const config = message.payload || {};
    const computedBase = mapBaseUrlByModel(config.model);
    const validation = validateTranslationConfig({ ...config, apiBaseUrl: computedBase });
    if (!validation.isValid) {
      console.error('[qa:test] validation failed', validation.errors);
      sendResponse({ ok: false, error: validation.errors.join('、') });
      return false;
    }

    console.warn('[qa:test] start', { model: config.model, apiBaseUrl: computedBase });
    translateText({
      text: 'diagnostic check',
      model: config.model,
      apiKey: config.apiKey,
      apiBaseUrl: computedBase,
      timeout: 5000
    })
      .then(() => {
        console.warn('[qa:test] success');
        sendResponse({ ok: true });
      })
      .catch((error) => {
        const message = error?.message || '测试失败';
        const label = error?.type === TRANSLATION_ERRORS.TIMEOUT ? '[qa:test] timeout' : '[qa:test] error';
        console.warn(label, message);
        sendResponse({ ok: false, error: message });
      });
    return true;
  }

  if (message.type === 'TRANSLATE_TERM') {
    translateText(message.payload)
      .then((translation) => {
        sendResponse({ ok: true, translation });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || '翻译失败' });
      });
    return true; // keep channel open for async response
  }

  if (message.type === 'RETRY_TRANSLATION') {
    const { term } = message.payload;
    if (!term) {
      sendResponse({ ok: false, error: '缺少要重新翻译的词汇' });
      return false;
    }

    // 获取当前设置并处理异步操作
    chrome.storage.local.get(['model', 'apiKey'], async (settings) => {
      const { model, apiKey } = settings;
      const apiBaseUrl = mapBaseUrlByModel(model);
      if (!model || !apiKey || !apiBaseUrl) {
        sendResponse({ ok: false, error: '翻译配置不完整' });
        return;
      }

      try {
        // 重新翻译
        const translation = await translateText({
          text: term,
          model,
          apiKey,
          apiBaseUrl
        });

        // 更新词库中的翻译结果
        const vocabData = await chrome.storage.local.get(['vocabulary']);
        const vocabulary = vocabData.vocabulary || [];
        
        const updatedVocabulary = vocabulary.map(item => {
          if (item.term === term) {
            return {
              ...item,
              translation,
              status: 'active',
              updatedAt: new Date().toISOString()
            };
          }
          return item;
        });

        await chrome.storage.local.set({ vocabulary: updatedVocabulary });

        // 发送词库更新事件
        chrome.runtime.sendMessage({ type: 'VOCAB_UPDATED', payload: { retried: term } });

        sendResponse({ ok: true, translation });
      } catch (error) {
        console.error('重新翻译失败:', error);
        sendResponse({ ok: false, error: error.message || '重新翻译失败' });
      }
    });
    return true; // keep channel open for async response
  }

  // 保存设置：仅作为通知类，持久化后回执（不再保存 apiBaseUrl）
  if (message.type === 'SAVE_SETTINGS') {
    const { model, apiKey } = message.payload || {};
    chrome.storage.local.set({ model, apiKey }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        sendResponse({ ok: false, error: err.message });
        return;
      }
      // 广播"设置已更新"事件（前端不必须监听）
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', payload: { model } });
      sendResponse({ ok: true });
    });
    return true; // async
  }

  // 刷新右键菜单等（幂等操作）
  if (message.type === 'REFRESH_CONTEXT_MENU') {
    try {
      initializeBackground(chrome);
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true; // 保持一致
  }

  if (message.type === 'QA_CONTEXT_ADD') {
    const selectionText = (message.payload?.selectionText || '').trim();
    const info = { selectionText };
    const tabId = sender?.tab?.id ?? null;
    console.warn('[qa] add selection', selectionText, 'tab', tabId);
    handleAddTerm(chrome, info, tabId)
      .then(async (result) => {
        console.warn('[qa] add result', result);
        if (result.ok) {
          await updateMenuForInfo(chrome, info, tabId);
        }
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || 'ADD_FAILED' });
      });
    return true;
  }

  if (message.type === 'QA_CONTEXT_REMOVE') {
    const selectionText = (message.payload?.selectionText || '').trim();
    const info = { selectionText };
    const tabId = sender?.tab?.id ?? null;
    console.warn('[qa] remove selection', selectionText, 'tab', tabId);
    handleRemoveTerm(chrome, info, tabId)
      .then(async (result) => {
        console.warn('[qa] remove result', result);
        if (result.ok) {
          await updateMenuForInfo(chrome, info, tabId);
        }
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || 'REMOVE_FAILED' });
      });
    return true;
  }

  if (message.type === 'QA_CONTEXT_TOGGLE') {
    const tabId = sender?.tab?.id ?? null;
    console.warn('[qa] toggle request', tabId);
    handleTogglePage(chrome, tabId ?? 0)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || 'TOGGLE_FAILED' });
      });
    return true;
  }

  if (message.type === 'QA_GET_STORAGE_STATE') {
    const includeSession = message.payload?.includeSession !== false;
    chrome.storage.local.get(null, (localData) => {
      const localError = chrome.runtime.lastError;
      if (localError) {
        sendResponse({ ok: false, error: localError.message || '无法读取 storage.local' });
        return;
      }
      if (!includeSession || !chrome.storage?.session) {
        sendResponse({ ok: true, local: localData, session: {} });
        return;
      }
      chrome.storage.session.get(null, (sessionData) => {
        const sessionError = chrome.runtime.lastError;
        if (sessionError) {
          sendResponse({ ok: false, error: sessionError.message || '无法读取 storage.session' });
          return;
        }
        sendResponse({ ok: true, local: localData, session: sessionData });
      });
    });
    return true;
  }

  // AI API 消息处理
  if (message.type === 'AI_API_CALL') {
    const { provider, model, messages, apiKey, options, requestId } = message.payload;
    
    // 模拟AI API调用（实际实现需要导入aiApiClient）
    setTimeout(() => {
      sendResponse({ 
        ok: true, 
        result: { 
          text: 'AI API response', 
          usage: { total_tokens: 10 },
          model: model 
        },
        requestId: requestId
      });
    }, 100);
    return true;
  }

  if (message.type === 'GET_AI_PROVIDERS') {
    const providers = [
      { key: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com' },
      { key: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
      { key: 'qwen', name: 'Qwen (通义千问)', baseUrl: 'https://dashscope.aliyuncs.com' }
    ];
    sendResponse({ ok: true, providers });
    return false;
  }

  if (message.type === 'GET_PROVIDER_MODELS') {
    const { provider } = message.payload;
    let models = [];
    
    switch (provider) {
      case 'openai':
        models = [
          { key: 'gpt-4o-mini', name: 'GPT-4o Mini', model: 'gpt-4o-mini' }
        ];
        break;
      case 'deepseek':
        models = [
          { key: 'deepseek-v3', name: 'DeepSeek V3', model: 'deepseek-v3' }
        ];
        break;
      case 'qwen':
        models = [
          { key: 'qwen-mt-turbo', name: 'Qwen MT Turbo', model: 'qwen-mt-turbo' },
          { key: 'qwen-mt-plus', name: 'Qwen MT Plus', model: 'qwen-mt-plus' }
        ];
        break;
      default:
        models = [];
    }
    
    sendResponse({ ok: true, models });
    return false;
  }

  // QA 消息处理 (仅在 QA build 中启用)
  if (process.env.MT_QA_HOOKS === '1') {
    const tabId = Number.isInteger(message.payload?.tabId) 
      ? message.payload.tabId 
      : sender?.tab?.id ?? null;

    switch (message.type) {
      case 'QA_APPLY_TERM':
        console.warn('[qa:msg] QA_APPLY_TERM', { tabId, term: message.payload?.term });
        handleAddTerm(chrome, message.payload, tabId)
          .then((result) => {
            sendResponse({ ok: true, ...result });
          })
          .catch((error) => {
            sendResponse({ ok: false, error: error.message });
          });
        return true;

      case 'QA_REMOVE_TERM':
        console.warn('[qa:msg] QA_REMOVE_TERM', { tabId, term: message.payload?.term });
        handleRemoveTerm(chrome, message.payload, tabId)
          .then(() => {
            sendResponse({ ok: true });
          })
          .catch((error) => {
            sendResponse({ ok: false, error: error.message });
          });
        return true;

      case 'QA_QUERY_TERM':
        console.warn('[qa:msg] QA_QUERY_TERM', { tabId, term: message.payload?.term });
        resolveTermState(tabId, message.payload.term)
          .then((state) => {
            sendResponse({ ok: true, state });
          })
          .catch((error) => {
            sendResponse({ ok: false, error: error.message });
          });
        return true;

      case 'QA_RESET_WORKER':
        console.warn('[qa:msg] QA_RESET_WORKER');
        chrome.runtime.reload();
        waitForInitialization()
          .then(() => {
            sendResponse({ ok: true, reloaded: true });
          })
          .catch((error) => {
            sendResponse({ ok: false, error: error.message });
          });
        return true;

      case 'QA_WHOAMI':
        console.warn('[qa:msg] QA_WHOAMI', { tabId });
        sendResponse({ ok: true, tabId });
        return true;
    }
  }

  // 未识别消息：显式返回 false，避免悬空端口
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  setup();
});

chrome.runtime.onStartup.addListener(() => {
  setup();
});

// QA 辅助函数
async function resolveTermState(tabId, term) {
  try {
    // 从 storage 中查询词条状态
    const result = await chrome.storage.local.get(['vocabulary']);
    const vocabulary = result.vocabulary || [];
    
    const termEntry = vocabulary.find(item => item.term === term);
    if (!termEntry) {
      return { applied: false, lastAction: null };
    }
    
    return {
      applied: termEntry.status === 'active',
      lastAction: termEntry.updatedAt || termEntry.createdAt,
      translation: termEntry.translation
    };
  } catch (error) {
    throw new Error(`查询词条状态失败: ${error.message}`);
  }
}

function waitForInitialization() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Service Worker 重启超时'));
    }, 5000);
    
    // 等待初始化完成
    const checkInitialized = () => {
      if (initialized) {
        clearTimeout(timeout);
        resolve();
      } else {
        setTimeout(checkInitialized, 100);
      }
    };
    
    checkInitialized();
  });
}

setup();
