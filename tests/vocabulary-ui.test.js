import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  paginateItems,
  formatTimestamp,
  createVocabularyUI
} from '../extension/options/vocabulary-ui.js';
import { createMemoryStorageClient, MAX_VOCABULARY_COUNT } from '../extension/services/storage.js';

function createSampleData(count = 12) {
  const now = Date.now();
  return Array.from({ length: count }).map((_, index) => {
    const createdAt = new Date(now - index * 60000).toISOString();
    const term = index % 2 === 0 ? `term-${index}` : `短语 ${index}`;
    const type = term.includes(' ') ? 'phrase' : 'word';
    const status = index % 5 === 0 ? 'inactive' : 'active';
    return {
      term,
      translation: `translation-${index}`,
      type,
      length: term.length,
      createdAt,
      updatedAt: createdAt,
      status
    };
  });
}

function setupDom() {
  document.body.innerHTML = `
    <main class="options-container">
      <header class="options-header">
        <div>
          <h1>词库列表</h1>
        </div>
        <div class="counter" id="vocab-counter"></div>
      </header>
      <section class="alert" id="alert" hidden></section>
      <section class="empty-state" id="empty-state"></section>
      <section class="table-wrapper" id="table-wrapper">
        <table>
          <tbody id="vocab-body"></tbody>
        </table>
      </section>
      <footer class="pagination" id="pagination">
        <button id="prev-page">上一页</button>
        <span id="page-info"></span>
        <button id="next-page">下一页</button>
      </footer>
    </main>
  `;

  return {
    counter: document.getElementById('vocab-counter'),
    tbody: document.getElementById('vocab-body'),
    emptyState: document.getElementById('empty-state'),
    tableWrapper: document.getElementById('table-wrapper'),
    pagination: document.getElementById('pagination'),
    prevButton: document.getElementById('prev-page'),
    nextButton: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info'),
    alert: document.getElementById('alert')
  };
}

describe('paginateItems', () => {
  it('returns paginated slice with bounds clamped', () => {
    const items = Array.from({ length: 25 }).map((_, idx) => idx + 1);
    const result = paginateItems(items, 3, 10);
    expect(result.page).toBe(3);
    expect(result.totalItems).toBe(25);
    expect(result.totalPages).toBe(3);
    expect(result.items).toEqual([21, 22, 23, 24, 25]);

    const overflow = paginateItems(items, 99, 10);
    expect(overflow.page).toBe(3);
  });
});

describe('formatTimestamp', () => {
  it('formats ISO string into readable timestamp', () => {
    const iso = '2024-05-03T10:20:00.000Z';
    expect(formatTimestamp(iso)).toMatch(/2024.*05.*03/);
  });

  it('returns fallback for invalid values', () => {
    expect(formatTimestamp('invalid')).toBe('—');
    expect(formatTimestamp(undefined)).toBe('—');
  });
});

describe('Vocabulary UI integration', () => {
  let elements;
  let storage;
  let confirmFn;

  beforeEach(() => {
    elements = setupDom();
    storage = createMemoryStorageClient(createSampleData());
    confirmFn = vi.fn().mockReturnValue(true);
  });

  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('renders list, counter and pagination state', async () => {
    const ui = createVocabularyUI({
      storage,
      elements,
      confirmFn,
      alertDuration: 5
    });

    await ui.init();

    expect(elements.counter.textContent).toBe(`12 / ${MAX_VOCABULARY_COUNT}`);
    expect(elements.pagination.hidden).toBe(false);
    expect(elements.tbody.children).toHaveLength(10);
    expect(elements.pageInfo.textContent).toBe('第 1 / 2 页');

    ui.destroy();
  });

  it('deletes a term after confirmation and updates pagination', async () => {
    const ui = createVocabularyUI({
      storage,
      elements,
      confirmFn,
      alertDuration: 5
    });

    await ui.init();

    const firstRow = elements.tbody.querySelector('tr');
    const term = firstRow?.dataset.term;
    expect(term).toBeTruthy();

    const deleteButton = firstRow.querySelector('button');
    deleteButton.click();
    await flush();

    expect(confirmFn).toHaveBeenCalled();

    const remaining = await storage.getVocabulary();
    expect(remaining.find((item) => item.term === term)).toBeUndefined();

    // 11 项数据仍保持分页，总页数应该为 2
    expect(elements.pageInfo.textContent).toBe('第 1 / 2 页');

    ui.destroy();
  });
});
