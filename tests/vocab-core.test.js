import { describe,it,expect } from 'vitest';
import { validateTerm, upsert, removeByTerm, MAX_VOCAB } from '../src/services/vocab-core.js';

describe('vocab-core',()=>{
  it('validateTerm ok',()=>{ const {ok,item}=validateTerm({term:'cat'}); expect(ok).toBe(true); expect(item.term).toBe('cat'); expect(item.length).toBe(3);});
  it('validateTerm invalid',()=>{ const r=validateTerm({term:'  '}); expect(r.ok).toBe(false); expect(r.error).toBe('INVALID_TERM');});
  it('upsert insert then replace (dedupe)',()=>{ let list=[]; let r=upsert(list,{term:'a'}); expect(r.inserted).toBe(true); list=r.list; r=upsert(list,{term:'a'}); expect(r.replaced).toBe(true);});
  it('upsert respects MAX_VOCAB',()=>{ const list=Array.from({length:MAX_VOCAB},(_,i)=>({term:'t'+i})); const r=upsert(list,{term:'new'}); expect(r.error).toBe('LIMIT_EXCEEDED');});
  it('removeByTerm removes existing',()=>{ const list=[{term:'a'},{term:'b'}]; const r=removeByTerm(list,'a'); expect(r.removed).toBe(true); expect(r.list).toEqual([{term:'b'}]);});
});
