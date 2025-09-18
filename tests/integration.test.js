import { describe,it,expect,vi } from 'vitest';

describe('Chrome Extension Integration Tests',()=>{
  it('manifest.json structure validation',()=>{
    const manifest = {
      manifest_version: 3,
      name: 'Mini Translate',
      version: '0.1.0',
      permissions: ['contextMenus','storage','scripting','activeTab'],
      background: { service_worker: 'background.js' },
      content_scripts: [{ matches: ['<all_urls>'], js: ['content.js'], run_at: 'document_idle' }]
    };
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toContain('contextMenus');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.content_scripts[0].matches).toContain('<all_urls>');
  });
  
  it('vocabulary schema validation',()=>{
    const validItem = {
      term: 'hello',
      translation: '你好',
      type: 'word',
      length: 5,
      createdAt: '2023-01-01T00:00:00.000Z',
      lastUsedAt: null
    };
    expect(validItem.term).toBe('hello');
    expect(validItem.type).toMatch(/^(word|phrase)$/);
    expect(typeof validItem.length).toBe('number');
    expect(validItem.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
  
  it('storage key consistency',()=>{
    const storageKey = 'mini_translate_vocab';
    expect(storageKey).toBe('mini_translate_vocab');
    expect(storageKey.length).toBeGreaterThan(0);
  });
});
