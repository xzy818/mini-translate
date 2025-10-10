import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  appendVocabulary,
  readVocabulary,
  removeVocabulary,
  VOCAB_KEY
} from '../src/services/storage.js';

function createChromeStub(initial = []) {
  const localStore = new Map();
  localStore.set(VOCAB_KEY, initial);

  const getMock = vi.fn((defaults, cb) => {
    const result = { ...defaults };
    Object.keys(defaults).forEach((key) => {
      if (localStore.has(key)) {
        result[key] = localStore.get(key);
      }
    });
    setTimeout(() => cb(result), 0);
  });

  const setMock = vi.fn((values, cb) => {
    Object.entries(values).forEach(([key, value]) => {
      localStore.set(key, value);
    });
    cb && setTimeout(cb, 0);
  });

  return {
    storage: {
      local: {
        get: getMock,
        set: setMock
      }
    },
    runtime: {
      lastError: null
    },
    _localStore: localStore,
    _mocks: { getMock, setMock }
  };
}

describe('storage case-insensitive vocabulary handling', () => {
  let chromeStub;

  beforeEach(() => {
    chromeStub = createChromeStub();
  });

  it('deduplicates inserts ignoring case and preserves original casing', async () => {
    await appendVocabulary(chromeStub, { term: 'Agents', translation: '代理人' });
    await appendVocabulary(chromeStub, { term: 'agents', translation: '代表' });

    const list = await readVocabulary(chromeStub);
    expect(list).toHaveLength(1);
    expect(list[0].term).toBe('Agents');
    expect(list[0].translation).toBe('代表');
    expect(list[0].canonical).toBe('agents');
  });

  it('removes entries case-insensitively', async () => {
    await appendVocabulary(chromeStub, { term: 'Agents', translation: '代理人' });
    await removeVocabulary(chromeStub, 'agents');

    const list = await readVocabulary(chromeStub);
    expect(list).toHaveLength(0);
  });

  it('normalizes existing duplicates when reading from storage', async () => {
    const initial = [
      { term: 'Agents', translation: '一版', createdAt: '2024-01-01T00:00:00.000Z' },
      { term: 'agents', translation: '二版', createdAt: '2024-02-01T00:00:00.000Z' }
    ];
    chromeStub = createChromeStub(initial);

    const list = await readVocabulary(chromeStub);
    expect(list).toHaveLength(1);
    expect(list[0].term).toBe('Agents');
    expect(list[0].translation).toBe('二版');
    expect(chromeStub._mocks.setMock).toHaveBeenCalled();
  });
});
