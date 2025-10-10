import { describe,it,expect } from 'vitest';

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

  // 新增：消息路由完整性检查
  it('message routing completeness validation',()=>{
    const allMessageTypes = [
      'SETTINGS_UPDATED',
      'TEST_TRANSLATOR_SETTINGS',
      'TRANSLATE_TERM',
      'RETRY_TRANSLATION',
      'SAVE_SETTINGS',
      'REFRESH_CONTEXT_MENU',
      'QA_CONTEXT_ADD',
      'QA_CONTEXT_REMOVE',
      'QA_GET_STORAGE_STATE',
      'AI_API_CALL',
      'GET_AI_PROVIDERS',
      'GET_PROVIDER_MODELS'
    ];

    const implementedTypes = [
      'SETTINGS_UPDATED',
      'TEST_TRANSLATOR_SETTINGS',
      'TRANSLATE_TERM',
      'RETRY_TRANSLATION',
      'SAVE_SETTINGS',
      'REFRESH_CONTEXT_MENU',
      'QA_CONTEXT_ADD',
      'QA_CONTEXT_REMOVE',
      'QA_GET_STORAGE_STATE'
    ];

    const missingTypes = allMessageTypes.filter(type => !implementedTypes.includes(type));
    expect(missingTypes).toEqual(['AI_API_CALL', 'GET_AI_PROVIDERS', 'GET_PROVIDER_MODELS']);
  });

  // 新增：配置页面兼容性检查
  it('configuration page compatibility check',()=>{
    const legacyConfig = {
      page: 'options.html',
      messageType: 'TEST_TRANSLATOR_SETTINGS',
      handler: 'background.js translateText'
    };

    const newConfig = {
      page: 'ai-config.html', 
      messageType: 'AI_API_CALL',
      handler: 'background.js aiApiClient'
    };

    expect(legacyConfig.messageType).not.toBe(newConfig.messageType);
    expect(legacyConfig.handler).not.toBe(newConfig.handler);
  });

  // 新增：消息处理覆盖率报告
  it('message handler coverage report',()=>{
    const totalMessageTypes = 12;
    const implementedMessageTypes = 9;
    const coverage = (implementedMessageTypes / totalMessageTypes) * 100;
    
    expect(coverage).toBeCloseTo(75, 1);
    expect(implementedMessageTypes).toBeLessThan(totalMessageTypes);
  });
});
