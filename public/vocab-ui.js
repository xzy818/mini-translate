export const MAX_VOCABULARY = 500;
const PAGE_SIZE_DEFAULT = 10;

const STATUS_META = {
  active: { label: '启用', className: 'status-badge status-active' },
  inactive: { label: '停用', className: 'status-badge status-inactive' },
  error: { label: '错误', className: 'status-badge status-error' }
};

function normalizeItem(raw) {
  if (!raw) return null;
  const term = typeof raw.term === 'string' ? raw.term.trim() : '';
  if (!term) return null;
  const translation = typeof raw.translation === 'string' ? raw.translation.trim() : '';
  const inferredType = term.split(/\s+/).length > 1 ? 'phrase' : 'word';
  const type = raw.type === 'phrase' || raw.type === 'word' ? raw.type : inferredType;
  const length = Number.isFinite(raw.length) ? raw.length : term.length;
  const createdAt = raw.createdAt || raw.updatedAt || new Date().toISOString();
  const status = raw.status === 'inactive' || raw.status === 'error' ? raw.status : 'active';
  const updatedAt = raw.updatedAt || null;
  return { term, translation, type, length, createdAt, updatedAt, status };
}

function normalizeList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(normalizeItem)
    .filter(Boolean)
    .sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

class ChromeStorageClient {
  constructor(chromeLike) {
    this.chrome = chromeLike;
  }

