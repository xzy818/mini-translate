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

export function safeSendMessage(chromeLike, tabId, payload) {
  try {
    chromeLike.tabs.sendMessage(tabId, payload, () => {
      const error = chromeLike.runtime?.lastError;
      if (error) {
        console.warn('tabs.sendMessage failed', error.message);
      }
    });
  } catch (error) {
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

async function handleAddTerm(chromeLike, info, tabId) {
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
  if (translationResult.ok) {
    safeSendMessage(chromeLike, tabId, {
      type: 'APPLY_TRANSLATION',
      payload
    });
  }
  chromeLike.runtime.sendMessage({ type: 'VOCAB_UPDATED', payload: { added: payload } });
  return { ok: true, payload };
}

async function handleRemoveTerm(chromeLike, info, tabId) {
  const term = (info.selectionText || '').trim();
  if (!term) {
    return { ok: false, reason: 'EMPTY_SELECTION' };
  }
  const removed = await removeVocabulary(chromeLike, term);
  if (!removed.removed) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  safeSendMessage(chromeLike, tabId, {
    type: 'REMOVE_TRANSLATION',
    payload: { term }
  });
  chromeLike.runtime.sendMessage({ type: 'VOCAB_UPDATED', payload: { removed: term } });
  return { ok: true };
}

async function handleTogglePage(chromeLike, tabId) {
  const enabled = await toggleTabState(chromeLike, tabId);
  const vocabulary = await readVocabulary(chromeLike);
  safeSendMessage(chromeLike, tabId, {
    type: enabled ? 'TRANSLATE_ALL' : 'RESET_PAGE',
    payload: { vocabulary }
  });
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
    const context = menuState.get(key);
    if (!context) {
      return;
    }
    await context.execute();
  });

  chromeLike.tabs.onRemoved.addListener((tabId) => {
    removeTabState(chromeLike, tabId);
    menuState.delete(tabId);
  });

  chromeLike.contextMenus.onShown.addListener(async (info, tab) => {
    const tabId = tab?.id;
    const context = await resolveMenuContext(chromeLike, info, tabId);
    const key = tabId ?? 'global';
    if (context) {
      chromeLike.contextMenus.update(MENU_ID, {
        visible: true,
        title: context.title
      });
      menuState.set(key, context);
    } else {
      chromeLike.contextMenus.update(MENU_ID, { visible: false });
      menuState.delete(key);
    }
    chromeLike.contextMenus.refresh();
  });
}

export function initializeBackground(chromeLike) {
  createContextMenus(chromeLike);
  registerHandlers(chromeLike);
}
