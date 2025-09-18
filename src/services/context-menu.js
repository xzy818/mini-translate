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

export const MENU_IDS = {
  ADD: 'mini-translate-add',
  REMOVE: 'mini-translate-remove',
  TOGGLE: 'mini-translate-toggle'
};

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

async function translateText(chromeLike, text) {
  const settings = await readSettings(chromeLike);
  const { model, apiKey, apiBaseUrl } = settings;
  if (!model || !apiKey || !apiBaseUrl) {
    return { ok: false, reason: 'INVALID_SETTINGS' };
  }
  const composer = new Promise((resolve) => {
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
  return composer;
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
  const translationResult = await translateText(chromeLike, selectionText);
  const translation = translationResult.ok ? translationResult.translation : '';

  const payload = {
    term: selectionText,
    translation,
    type: inferType(selectionText),
    status: translationResult.ok ? 'active' : 'error'
  };

  const upserted = await appendVocabulary(chromeLike, payload);
  if (upserted.error === 'LIMIT_EXCEEDED') {
    chromeLike.notifications?.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Mini Translate',
      message: '词库已达到 500 条上限，无法继续添加。'
    });
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

export async function handleRemoveTerm(chromeLike, info, tabId) {
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

export async function updateToggleTitle(chromeLike, tabId) {
  const states = await readTabState(chromeLike);
  const enabled = states[tabId]?.enabled || false;
  chromeLike.contextMenus.update(MENU_IDS.TOGGLE, {
    title: enabled ? 'stop mini-translate' : 'start mini-translate'
  });
}

export async function handleTogglePage(chromeLike, tabId) {
  const enabled = await toggleTabState(chromeLike, tabId);
  const vocabulary = await readVocabulary(chromeLike);
  safeSendMessage(chromeLike, tabId, {
    type: enabled ? 'TRANSLATE_ALL' : 'RESET_PAGE',
    payload: { vocabulary }
  });
  await updateToggleTitle(chromeLike, tabId);
  return { ok: true, enabled };
}

export async function createContextMenus(chromeLike) {
  chromeLike.contextMenus.removeAll(() => {
    chromeLike.contextMenus.create({
      id: MENU_IDS.ADD,
      title: 'add & mini-translate',
      contexts: ['selection']
    });
    chromeLike.contextMenus.create({
      id: MENU_IDS.REMOVE,
      title: 'remove from mini-translate',
      contexts: ['selection']
    });
    chromeLike.contextMenus.create({
      id: MENU_IDS.TOGGLE,
      title: 'toggle mini-translate',
      contexts: ['all']
    });
  });
}

export function registerHandlers(chromeLike) {
  const handler = async (info, tab) => {
    const tabId = tab?.id;
    if (!tabId) return;

    if (info.menuItemId === MENU_IDS.ADD) {
      const result = await handleAddTerm(chromeLike, info, tabId);
      if (!result.ok && result.reason) {
        chromeLike.notifications?.create({
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: 'Mini Translate',
          message: result.reason === 'LIMIT_EXCEEDED'
            ? '词库已满 (500)，请删除后再添加。'
            : '添加失败，请检查配置或稍后重试。'
        });
      }
    }

    if (info.menuItemId === MENU_IDS.REMOVE) {
      const result = await handleRemoveTerm(chromeLike, info, tabId);
      if (!result.ok) {
        chromeLike.notifications?.create({
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: 'Mini Translate',
          message: '未找到对应词条。'
        });
      }
    }

    if (info.menuItemId === MENU_IDS.TOGGLE) {
      const result = await handleTogglePage(chromeLike, tabId);
      const title = result?.enabled ? 'Mini Translate 已开启' : 'Mini Translate 已关闭';
      chromeLike.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title,
        message: '右键菜单随状态更新。'
      });
    }
  };

  chromeLike.contextMenus.onClicked.addListener(handler);

  chromeLike.tabs.onRemoved.addListener((tabId) => {
    removeTabState(chromeLike, tabId);
  });

  chromeLike.contextMenus.onShown.addListener((info, tab) => {
    const hasSelection = Boolean(info.selectionText && info.selectionText.trim());
    chromeLike.contextMenus.update(MENU_IDS.ADD, { visible: hasSelection });
    chromeLike.contextMenus.update(MENU_IDS.REMOVE, { visible: hasSelection });
    if (tab?.id) {
      updateToggleTitle(chromeLike, tab.id);
    }
    chromeLike.contextMenus.refresh();
  });
}

export function initializeBackground(chromeLike) {
  createContextMenus(chromeLike);
  registerHandlers(chromeLike);
}
