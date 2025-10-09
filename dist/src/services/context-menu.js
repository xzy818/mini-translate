import {
  appendVocabulary,
  removeVocabulary,
  readVocabulary,
  readSettings,
  toggleTabState,
  removeTabState,
  readTabState,
  MAX_VOCAB
} from './storage.js';
import { validateTerm } from './vocab-core.js';
import { translateText as translateTextDefault } from './translator.js';
import { mapBaseUrlByModel } from './model-utils.js';

export const MENU_ID = 'mini-translate-action';

const menuState = new Map();
const injectedTabs = new Set();
let tabRemovalListenerRegistered = false;
let translateTextImpl = translateTextDefault;

// 仅供测试覆盖使用：允许注入 mock 翻译实现
export function __setTranslateTextImplementation(fn) {
  translateTextImpl = typeof fn === 'function' ? fn : translateTextDefault;
}

export function __resetTranslateTextImplementation() {
  translateTextImpl = translateTextDefault;
}

function buildTabKey(tabId) {
  return Number.isInteger(tabId) ? tabId : 'global';
}

function setMenuContext(chromeLike, tabKey, context) {
  if (context) {
    chromeLike.contextMenus.update(MENU_ID, {
      visible: true,
      title: context.title
    });
    menuState.set(tabKey, context);
  } else {
    chromeLike.contextMenus.update(MENU_ID, { visible: false });
    menuState.delete(tabKey);
  }
}

export async function updateMenuForInfo(chromeLike, info, tabId) {
  try {
    const context = await resolveMenuContext(chromeLike, info, tabId);
    const key = buildTabKey(tabId);
    setMenuContext(chromeLike, key, context);
  } catch (error) {
    console.warn('Failed to resolve menu context', error);
  }
}

function registerTabRemovalCleanup(chromeLike) {
  if (tabRemovalListenerRegistered || !chromeLike?.tabs?.onRemoved?.addListener) {
    return;
  }
  chromeLike.tabs.onRemoved.addListener((removedTabId) => {
    if (Number.isInteger(removedTabId)) {
      injectedTabs.delete(removedTabId);
    }
  });
  tabRemovalListenerRegistered = true;
}

