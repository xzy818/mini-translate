export const MAX_VOCABULARY_COUNT = 500;
export const STORAGE_KEY = 'miniTranslateVocabulary';

const DEFAULT_DATA = [];

function isChromeAvailable(chromeLike) {
  return (
    typeof chromeLike !== 'undefined' &&
    chromeLike !== null &&
    typeof chromeLike.storage === 'object' &&
    typeof chromeLike.storage.local === 'object'
  );
}

function normalizeVocabulary(data) {
  if (!Array.isArray(data)) {
    return DEFAULT_DATA;
  }
  return data
    .map((item) => ({
      term: item.term ?? '',
      translation: item.translation ?? '',
      type: item.type ?? 'word',
      length: typeof item.length === 'number' ? item.length : (item.term ?? '').length,
      createdAt: item.createdAt ?? new Date().toISOString(),
      updatedAt: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
      status: item.status ?? 'active'
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

class ChromeStorageClient {
  constructor(chromeLike) {
    this.chrome = chromeLike;
  }

  async getVocabulary() {
    const chrome = this.chrome;
    const payload = await new Promise((resolve, reject) => {
      chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_DATA }, (items) => {
        const lastError = chrome.runtime && chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(items[STORAGE_KEY]);
      });
    });
    return normalizeVocabulary(payload);
  }

  async setVocabulary(list) {
    const chrome = this.chrome;
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY]: list }, () => {
        const lastError = chrome.runtime && chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  async removeTerm(term) {
    const list = await this.getVocabulary();
    const next = list.filter((item) => item.term !== term);
    if (next.length === list.length) {
      return false;
    }
    await this.setVocabulary(next);
    try {
      if (this.chrome.runtime && typeof this.chrome.runtime.sendMessage === 'function') {
        this.chrome.runtime.sendMessage({ type: 'VOCAB_UPDATED', payload: { removed: term } });
      }
    } catch (_) {
      // 忽略发送消息失败，UI 刷新不依赖该动作。
    }
    return true;
  }

  subscribe(callback) {
    if (
      !this.chrome.storage ||
      !this.chrome.storage.onChanged ||
      typeof this.chrome.storage.onChanged.addListener !== 'function'
    ) {
      return () => {};
    }

    const handler = (changes, areaName) => {
      if (areaName !== 'local' || !changes[STORAGE_KEY]) {
        return;
      }
      callback(normalizeVocabulary(changes[STORAGE_KEY].newValue ?? DEFAULT_DATA));
    };

    this.chrome.storage.onChanged.addListener(handler);
    return () => {
      try {
        this.chrome.storage.onChanged.removeListener(handler);
      } catch (error) {
        console.warn('无法移除 storage 监听器', error);
      }
    };
  }
}

class MemoryStorageClient {
  constructor(initial = DEFAULT_DATA) {
    this.state = normalizeVocabulary(initial);
    this.listeners = new Set();
  }

  async getVocabulary() {
    return [...this.state];
  }

  async setVocabulary(list) {
    this.state = normalizeVocabulary(list);
    this.listeners.forEach((listener) => listener([...this.state]));
  }

  async removeTerm(term) {
    const next = this.state.filter((item) => item.term !== term);
    const changed = next.length !== this.state.length;
    if (changed) {
      this.state = next;
      this.listeners.forEach((listener) => listener([...this.state]));
    }
    return changed;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

export function createStorageClient({ chromeLike, fallbackData } = {}) {
  const chromeCandidate = chromeLike ?? (typeof chrome !== 'undefined' ? chrome : undefined);
  if (isChromeAvailable(chromeCandidate)) {
    return new ChromeStorageClient(chromeCandidate);
  }
  return new MemoryStorageClient(fallbackData);
}

export function createMemoryStorageClient(initial) {
  return new MemoryStorageClient(initial);
}

export { ChromeStorageClient, MemoryStorageClient };
