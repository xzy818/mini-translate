import { describe,it,expect } from 'vitest';
import { exportToTxt, exportToJson, importFromTxt, importFromJson } from '../src/services/vocab-io.js';

describe('vocab-io import/export',()=>{
  const baseList = [
    { term: 'alpha', translation: '阿尔法', type: 'word', length: 5, createdAt: '2023-01-01T00:00:00.000Z', lastUsedAt: null },
    { term: 'beta', translation: '贝塔', type: 'word', length: 4, createdAt: '2023-01-02T00:00:00.000Z', lastUsedAt: null }
  ];

  it('exportToTxt should output terms by createdAt',()=>{
    const txt = exportToTxt(baseList);
    expect(txt.split('\n')[0]).toBe('alpha');
    expect(txt.split('\n')[1]).toBe('beta');
  });

  it('exportToJson should wrap items with metadata',()=>{
    const json = exportToJson(baseList);
    const obj = JSON.parse(json);
    expect(obj.version).toBe(1);
    expect(Array.isArray(obj.items)).toBe(true);
    expect(obj.items).toHaveLength(2);
  });

  it('importFromTxt should insert valid lines and report failures',()=>{
    const txt = 'gamma\n\n beta \n'; // includes duplicate beta and empty line
    const r = importFromTxt(txt, baseList);
    expect(r.inserted).toBe(1); // gamma
    expect(r.list.find(x=>x.term==='gamma')).toBeTruthy();
    expect(Array.isArray(r.failed)).toBe(true);
  });

  it('importFromJson should handle invalid json',()=>{
    const r = importFromJson('not-json', baseList);
    expect(r.failed[0].reason).toBe('INVALID_JSON');
    expect(r.list).toHaveLength(2);
  });

  it('importFromJson should upsert valid items',()=>{
    const payload = { version:1, items: [{ term:'delta', translation:'德尔塔' }] };
    const r = importFromJson(JSON.stringify(payload), baseList);
    expect(r.inserted).toBe(1);
    expect(r.list.find(x=>x.term==='delta')).toBeTruthy();
  });
});


