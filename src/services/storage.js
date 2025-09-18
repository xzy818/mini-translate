export const VOCAB_KEY = 'miniTranslateVocabulary';
export const SETTINGS_KEY = 'settings';
export const TAB_STATE_KEY = 'miniTranslateTabState';
export const MAX_VOCAB = 500;

function normalizeTerm(raw) {
  if (!raw || typeof raw.term !== 'string') return null;
  const term = raw.term.trim();
  if (!term) return null;
  const inferredType = term.split(/\s+/).length > 1 ? 'phrase' : 'word';
  return {
    term,
    translation: typeof raw.translation === 'string' ? raw.translation : '',
    type: raw.type === 'phrase' ? 'phrase' : inferredType,
    length: Number.isFinite(raw.length) ? raw.length : term.length,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || null,
    status: raw.status === 'inactive' || raw.status === 'error' ? raw.status : 'active'
  };
}

export async function readVocabulary(chromeLike) {
  return new Promise((resolve, reject) => {
    try {
      chromeLike.storage.local.get({ [VOCAB_KEY]: [] }, (result) => {
        if (chromeLike.runtime?.lastError) {
          reject(new Error(chromeLike.runtime.lastError.message));
          return;
        }
        const list = Array.isArray(result[VOCAB_KEY]) ? result[VOCAB_KEY] : [];
        resolve(
          list
            .map(normalizeTerm)
            .filter(Boolean)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        );
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function writeVocabulary(chromeLike, list) {
  return new Promise((resolve, reject) => {
    try {
      chromeLike.storage.local.set({ [VOCAB_KEY]: list }, () => {
        if (chromeLike.runtime?.lastError) {
          reject(new Error(chromeLike.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function appendVocabulary(chromeLike, item) {
  const current = await readVocabulary(chromeLike);
  const exists = current.find((entry) => entry.term === item.term);
  if (exists) {
    const next = current.map((entry) => (entry.term === item.term ? item : entry));
    await writeVocabulary(chromeLike, next);
    return { updated: true, list: next };
  }
  if (current.length >= MAX_VOCAB) {
    return { error: 'LIMIT_EXCEEDED', list: current };
  }
  const next = [...current, item];
  await writeVocabulary(chromeLike, next);
  return { inserted: true, list: next };
}

export async function removeVocabulary(chromeLike, term) {
  const current = await readVocabulary(chromeLike);
  const next = current.filter((entry) => entry.term !== term);
  if (next.length === current.length) {
    return { removed: false, list: current };
  }
  await writeVocabulary(chromeLike, next);
  return { removed: true, list: next };
}

export async function readSettings(chromeLike) {
  return new Promise((resolve, reject) => {
    try {
      chromeLike.storage.local.get({ [SETTINGS_KEY]: {} }, (result) => {
        if (chromeLike.runtime?.lastError) {
          reject(new Error(chromeLike.runtime.lastError.message));
          return;
        }
        resolve(result[SETTINGS_KEY] || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function writeSettings(chromeLike, settings) {
  return new Promise((resolve, reject) => {
    try {
      chromeLike.storage.local.set({ [SETTINGS_KEY]: settings }, () => {
        if (chromeLike.runtime?.lastError) {
          reject(new Error(chromeLike.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function readTabState(chromeLike) {
  return new Promise((resolve, reject) => {
    try {
      chromeLike.storage.session.get({ [TAB_STATE_KEY]: {} }, (result) => {
        if (chromeLike.runtime?.lastError) {
          reject(new Error(chromeLike.runtime.lastError.message));
          return;
        }
        resolve(result[TAB_STATE_KEY] || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function writeTabState(chromeLike, state) {
  return new Promise((resolve, reject) => {
    try {
      chromeLike.storage.session.set({ [TAB_STATE_KEY]: state }, () => {
        if (chromeLike.runtime?.lastError) {
          reject(new Error(chromeLike.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function toggleTabState(chromeLike, tabId) {
  const state = await readTabState(chromeLike);
  const current = state[tabId]?.enabled || false;
  const nextEnabled = !current;
  const nextState = {
    ...state,
    [tabId]: { enabled: nextEnabled, updatedAt: Date.now() }
  };
  await writeTabState(chromeLike, nextState);
  return nextEnabled;
}

export async function removeTabState(chromeLike, tabId) {
  const state = await readTabState(chromeLike);
  if (state[tabId]) {
    delete state[tabId];
    await writeTabState(chromeLike, state);
  }
}
