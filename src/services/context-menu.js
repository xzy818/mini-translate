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

export const MENU_ID = 'mini-translate-action';

const menuState = new Map();

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
    const key = tabId ?? 'global';
    setMenuContext(chromeLike, key, context);
  } catch (error) {
    console.warn('Failed to resolve menu context', error);
  }
}

export function safeSendMessage(chromeLike, tabId, payload) {
  try {
    chromeLike.tabs.sendMessage(tabId, payload, (response) => {
      const error = chromeLike.runtime?.lastError;
      if (error) {
        // 检查是否是常见的连接错误，避免在控制台显示警告
        if (error.message.includes('Could not establish connection') || 
            error.message.includes('Receiving end does not exist') ||
            error.message.includes('The message port closed')) {
          // 这些是正常的连接错误，不需要警告
          return;
        }
        console.warn('tabs.sendMessage failed', error.message);
      }
    });
  } catch (error) {
    // 检查是否是常见的连接异常，避免在控制台显示警告
    if (error.message && (
        error.message.includes('Could not establish connection') ||
        error.message.includes('Receiving end does not exist'))) {
      return;
    }
    console.warn('tabs.sendMessage exception', error);
  }
}

function inferType(term) {
  return term.split(/\s+/).length > 1 ? 'phrase' : 'word';
}

async function translateTerm(chromeLike, text) {
  const settings = await readSettings(chromeLike);
  const { model, apiKey, apiBaseUrl } = settings;
  if (!model || !apiKey || !apiBaseUrl) {
    return { ok: false, reason: 'INVALID_SETTINGS' };
  }
  return new Promise((resolve) => {
    chromeLike.runtime.sendMessage(
      {
        type: 'TRANSLATE_TERM',
        payload: { text, model, apiKey, apiBaseUrl }
      },
      (response) => {
        if (chromeLike.runtime.lastError) {
          resolve({ ok: false, reason: chromeLike.runtime.lastError.message });
          return;
        }
        resolve(response);
      }
    );
  });
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
  const translation = translationResult.ok ? translationResult.translation : '';

  const payload = {
    term: selectionText,
    translation,
    type: inferType(selectionText),
    status: translationResult.ok ? 'active' : 'error'
  };

  const upserted = await appendVocabulary(chromeLike, payload);
  if (upserted.error === 'LIMIT_EXCEEDED') {
    return { ok: false, reason: 'LIMIT_EXCEEDED', count: MAX_VOCAB };
  }
  if (translationResult.ok && Number.isInteger(tabId)) {
    safeSendMessage(chromeLike, tabId, {
      type: 'APPLY_TRANSLATION',
      payload
    });
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
    safeSendMessage(chromeLike, tabId, {
      type: 'REMOVE_TRANSLATION',
      payload: { term }
    });
  }
  chromeLike.runtime.sendMessage({ type: 'VOCAB_UPDATED', payload: { removed: term } });
  return { ok: true };
}

export async function handleTogglePage(chromeLike, tabId) {
  const enabled = await toggleTabState(chromeLike, tabId);
  const vocabulary = await readVocabulary(chromeLike);
  if (Number.isInteger(tabId)) {
    safeSendMessage(chromeLike, tabId, {
      type: enabled ? 'TRANSLATE_ALL' : 'RESET_PAGE',
      payload: { vocabulary }
    });
  }
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

async function resolveMenuContext(chromeLike, info, tabId) {
  const selection = (info.selectionText || '').trim();
  const vocabulary = await readVocabulary(chromeLike);
  const states = await readTabState(chromeLike);
  const enabled = tabId ? Boolean(states[tabId]?.enabled) : false;

  if (selection) {
    const exists = vocabulary.find((entry) => entry.term === selection);
    if (!exists) {
      return {
        title: 'add & mini-translate',
        execute: async () => {
          const result = await handleAddTerm(chromeLike, info, tabId);
          if (!result.ok && result.reason) {
            notify(
              chromeLike,
              result.reason === 'LIMIT_EXCEEDED'
                ? '词库已满 (500)，请删除后再添加。'
                : '添加失败，请检查配置或稍后重试。'
            );
          }
        }
      };
    }
    return {
      title: 'remove from mini-translate',
      execute: async () => {
        const result = await handleRemoveTerm(chromeLike, info, tabId);
        if (!result.ok) {
          notify(chromeLike, '未找到对应词条。');
        }
      }
    };
  }

  return {
    title: enabled ? 'stop mini-translate' : 'start mini-translate',
    execute: async () => {
      const result = await handleTogglePage(chromeLike, tabId || info.frameId || 0);
      notify(
        chromeLike,
        '右键菜单随状态更新。',
        result.enabled ? 'Mini Translate 已开启' : 'Mini Translate 已关闭'
      );
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
    const key = tabId ?? 'global';
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
    if (tabId != null) {
      await updateMenuForInfo(chromeLike, info, tabId);
    }
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
