import { describe,it,expect } from 'vitest';
import { escapeRegExp, buildWordRegex, replaceWithMark } from '../src/services/dom.js';

describe('dom helpers',()=>{
  it('escapeRegExp works',()=>{ expect(escapeRegExp('a+b')).toBe('a\\+b'); });
  it('buildWordRegex bounds',()=>{ const re=buildWordRegex('cat'); expect('a cat!'.match(re)).not.toBeNull(); expect('concatenate'.match(re)).toBeNull(); });
  it('replaceWithMark',()=>{ expect(replaceWithMark('a cat and Cat','cat','X')).toBe('a cat(X) and Cat(X)'); });
});
