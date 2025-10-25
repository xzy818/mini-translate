import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome API
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn()
    },
    sync: {
      get: vi.fn(),
      set: vi.fn()
    }
  },
  runtime: {
    sendMessage: vi.fn()
  }
};

global.chrome = mockChrome;

// Mock DOM
const _unused = () => {
  document.body.innerHTML = `
    <div id="vocab-counter">0/500</div>
    <div id="vocab-empty-state" style="display: none;">暂无词条</div>
    <div id="vocab-table-wrapper">
      <table class="vocab-table">
        <thead>
          <tr>
            <th><input type="checkbox" id="select-all" /></th>
            <th>原文</th>
            <th>译文</th>
            <th>类型</th>
            <th>添加时间</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="vocab-body"></tbody>
      </table>
    </div>
    <div id="vocab-pagination">
      <button id="vocab-prev">上一页</button>
      <span id="vocab-page-info">第 1 / 1 页</span>
      <button id="vocab-next">下一页</button>
      <button id="batch-delete" style="display: none;">批量删除</button>
    </div>
    <div id="vocab-alert"></div>
  `;
};

describe('批量删除功能测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDOM();
  });

  it('应该能够批量删除选中的词条', async () => {
    // 模拟存储数据
    const mockVocabulary = [
      { term: 'hello', translation: '你好', type: 'word', createdAt: Date.now() },
      { term: 'world', translation: '世界', type: 'word', createdAt: Date.now() },
      { term: 'test', translation: '测试', type: 'word', createdAt: Date.now() }
    ];

    mockChrome.storage.local.get.mockResolvedValue({ vocabulary: mockVocabulary });
    mockChrome.storage.local.set.mockResolvedValue();

    // 动态导入模块
    const { createStorageClient, createVocabularyManager } = await import('../public/vocab-ui.js');
    
    const storage = createStorageClient();
    const manager = createVocabularyManager({
      elements: {
        counter: document.getElementById('vocab-counter'),
        tbody: document.getElementById('vocab-body'),
        emptyState: document.getElementById('vocab-empty-state'),
        tableWrapper: document.getElementById('vocab-table-wrapper'),
        pagination: document.getElementById('vocab-pagination'),
        prevButton: document.getElementById('vocab-prev'),
        nextButton: document.getElementById('vocab-next'),
        pageInfo: document.getElementById('vocab-page-info'),
        alert: document.getElementById('vocab-alert')
      },
      storage
    });

    // 初始化管理器
    await manager.init();

    // 等待DOM更新
    await new Promise(resolve => setTimeout(resolve, 100));

    // 模拟选中前两个词条
    const checkboxes = document.querySelectorAll('.vocab-checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    
    checkboxes[0].checked = true;
    checkboxes[1].checked = true;

    // 触发change事件
    checkboxes[0].dispatchEvent(new Event('change'));
    checkboxes[1].dispatchEvent(new Event('change'));

    // 等待批量删除按钮显示
    await new Promise(resolve => setTimeout(resolve, 100));

    // 触发批量删除
    const batchDeleteBtn = document.getElementById('batch-delete');
    expect(batchDeleteBtn.style.display).not.toBe('none');
    
    // 模拟确认对话框
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);
    
    batchDeleteBtn.click();

    // 等待异步操作完成
    await new Promise(resolve => setTimeout(resolve, 200));

    // 验证存储被调用
    expect(mockChrome.storage.local.set).toHaveBeenCalled();
    
    // 恢复原始confirm函数
    window.confirm = originalConfirm;
  });

  it('应该正确更新全选复选框状态', async () => {
    const mockVocabulary = [
      { term: 'hello', translation: '你好', type: 'word', createdAt: Date.now() },
      { term: 'world', translation: '世界', type: 'word', createdAt: Date.now() }
    ];

    mockChrome.storage.local.get.mockResolvedValue({ vocabulary: mockVocabulary });
    mockChrome.storage.local.set.mockResolvedValue();

    const { createStorageClient, createVocabularyManager } = await import('../public/vocab-ui.js');
    
    const storage = createStorageClient();
    const manager = createVocabularyManager({
      elements: {
        counter: document.getElementById('vocab-counter'),
        tbody: document.getElementById('vocab-body'),
        emptyState: document.getElementById('vocab-empty-state'),
        tableWrapper: document.getElementById('vocab-table-wrapper'),
        pagination: document.getElementById('vocab-pagination'),
        prevButton: document.getElementById('vocab-prev'),
        nextButton: document.getElementById('vocab-next'),
        pageInfo: document.getElementById('vocab-page-info'),
        alert: document.getElementById('vocab-alert')
      },
      storage
    });

    await manager.init();

    // 等待DOM更新
    await new Promise(resolve => setTimeout(resolve, 100));

    // 测试全选功能
    const selectAllCheckbox = document.getElementById('select-all');
    selectAllCheckbox.checked = true;
    selectAllCheckbox.dispatchEvent(new Event('change'));

    // 等待事件处理完成
    await new Promise(resolve => setTimeout(resolve, 100));

    // 验证所有复选框都被选中
    const checkboxes = document.querySelectorAll('.vocab-checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach(checkbox => {
      expect(checkbox.checked).toBe(true);
    });
  });

  it('应该正确显示批量删除按钮状态', async () => {
    const mockVocabulary = [
      { term: 'hello', translation: '你好', type: 'word', createdAt: Date.now() }
    ];

    mockChrome.storage.local.get.mockResolvedValue({ vocabulary: mockVocabulary });
    mockChrome.storage.local.set.mockResolvedValue();

    const { createStorageClient, createVocabularyManager } = await import('../public/vocab-ui.js');
    
    const storage = createStorageClient();
    const manager = createVocabularyManager({
      elements: {
        counter: document.getElementById('vocab-counter'),
        tbody: document.getElementById('vocab-body'),
        emptyState: document.getElementById('vocab-empty-state'),
        tableWrapper: document.getElementById('vocab-table-wrapper'),
        pagination: document.getElementById('vocab-pagination'),
        prevButton: document.getElementById('vocab-prev'),
        nextButton: document.getElementById('vocab-next'),
        pageInfo: document.getElementById('vocab-page-info'),
        alert: document.getElementById('vocab-alert')
      },
      storage
    });

    await manager.init();

    // 等待DOM更新
    await new Promise(resolve => setTimeout(resolve, 100));

    const batchDeleteBtn = document.getElementById('batch-delete');
    
    // 初始状态应该隐藏
    expect(batchDeleteBtn.style.display).toBe('none');

    // 选中一个复选框后应该显示
    const checkbox = document.querySelector('.vocab-checkbox');
    expect(checkbox).toBeTruthy();
    
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    // 等待事件处理完成
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(batchDeleteBtn.style.display).toBe('');
  });
});
