import { describe, it, expect } from 'vitest';
import { readVocabulary, writeVocabulary, appendVocabulary, removeVocabulary, VOCAB_KEY } from '../src/services/storage.js';

function createChromeMock() {
  const bag = { [VOCAB_KEY]: [] };
  const runtime = { lastError: null };
  return {
    runtime,
    storage: {
      local: {
        get(defaults, cb) {
          cb({ [VOCAB_KEY]: bag[VOCAB_KEY] });
        },
        set(obj, cb) {
          Object.assign(bag, obj);
          cb && cb();
        }
      }
    },
    _bag: bag
  };
}

describe('storage branches & fallbacks', () => {
  it('readVocabulary normalizes list, merges duplicates and sorts by createdAt', async () => {
    const chrome = createChromeMock();
    chrome._bag[VOCAB_KEY] = [
      { term: 'Agent', translation: '代理' },
      { term: 'agent', translation: '' },
      { term: 'Deep Seek', translation: '深度搜寻', type: 'phrase', createdAt: '2024-01-01T00:00:00.000Z' }
    ];
    const list = await readVocabulary(chrome);
    expect(list[0].term).toBe('Deep Seek');
    expect(list.find(x => x.canonical === 'agent').translation).toBe('代理');
  });

  it('writeVocabulary persists normalized list', async () => {
    const chrome = createChromeMock();
    await writeVocabulary(chrome, [{ term: ' A ', translation: 'a' }]);
    expect(chrome._bag[VOCAB_KEY][0].canonical).toBe('a');
  });

  it('appendVocabulary inserts then updates with merge when term exists', async () => {
    const chrome = createChromeMock();
    await appendVocabulary(chrome, { term: 'Agent', translation: '代理' });
    const first = chrome._bag[VOCAB_KEY];
    expect(first.length).toBe(1);
    await appendVocabulary(chrome, { term: 'agent', translation: '代理人' });
    const next = chrome._bag[VOCAB_KEY];
    expect(next.length).toBe(1);
    expect(next[0].translation).toBe('代理人');
  });

  it('removeVocabulary handles not found and invalid term', async () => {
    const chrome = createChromeMock();
    await writeVocabulary(chrome, [{ term: 'Agent' }]);
    const r1 = await removeVocabulary(chrome, '');
    expect(r1.removed).toBe(false);
    const r2 = await removeVocabulary(chrome, 'Unknown');
    expect(r2.removed).toBe(false);
    const r3 = await removeVocabulary(chrome, 'Agent');
    expect(r3.removed).toBe(true);
  });

  it('propagates runtime.lastError on get/set paths', async () => {
    const chrome = createChromeMock();
    // inject error on get
    chrome.storage.local.get = (defaults, cb) => {
      chrome.runtime.lastError = { message: 'get failed' };
      cb({ [VOCAB_KEY]: [] });
    };
    await expect(readVocabulary(chrome)).rejects.toThrow('get failed');

    // inject error on set
    const chrome2 = createChromeMock();
    chrome2.storage.local.set = (obj, cb) => {
      chrome2.runtime.lastError = { message: 'set failed' };
      cb && cb();
    };
    await expect(writeVocabulary(chrome2, [{ term: 'x' }])).rejects.toThrow('set failed');
  });
});