  async getVocabulary() {
    const chrome = this.chrome;
    const result = await new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get({ vocabulary: [] }, (items) => {
          const lastError = chrome.runtime && chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          resolve(items.vocabulary);
        });
      } catch (error) {
        reject(error);
      }
    });
    return normalizeList(result);
  }

  async setVocabulary(list) {
    const chrome = this.chrome;
    await new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set({ vocabulary: list }, () => {
          const lastError = chrome.runtime && chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async removeTerm(term) {
    const current = await this.getVocabulary();
    const next = current.filter((item) => item.term !== term);
    if (next.length === current.length) {
      return { removed: false, list: current };
    }
    await this.setVocabulary(next);
    try {
      if (this.chrome.runtime && typeof this.chrome.runtime.sendMessage === 'function') {
        this.chrome.runtime.sendMessage({ type: 'VOCAB_UPDATED', payload: { removed: term } });
      }
    } catch (error) {
      console.warn('VOCAB_UPDATED message failed', error);
    }
    return { removed: true, list: next };
  }

  subscribe(callback) {
    if (!this.chrome?.storage?.onChanged?.addListener) {
      return () => {};
    }
    const handler = (changes, area) => {
      if (area !== 'local' || !changes.vocabulary) return;
      const next = normalizeList(changes.vocabulary.newValue);
      callback(next);
    };
    this.chrome.storage.onChanged.addListener(handler);
    return () => {
      try {
        this.chrome.storage.onChanged.removeListener(handler);
      } catch (error) {
        console.warn('Failed to detach storage listener', error);
      }
    };
  }
}

class MemoryStorageClient {
  constructor(initial) {
    this.list = normalizeList(initial || []);
    this.listeners = new Set();
  }

  async getVocabulary() {
    return [...this.list];
  }

  async setVocabulary(list) {
    this.list = normalizeList(list);
    this.listeners.forEach((listener) => {
      listener([...this.list]);
    });
  }

  async removeTerm(term) {
    const next = this.list.filter((item) => item.term !== term);
    const removed = next.length !== this.list.length;
    this.list = next;
    this.listeners.forEach((listener) => listener([...this.list]));
    return { removed, list: [...this.list] };
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

export function createStorageClient({ chromeLike, fallbackData } = {}) {
  const candidate = chromeLike ?? (typeof chrome !== 'undefined' ? chrome : undefined);
  if (candidate && candidate.storage && candidate.storage.local) {
    return new ChromeStorageClient(candidate);
  }
  return new MemoryStorageClient(fallbackData);
}

export function createMemoryStorage(fallbackData) {
  return new MemoryStorageClient(fallbackData);
}

function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function buildStatusBadge(status) {
  const meta = STATUS_META[status] || STATUS_META.active;
  const badge = document.createElement('span');
  badge.className = meta.className;

  const dot = document.createElement('span');
  dot.className = 'status-dot';
  badge.appendChild(dot);

  const text = document.createElement('span');
  text.textContent = meta.label;
  badge.appendChild(text);
  return badge;
}

function createCell(content, className) {
  const td = document.createElement('td');
  if (className) td.className = className;
  if (content instanceof HTMLElement) {
    td.appendChild(content);
  } else {
    td.textContent = content;
  }
  return td;
}

function ensureElements(elements) {
  const required = [
    'counter',
    'tbody',
    'emptyState',
    'tableWrapper',
    'pagination',
    'prevButton',
    'nextButton',
    'pageInfo',
    'alert'
  ];
  const missing = required.filter((key) => !elements[key]);
  if (missing.length) {
    throw new Error(`Missing DOM references: ${missing.join(', ')}`);
  }
  return elements;
}

function paginate(list, page, pageSize) {
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  return {
    page: safePage,
    totalPages,
    items: list.slice(start, end)
  };
}

export function createVocabularyManager({
  elements,
  storage,
  pageSize = PAGE_SIZE_DEFAULT,
  confirmFn = (message) => window.confirm(message),
  alertDuration = 5000
}) {
  const refs = ensureElements(elements);
  const state = {
    items: [],
    page: 1
  };
  let unsubscribe = null;
  let alertTimer = null;

  function showAlert(text, variant = 'info') {
    if (!text) {
      refs.alert.hidden = true;
      refs.alert.textContent = '';
      refs.alert.className = 'alert';
      return;
    }
    refs.alert.hidden = false;
    refs.alert.textContent = text;
    refs.alert.className = `alert alert--${variant}`;
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = setTimeout(() => {
      refs.alert.hidden = true;
    }, alertDuration);
  }

  function updateCounter() {
    refs.counter.textContent = `${state.items.length} / ${MAX_VOCABULARY}`;
  }

  function renderEmptyState() {
    const hasItems = state.items.length > 0;
    refs.emptyState.hidden = hasItems;
    refs.tableWrapper.hidden = !hasItems;
    refs.pagination.hidden = hasItems ? refs.pagination.hidden : true;
  }

  function renderTable() {
    refs.tbody.innerHTML = '';
    const { items, page, totalPages } = paginate(state.items, state.page, pageSize);
    state.page = page;
    refs.pagination.hidden = totalPages <= 1;
    refs.prevButton.disabled = page <= 1;
    refs.nextButton.disabled = page >= totalPages;
    refs.pageInfo.textContent = `第 ${page} / ${totalPages} 页`;

    items.forEach((item) => {
      const row = document.createElement('tr');
      row.dataset.term = item.term;
      row.appendChild(createCell(item.term || '—'));
      row.appendChild(createCell(item.translation || '—'));
      row.appendChild(createCell(item.type === 'phrase' ? '短语' : '单词'));
      row.appendChild(createCell(String(item.length || item.term.length)));
      row.appendChild(createCell(formatTimestamp(item.createdAt)));
      row.appendChild(createCell(buildStatusBadge(item.status)));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'btn btn-danger';
      deleteButton.textContent = '删除';
      deleteButton.addEventListener('click', () => handleDelete(item.term));
      row.appendChild(createCell(deleteButton, 'actions-col'));
      refs.tbody.appendChild(row);
    });
  }

  function render() {
    updateCounter();
    renderEmptyState();
    renderTable();
  }

  async function handleDelete(term) {
    if (!term) return;
    const ok = confirmFn(`确定要删除“${term}”吗？该操作不可恢复。`);
    if (!ok) return;
    try {
      const result = await storage.removeTerm(term);
      if (!result.removed) {
        showAlert('未找到对应词条，可能已被其他页面删除。', 'info');
        state.items = state.items.filter((item) => item.term !== term);
      } else {
        showAlert(`已删除“${term}”。`, 'success');
        state.items = normalizeList(result.list);
      }
      if (!state.items.length) {
        state.page = 1;
      } else {
        const { totalPages } = paginate(state.items, state.page, pageSize);
        if (state.page > totalPages) {
          state.page = totalPages;
        }
      }
      render();
    } catch (error) {
      console.error('删除词条失败', error);
      showAlert('删除失败，请稍后再试。', 'error');
    }
  }

  async function loadVocabulary() {
    try {
      const list = await storage.getVocabulary();
      state.items = list;
      state.page = 1;
      render();
      if (!list.length) {
        showAlert('词库为空，请从网页添加词条或导入文件。', 'info');
      }
    } catch (error) {
      console.error('加载词库失败', error);
      state.items = [];
      render();
      showAlert('加载词库失败，请稍后重试。', 'error');
    }
  }

  function bindEvents() {
    refs.prevButton.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        render();
      }
    });
    refs.nextButton.addEventListener('click', () => {
      const { totalPages } = paginate(state.items, state.page, pageSize);
      if (state.page < totalPages) {
        state.page += 1;
        render();
      }
    });

    if (storage && typeof storage.subscribe === 'function') {
      unsubscribe = storage.subscribe((list) => {
        state.items = list;
        const { totalPages } = paginate(state.items, state.page, pageSize);
        if (state.page > totalPages) {
          state.page = totalPages;
        }
        render();
      });
    }
  }

  function unbindEvents() {
    refs.prevButton.replaceWith(refs.prevButton.cloneNode(true));
    refs.nextButton.replaceWith(refs.nextButton.cloneNode(true));
    if (unsubscribe) unsubscribe();
    if (alertTimer) clearTimeout(alertTimer);
  }

  return {
    init: async () => {
      bindEvents();
      await loadVocabulary();
    },
    destroy: () => {
      unbindEvents();
    },
    getState: () => ({ ...state })
  };
}

export function __testing__() {
  return { normalizeItem, normalizeList, paginate, formatTimestamp };
}
