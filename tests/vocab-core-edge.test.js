import { describe,it,expect } from 'vitest';
import { validateTerm, upsert, removeByTerm } from '../src/services/vocab-core.js';

describe('vocab-core edge cases',()=>{
  it('validateTerm handles null/undefined',()=>{ 
    expect(validateTerm(null).ok).toBe(false);
    expect(validateTerm(undefined).ok).toBe(false);
    expect(validateTerm({}).ok).toBe(false);
    expect(validateTerm({term:''}).ok).toBe(false);
  });
  it('validateTerm preserves custom fields',()=>{ 
    const {ok,item}=validateTerm({term:'test',translation:'测试',type:'phrase',createdAt:'2023-01-01'});
    expect(ok).toBe(true);
    expect(item.translation).toBe('测试');
    expect(item.type).toBe('phrase');
    expect(item.createdAt).toBe('2023-01-01');
  });
  it('upsert handles empty list',()=>{ 
    const r=upsert([],{term:'first'});
    expect(r.inserted).toBe(true);
    expect(r.list).toHaveLength(1);
  });
  it('removeByTerm handles non-existent term',()=>{ 
    const list=[{term:'a'},{term:'b'}];
    const r=removeByTerm(list,'c');
    expect(r.removed).toBe(false);
    expect(r.list).toEqual(list);
  });
  it('removeByTerm handles null/undefined term',()=>{ 
    const list=[{term:'a'}];
    expect(removeByTerm(list,null).removed).toBe(false);
    expect(removeByTerm(list,undefined).removed).toBe(false);
  });
});