async function ensureContentScript(chromeLike, tabId) {
  if (!Number.isInteger(tabId) || !chromeLike?.scripting?.executeScript) {
    return;
  }
  registerTabRemovalCleanup(chromeLike);
  if (injectedTabs.has(tabId)) {
    return;
  }
  try {
    await new Promise((resolve, reject) => {
      chromeLike.scripting.executeScript(
        {
          target: { tabId },
          files: ['content.js']
        },
        () => {
          const err = chromeLike.runtime?.lastError;
          if (err) {
            reject(new Error(err.message));
            return;
          }
          resolve();
        }
      );
    });
    injectedTabs.add(tabId);
  } catch (error) {
    console.warn('[qa] content script injection failed', { tabId, message: error.message });
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TAB_MESSAGE_RETRY_DELAYS = [120, 250, 600];

export async function safeSendMessage(chromeLike, tabId, payload) {
  if (!Number.isInteger(tabId)) {
    return;
  }

  const attemptSend = () => new Promise((resolve, reject) => {
    try {
      chromeLike.tabs.sendMessage(tabId, payload, () => {
        const error = chromeLike.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });

  for (let attempt = 0; attempt <= TAB_MESSAGE_RETRY_DELAYS.length; attempt += 1) {
    try {
      await attemptSend();
      return;
    } catch (error) {
      const message = String(error?.message || '');
      if (!shouldRetryConnectionError(message) || attempt === TAB_MESSAGE_RETRY_DELAYS.length) {
        if (!shouldRetryConnectionError(message)) {
          console.warn('tabs.sendMessage failed', message);
        }
        return;
      }
      await ensureContentScript(chromeLike, tabId);
      const delayMs = TAB_MESSAGE_RETRY_DELAYS[attempt] ?? TAB_MESSAGE_RETRY_DELAYS.at(-1);
      await delay(delayMs);
    }
  }
}

function inferType(term) {
  return term.split(/\s+/).length > 1 ? 'phrase' : 'word';
}

const CONNECTION_ERROR_PATTERNS = [
  'Could not establish connection',
  'Receiving end does not exist',
  'The message port closed'
];

function shouldRetryConnectionError(message) {
  if (typeof message !== 'string') {
    return false;
  }
  return CONNECTION_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

async function translateTerm(chromeLike, text) {
  const settings = await readSettings(chromeLike);
  const { model, apiKey } = settings;

  if (!model || !apiKey) {
    return { ok: false, reason: 'INVALID_SETTINGS' };
  }

  const apiBaseUrl = mapBaseUrlByModel(model);
  if (!apiBaseUrl) {
    return { ok: false, reason: 'UNSUPPORTED_MODEL', meta: { model } };
  }

  try {
    const translation = await translateTextImpl({
      text: text.trim(),
      model,
      apiKey,
      apiBaseUrl
    });
    return { ok: true, translation };
  } catch (error) {
    const fallbackMeta = { model, apiBaseUrl };
    const meta = error?.meta
      ? {
          model: error.meta.model || fallbackMeta.model,
          apiBaseUrl: error.meta.url || error.meta.apiBaseUrl || fallbackMeta.apiBaseUrl
        }
      : fallbackMeta;
    return {
      ok: false,
      reason: error?.message || '翻译失败，请稍后重试。',
      error,
      meta
    };
  }
}

export async function handleAddTerm(chromeLike, info, tabId) {
  const selectionText = (info.selectionText || '').trim();
  if (!selectionText) {
    return { ok: false, reason: 'EMPTY_SELECTION' };
  }
  const validity = validateTerm({ term: selectionText });
  if (!validity.ok) {
    return { ok: false, reason: validity.error };
  }
  const translationResult = await translateTerm(chromeLike, selectionText);
  if (!translationResult.ok && translationResult.reason === 'INVALID_SETTINGS') {
    notify(chromeLike, '请先在扩展设置中配置模型和 API Key。');
    return { ok: false, reason: 'INVALID_SETTINGS' };
  }
  if (!translationResult.ok && translationResult.error) {
    try {
      console.error('[translate] term failed', translationResult.meta || {}, translationResult.error);
    } catch (_) {
      // ignore logging failures in test environments
    }
  }
  // 修复：确保翻译结果不为空，避免显示"T"
  const translation = translationResult.ok && translationResult.translation 
    ? translationResult.translation.trim() 
    : '';

  const payload = {
    term: selectionText,
    translation,
    type: inferType(selectionText),
    status: translationResult.ok && translation ? 'active' : 'error'
  };

  const upserted = await appendVocabulary(chromeLike, payload);
  if (upserted.error === 'LIMIT_EXCEEDED') {
    return { ok: false, reason: 'LIMIT_EXCEEDED', count: MAX_VOCAB };
  }
  if (translationResult.ok) {
    if (Number.isInteger(tabId)) {
      await safeSendMessage(chromeLike, tabId, {
        type: 'APPLY_TRANSLATION',
        payload
      });
    }
    notify(chromeLike, `已添加词条：${selectionText}`);
  } else {
    const reason = translationResult.reason || '翻译失败，请稍后重试。';
    notify(chromeLike, reason);
  }
  chromeLike.runtime.sendMessage({ type: 'VOCAB_UPDATED', payload: { added: payload } });
  return { ok: true, payload };
}

export async function handleRemoveTerm(chromeLike, info, tabId) {
  const term = (info.selectionText || '').trim();
  if (!term) {
    return { ok: false, reason: 'EMPTY_SELECTION' };
  }
  const removed = await removeVocabulary(chromeLike, term);
  if (!removed.removed) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  if (Number.isInteger(tabId)) {
    await safeSendMessage(chromeLike, tabId, {
      type: 'REMOVE_TRANSLATION',
      payload: { term }
    });
  }
  chromeLike.runtime.sendMessage({ type: 'VOCAB_UPDATED', payload: { removed: term } });
  notify(chromeLike, `已移除词条：${term}`);
  return { ok: true };
}

export async function handleTogglePage(chromeLike, tabId) {
  const enabled = await toggleTabState(chromeLike, tabId);
  const vocabulary = await readVocabulary(chromeLike);
  if (Number.isInteger(tabId)) {
    await safeSendMessage(chromeLike, tabId, {
      type: enabled ? 'TRANSLATE_ALL' : 'RESET_PAGE',
      payload: { vocabulary }
    });
  }
  notify(
    chromeLike,
    enabled ? '已在当前页面启用 Mini Translate。' : '已在当前页面停用 Mini Translate。',
    'Mini Translate'
  );
  return { ok: true, enabled };
}

function notify(chromeLike, message, title = 'Mini Translate') {
  chromeLike.notifications?.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title,
    message
  });
}

function buildToggleMenuTitle(enabled, vocabulary) {
  const baseTitle = enabled ? 'stop mini-translate' : 'start mini-translate';
  const latest = [...vocabulary]
    .reverse()
    .find((entry) => entry && entry.translation && entry.status !== 'error');
  if (!latest) {
    return baseTitle;
  }
  return `${baseTitle} · 最近词: ${latest.term}`;
}

function buildSelectionMenuTitle(term, exists, vocabulary) {
  if (!exists) {
    return `add & mini-translate · 选中: ${term}`;
  }
  const entry = vocabulary.find((item) => item.term === term);
  const translation = entry?.translation ? ` → ${entry.translation}` : '';
  return `remove from mini-translate · 选中: ${term}${translation}`;
}

async function resolveMenuContext(chromeLike, info, tabId) {
  const selection = (info.selectionText || '').trim();
  const vocabulary = await readVocabulary(chromeLike);
  const states = await readTabState(chromeLike);
  const tabEnabled = Number.isInteger(tabId) ? Boolean(states[tabId]?.enabled) : false;

  if (selection) {
    const exists = vocabulary.some((entry) => entry.term === selection);
    const title = buildSelectionMenuTitle(selection, exists, vocabulary);

    if (!exists) {
      return {
        title,
        execute: async () => {
          const result = await handleAddTerm(chromeLike, info, tabId);
          if (!result.ok) {
            if (result.reason === 'LIMIT_EXCEEDED') {
              notify(chromeLike, '词库已满 (500)，请删除后再添加。');
            }
          }
        }
      };
    }

    return {
      title,
      execute: async () => {
        const result = await handleRemoveTerm(chromeLike, info, tabId);
        if (!result.ok) {
          notify(chromeLike, '未找到对应词条。');
        }
      }
    };
  }

  const title = buildToggleMenuTitle(tabEnabled, vocabulary);
  return {
    title,
    execute: async () => {
      const targetTabId = Number.isInteger(tabId) ? tabId : info?.tabId ?? null;
      if (!Number.isInteger(targetTabId)) {
        notify(chromeLike, '无法识别当前页面，暂时无法切换。');
        return;
      }
      await handleTogglePage(chromeLike, targetTabId);
    }
  };
}

export async function createContextMenus(chromeLike) {
  chromeLike.contextMenus.removeAll(() => {
    chromeLike.contextMenus.create({
      id: MENU_ID,
      title: 'start mini-translate',
      contexts: ['all']
    });
  });
}

export function registerHandlers(chromeLike) {
  chromeLike.contextMenus.onClicked.addListener(async (info, tab) => {
    const tabId = tab?.id;
    const key = buildTabKey(tabId);
    let context = menuState.get(key);
    if (!context) {
      context = await resolveMenuContext(chromeLike, info, tabId);
      if (context) {
        setMenuContext(chromeLike, key, context);
      }
    }
    if (!context) {
      return;
    }
    await context.execute();
    // Refresh menu state after action execution to reflect latest scenario.
    await updateMenuForInfo(chromeLike, info, tabId);
  });

  chromeLike.tabs.onRemoved.addListener((tabId) => {
    removeTabState(chromeLike, tabId);
    menuState.delete(tabId);
  });

  chromeLike.runtime.onMessage.addListener((message, sender) => {
    if (!message || message.type !== 'SELECTION_CHANGED') {
      return;
    }
    const selection = (message.payload?.selectionText || '').trim();
    const info = {
      selectionText: selection,
      frameId: sender?.frameId ?? message.payload?.frameId ?? 0
    };
    const tabId = sender?.tab?.id ?? message.payload?.tabId ?? null;
    updateMenuForInfo(chromeLike, info, tabId);
  });
}

export function initializeBackground(chromeLike) {
  createContextMenus(chromeLike);
  registerHandlers(chromeLike);
}
