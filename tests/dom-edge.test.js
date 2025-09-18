import { describe,it,expect } from 'vitest';
import { escapeRegExp, buildWordRegex, replaceWithMark } from '../src/services/dom.js';

describe('dom helpers edge cases',()=>{
  it('escapeRegExp handles empty string',()=>{ expect(escapeRegExp('')).toBe(''); });
  it('escapeRegExp handles special chars',()=>{ 
    const input = '.*+?^${}()|[]\\';
    const expected = '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\';
    expect(escapeRegExp(input)).toBe(expected);
  });
  it('buildWordRegex handles empty term',()=>{ 
    const re=buildWordRegex('');
    // Empty regex matches everything, so we test it doesn't break
    expect(re.source).toBe('\\b\\b');
  });
  it('replaceWithMark handles empty text',()=>{ 
    expect(replaceWithMark('','cat','X')).toBe('');
  });
  it('replaceWithMark handles empty term',()=>{ 
    // Empty term creates regex that matches word boundaries, so we expect it to match
    expect(replaceWithMark('hello world','','X')).toBe('(X)hello(X) (X)world(X)');
  });
  it('replaceWithMark handles undefined translation',()=>{ 
    expect(replaceWithMark('a cat','cat')).toBe('a cat(T)');
  });
});
