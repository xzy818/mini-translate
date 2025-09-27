/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createImportExportController } from '../public/options.js';

function buildDom() {
  document.body.innerHTML = `
    <button id="import-txt"></button>
    <input id="import-txt-input" type="file" />
    <button id="import-json"></button>
    <input id="import-json-input" type="file" />
    <button id="export-txt"></button>
    <button id="export-json"></button>
    <div id="import-summary"></div>
  `;
  return {
    importTxt: document.getElementById('import-txt'),
    importTxtInput: document.getElementById('import-txt-input'),
    importJson: document.getElementById('import-json'),
    importJsonInput: document.getElementById('import-json-input'),
    exportTxt: document.getElementById('export-txt'),
    exportJson: document.getElementById('export-json'),
    summary: document.getElementById('import-summary')
  };
}

function createStorage(initial = []) {
  let state = [...initial];
  return {
    async getVocabulary() {
      return [...state];
    },
    async setVocabulary(list) {
      state = [...list];
    }
  };
}

describe('Import/Export controller', () => {
  let storage;
  let notify;
  let download;
  let elements;
  let controller;

  beforeEach(() => {
    elements = buildDom();
    storage = createStorage([
      { term: 'one', translation: '一', type: 'word', createdAt: '2024-01-01T00:00:00.000Z' }
    ]);
    notify = vi.fn();
    download = vi.fn();
    controller = createImportExportController({
      storage,
      notify,
      elements,
      download,
      now: () => new Date('2024-05-01T00:00:00.000Z')
    });
  });

  it('exports vocabulary to TXT', async () => {
    await controller.exportTxt();
    expect(download).toHaveBeenCalledWith(
      'mini-translate-vocab-2024-05-01.txt',
      'one',
      'text/plain'
    );
    expect(notify).toHaveBeenCalledWith('已导出 TXT');
  });

  it('exports vocabulary to JSON', async () => {
    await controller.exportJson();
    const [filename, content, mime] = download.mock.calls[0];
    expect(filename).toBe('mini-translate-vocab-2024-05-01.json');
    expect(mime).toBe('application/json');
    const parsed = JSON.parse(content);
    expect(parsed.items).toHaveLength(1);
    expect(notify).toHaveBeenCalledWith('已导出 JSON');
  });

  it('imports TXT and updates storage', async () => {
    const file = {
      name: 'example.txt',
      type: 'text/plain',
      text: () => Promise.resolve('two')
    };
    await controller.importTxt(file);
    const vocab = await storage.getVocabulary();
    expect(vocab).toHaveLength(2);
    expect(vocab.find((item) => item.term === 'two')).toBeTruthy();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('导入完成'));
    expect(elements.summary.hidden).toBe(false);
    expect(elements.summary.textContent).toContain('导入成功');
  });

  it('imports JSON with failures and updates summary', async () => {
    const payload = JSON.stringify({ version: 1, items: [{ term: '' }, { term: 'valid' }] });
    const file = {
      name: 'vocab.json',
      type: 'application/json',
      text: () => Promise.resolve(payload)
    };
    await controller.importJson(file);
    const vocab = await storage.getVocabulary();
    expect(vocab.find((item) => item.term === 'valid')).toBeTruthy();
    expect(elements.summary.hidden).toBe(false);
    expect(elements.summary.textContent).toContain('失败明细');
  });

  it('rejects TXT files with unsupported extension', async () => {
    const file = {
      name: 'notes.csv',
      type: 'text/plain',
      text: () => Promise.resolve('content')
    };
    await controller.importTxt(file);
    expect(notify).toHaveBeenCalledWith('仅支持 TXT 文件导入');
    expect(elements.summary.textContent).toBe('导入失败：请使用 .txt 文件');
  });

  it('rejects empty TXT files', async () => {
    const file = {
      name: 'empty.txt',
      type: 'text/plain',
      text: () => Promise.resolve('   \n  ')
    };
    await controller.importTxt(file);
    expect(notify).toHaveBeenCalledWith('TXT 导入失败：空文件或格式无效');
    expect(elements.summary.textContent).toBe('未导入任何词条：空文件或格式无效');
  });

  it('rejects JSON files with wrong extension', async () => {
    const file = {
      name: 'data.txt',
      type: 'application/json',
      text: () => Promise.resolve('{ "items": [] }')
    };
    await controller.importJson(file);
    expect(notify).toHaveBeenCalledWith('仅支持 JSON 文件导入');
    expect(elements.summary.textContent).toBe('导入失败：请使用 .json 文件');
  });

  it('rejects empty JSON files', async () => {
    const file = {
      name: 'empty.json',
      type: 'application/json',
      text: () => Promise.resolve('   ')
    };
    await controller.importJson(file);
    expect(notify).toHaveBeenCalledWith('JSON 导入失败：空文件或格式无效');
    expect(elements.summary.textContent).toBe('未导入任何词条：空文件或格式无效');
  });
});
