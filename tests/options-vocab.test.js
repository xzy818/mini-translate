/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryStorage,
  createVocabularyManager,
  MAX_VOCABULARY,
  __testing__
} from '../public/vocab-ui.js';

const { paginate } = __testing__();

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
