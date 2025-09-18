import { MAX_VOCABULARY_COUNT } from '../services/storage.js';

export const PAGE_SIZE = 10;

const STATUS_META = {
  active: { label: '启用', className: 'status-badge status-active' },
  inactive: { label: '停用', className: 'status-badge status-inactive' },
  error: { label: '错误', className: 'status-badge status-error' }
};

export function paginateItems(items, page, pageSize = PAGE_SIZE) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  return {
    page: currentPage,
    totalItems,
    totalPages,
    items: items.slice(start, end)
  };
}

export function formatTimestamp(isoString) {
  if (!isoString) {
    return '—';
  }
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (_) {
    return '—';
  }
}

function createCell(content, className) {
  const td = document.createElement('td');
  if (className) {
    td.className = className;
  }
  if (content instanceof HTMLElement) {
    td.appendChild(content);
  } else {
    td.textContent = content;
  }
  return td;
}

function createStatusBadge(status) {
  const meta = STATUS_META[status] ?? STATUS_META.active;
  const wrapper = document.createElement('span');
  wrapper.className = meta.className;

  const dot = document.createElement('span');
  dot.className = 'status-dot';
  wrapper.appendChild(dot);

  const label = document.createElement('span');
  label.textContent = meta.label;
  wrapper.appendChild(label);

  return wrapper;
}

function buildRow({ item, onDelete }) {
  const tr = document.createElement('tr');
  tr.dataset.term = item.term;

  tr.appendChild(createCell(item.term || '—'));
  tr.appendChild(createCell(item.translation || '—'));
  tr.appendChild(createCell(item.type === 'phrase' ? '短语' : '单词'));
  tr.appendChild(createCell(String(item.length ?? (item.term || '').length)));
  tr.appendChild(createCell(formatTimestamp(item.createdAt)));
  tr.appendChild(createCell(createStatusBadge(item.status)));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = '删除';
  deleteBtn.addEventListener('click', () => onDelete(item.term));
  tr.appendChild(createCell(deleteBtn, 'actions-col'));

  return tr;
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
    throw new Error(`Missing required DOM references: ${missing.join(', ')}`);
  }
  return elements;
}

export function createVocabularyUI({
  storage,
  pageSize = PAGE_SIZE,
  confirmFn = (message) => window.confirm(message),
  elements,
  alertDuration = 4000
}) {
  const refs = ensureElements(elements);
  const state = {
    items: [],
    page: 1,
    totalPages: 1
  };
  const handlers = {
    prev: null,
    next: null
  };
  let unsubscribeStorage = null;
  let alertTimer = null;
  let eventsBound = false;

  function showAlert(message, variant = 'info') {
    if (!message) {
      refs.alert.hidden = true;
      refs.alert.textContent = '';
      refs.alert.className = 'alert';
      return;
    }
    refs.alert.hidden = false;
    refs.alert.textContent = message;
    refs.alert.className = `alert alert--${variant}`;

    if (alertTimer) {
      window.clearTimeout(alertTimer);
    }
    alertTimer = window.setTimeout(() => {
      refs.alert.hidden = true;
    }, alertDuration);
  }

  function updateCounter() {
    refs.counter.textContent = `${state.items.length} / ${MAX_VOCABULARY_COUNT}`;
  }

  function renderTable() {
    refs.tbody.innerHTML = '';
    const { items, totalPages, page } = paginateItems(state.items, state.page, pageSize);
    state.page = page;
    state.totalPages = totalPages;

    items.forEach((item) => {
      refs.tbody.appendChild(
        buildRow({
          item,
          onDelete: handleDelete
        })
      );
    });
  }

  function renderEmptyState() {
    const hasItems = state.items.length > 0;
    refs.emptyState.hidden = hasItems;
    refs.tableWrapper.hidden = !hasItems;
  }

  function updatePaginationControls() {
    const { totalPages, page } = paginateItems(state.items, state.page, pageSize);
    state.page = page;
    state.totalPages = totalPages;

    refs.pagination.hidden = totalPages <= 1;
    refs.prevButton.disabled = page <= 1;
    refs.nextButton.disabled = page >= totalPages;
    refs.pageInfo.textContent = `第 ${page} / ${totalPages} 页`;
  }

  function render() {
    updateCounter();
    renderEmptyState();
    renderTable();
    updatePaginationControls();
  }

  async function loadVocabulary() {
    try {
      const data = await storage.getVocabulary();
      state.items = data;
      const maxPage = Math.max(1, Math.ceil(state.items.length / pageSize));
      if (state.page > maxPage) {
        state.page = maxPage;
      }
      render();
      if (!state.items.length) {
        showAlert('词库为空，请先添加词条。', 'info');
      } else {
        showAlert('词库加载完成。', 'success');
      }
    } catch (error) {
      console.error('加载词库失败', error);
      showAlert('加载词库失败，请稍后重试。', 'error');
    }
  }

  async function handleDelete(term) {
    if (!term) {
      return;
    }
    const confirmed = confirmFn(`确定要删除“${term}”吗？该操作不可恢复。`);
    if (!confirmed) {
      return;
    }
    try {
      const removed = await storage.removeTerm(term);
      if (!removed) {
        showAlert('未找到对应词条，可能已被删除。', 'info');
        state.items = state.items.filter((item) => item.term !== term);
      } else {
        state.items = state.items.filter((item) => item.term !== term);
        showAlert(`已删除“${term}”。`, 'success');
      }
      if (!state.items.length) {
        state.page = 1;
      } else {
        const maxPage = Math.max(1, Math.ceil(state.items.length / pageSize));
        if (state.page > maxPage) {
          state.page = maxPage;
        }
      }
      render();
    } catch (error) {
      console.error('删除词条失败', error);
      showAlert('删除失败，请稍后再试。', 'error');
    }
  }

  function goToPage(nextPage) {
    state.page = nextPage;
    render();
  }

  function bindEvents() {
    if (eventsBound) {
      return;
    }
    handlers.prev = () => {
      if (state.page > 1) {
        goToPage(state.page - 1);
      }
    };
    handlers.next = () => {
      if (state.page < state.totalPages) {
        goToPage(state.page + 1);
      }
    };
    refs.prevButton.addEventListener('click', handlers.prev);
    refs.nextButton.addEventListener('click', handlers.next);

    if (typeof storage.subscribe === 'function') {
      unsubscribeStorage = storage.subscribe((data) => {
        state.items = data;
        const maxPage = Math.max(1, Math.ceil(state.items.length / pageSize));
        if (state.page > maxPage) {
          state.page = maxPage;
        }
        render();
      });
    }

    eventsBound = true;
  }

  function unbindEvents() {
    if (!eventsBound) {
      return;
    }
    refs.prevButton.removeEventListener('click', handlers.prev);
    refs.nextButton.removeEventListener('click', handlers.next);
    handlers.prev = null;
    handlers.next = null;
    eventsBound = false;

    if (unsubscribeStorage) {
      unsubscribeStorage();
      unsubscribeStorage = null;
    }
  }

  return {
    init: async () => {
      bindEvents();
      await loadVocabulary();
    },
    destroy: () => {
      unbindEvents();
      if (alertTimer) {
        window.clearTimeout(alertTimer);
      }
    },
    getState: () => ({ ...state })
  };
}
