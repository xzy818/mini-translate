/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryStorage,
  createVocabularyManager,
  MAX_VOCABULARY,
  __testing__
} from '../public/vocab-ui.js';

const testingHelpers = __testing__();
const { paginate, sendRetryRequest, shouldRetryConnectionError } = testingHelpers;

function buildSampleData(count = 12) {
  const now = Date.now();
  return Array.from({ length: count }).map((_, index) => {
    const term = index % 2 === 0 ? `term-${index}` : `短语 ${index}`;
    return {
      term,
      translation: `translation-${index}`,
      type: term.includes(' ') ? 'phrase' : 'word',
      createdAt: new Date(now - index * 3600 * 1000).toISOString(),
      status: index % 5 === 0 ? 'inactive' : 'active'
    };
  });
}

function setupDom() {
  document.body.innerHTML = `
    <div>
      <span id="vocab-counter"></span>
      <div id="vocab-alert"></div>
      <div id="vocab-empty"></div>
      <div id="vocab-table-wrapper"><table><tbody id="vocab-body"></tbody></table></div>
      <div id="vocab-pagination">
        <button id="vocab-prev"></button>
        <span id="vocab-page-info"></span>
        <button id="vocab-next"></button>
      </div>
    </div>
  `;
  return {
    counter: document.getElementById('vocab-counter'),
    tbody: document.getElementById('vocab-body'),
    emptyState: document.getElementById('vocab-empty'),
    tableWrapper: document.getElementById('vocab-table-wrapper'),
    pagination: document.getElementById('vocab-pagination'),
    prevButton: document.getElementById('vocab-prev'),
    nextButton: document.getElementById('vocab-next'),
    pageInfo: document.getElementById('vocab-page-info'),
    alert: document.getElementById('vocab-alert')
  };
}

describe('retry helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.chrome = {
      runtime: {
        lastError: null,
        sendMessage: vi.fn()
      }
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete global.chrome;
  });

  it('identifies connection errors correctly', () => {
    expect(shouldRetryConnectionError('Could not establish connection. Receiving end does not exist.')).toBe(true);
    expect(shouldRetryConnectionError('Receiving end does not exist')).toBe(true);
    expect(shouldRetryConnectionError('Other error')).toBe(false);
  });

  it('retries once after connection error and resolves on success', async () => {
    let attempt = 0;
    global.chrome.runtime.sendMessage.mockImplementation((message, cb) => {
      if (attempt === 0) {
        attempt += 1;
        global.chrome.runtime.lastError = {
          message: 'Could not establish connection. Receiving end does not exist.'
        };
        cb && cb();
        global.chrome.runtime.lastError = null;
        return;
      }
      attempt += 1;
      cb && cb({ ok: true });
    });

    const resultPromise = sendRetryRequest('hello');
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(200);
    await Promise.resolve();
    const result = await resultPromise;

    expect(result).toEqual({ ok: true });
    expect(attempt).toBe(2);
  });

  it('returns fallback error after retries exhausted', async () => {
    global.chrome.runtime.sendMessage.mockImplementation((message, cb) => {
      global.chrome.runtime.lastError = {
        message: 'The message port closed before a response was received.'
      };
      cb && cb();
      global.chrome.runtime.lastError = null;
    });

    const resultPromise = sendRetryRequest('world');
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1200);
    await Promise.resolve();
    const result = await resultPromise;

    expect(result).toEqual({ ok: false, error: '连接失败，请重试' });
  });
});

describe('paginate()', () => {
  it('limits page range', () => {
    const list = Array.from({ length: 25 }).map((_, idx) => idx);
    const { items, page, totalPages } = paginate(list, 9, 10);
    expect(page).toBe(3);
    expect(totalPages).toBe(3);
    expect(items).toEqual([20, 21, 22, 23, 24]);
  });
});

describe('Vocabulary manager UI', () => {
  let elements;
  let storage;
  let confirmFn;

  beforeEach(() => {
    elements = setupDom();
    storage = createMemoryStorage(buildSampleData());
    confirmFn = vi.fn().mockReturnValue(true);
  });

  it('renders vocabulary rows with counter and pagination', async () => {
    const manager = createVocabularyManager({
      elements,
      storage,
      confirmFn,
      alertDuration: 5,
      pageSize: 10
    });
    await manager.init();
    expect(elements.counter.textContent).toBe(`12 / ${MAX_VOCABULARY}`);
    expect(elements.tbody.children.length).toBe(10);
    expect(elements.pagination.hidden).toBe(false);
    expect(elements.pageInfo.textContent).toBe('第 1 / 2 页');
    manager.destroy();
  });

  it('confirms and deletes a vocabulary term', async () => {
    const manager = createVocabularyManager({
      elements,
      storage,
      confirmFn,
      alertDuration: 5,
      pageSize: 10
    });
    await manager.init();

    const firstRow = elements.tbody.querySelector('tr');
    const term = firstRow?.dataset.term;
    firstRow.querySelector('button').click();
    expect(confirmFn).toHaveBeenCalled();

    const remaining = await storage.getVocabulary();
    expect(remaining.find((item) => item.term === term)).toBeUndefined();
    manager.destroy();
  });

  it('shows empty state when vocabulary list is empty', async () => {
    storage = createMemoryStorage([]);
    const manager = createVocabularyManager({
      elements,
      storage,
      confirmFn,
      alertDuration: 5,
      pageSize: 10
    });
    await manager.init();
    expect(elements.emptyState.hidden).toBe(false);
    expect(elements.tableWrapper.hidden).toBe(true);
    manager.destroy();
  });

  it('displays error alert when loading fails', async () => {
    const failingStorage = {
      async getVocabulary() {
        throw new Error('boom');
      },
      subscribe() {
        return () => {};
      }
    };
    const manager = createVocabularyManager({
      elements,
      storage: failingStorage,
      confirmFn,
      alertDuration: 5,
      pageSize: 10
    });
    await manager.init();
    expect(elements.alert.hidden).toBe(false);
    expect(elements.alert.textContent).toContain('加载词库失败');
    manager.destroy();
  });
});
