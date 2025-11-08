import { describe, it, expect } from 'vitest';
import { exportToTxt, exportToJson, importFromTxt, importFromJson } from '../../../public/services/vocab-io.js';
import { MAX_VOCAB } from '../../../public/services/vocab-core.js';

describe('public/services/vocab-io.js', () => {
  const baseDate = new Date('2024-01-01').toISOString();
  const laterDate = new Date('2024-01-02').toISOString();

  describe('exportToTxt', () => {
    it('exports empty list as empty string', () => {
      expect(exportToTxt([])).toBe('');
      expect(exportToTxt(null)).toBe('');
    });

    it('exports terms sorted by createdAt', () => {
      const items = [
        { term: 'zebra', createdAt: laterDate },
        { term: 'apple', createdAt: baseDate }
      ];
      expect(exportToTxt(items)).toBe('apple\nzebra');
    });

    it('handles null/undefined gracefully', () => {
      expect(exportToTxt(null)).toBe('');
      expect(exportToTxt(undefined)).toBe('');
    });
  });

  describe('exportToJson', () => {
    it('exports empty list', () => {
      const json = exportToJson([]);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.items).toEqual([]);
      expect(parsed.exportedAt).toBeTruthy();
    });

    it('exports full list with metadata', () => {
      const items = [{ term: 'hello', translation: '你好' }];
      const json = exportToJson(items);
      const parsed = JSON.parse(json);
      expect(parsed.items).toEqual(items);
    });

    it('handles null/undefined', () => {
      const json = exportToJson(null);
      const parsed = JSON.parse(json);
      expect(parsed.items).toEqual([]);
    });
  });

  describe('importFromTxt', () => {
    it('handles empty text', () => {
      const res = importFromTxt('', []);
      expect(res.list).toEqual([]);
      expect(res.inserted).toBe(0);
      expect(res.failed).toEqual([]);
    });

    it('imports valid terms and skips empty lines', () => {
      const txt = 'hello\n\nworld\n  \napple';
      const res = importFromTxt(txt, []);
      expect(res.inserted).toBe(3);
      expect(res.list.length).toBe(3);
      expect(res.failed.length).toBe(0);
    });

    it('skips empty lines and handles whitespace-only lines', () => {
      const txt = 'hello\n   \n\t\t\nworld';
      const res = importFromTxt(txt, []);
      expect(res.inserted).toBe(2); // only hello and world
      expect(res.failed.length).toBe(0);
    });

    it('deduplicates case-insensitive and replaces', () => {
      const txt = 'Hello\nHELLO\nhello';
      const res = importFromTxt(txt, []);
      expect(res.inserted).toBe(1);
      expect(res.list.length).toBe(1);
      // all treated as same term, only first inserted
    });

    it('stops at MAX_VOCAB and marks remaining as failed', () => {
      const existing = Array.from({ length: MAX_VOCAB }, (_, i) => ({
        term: `term${i}`,
        createdAt: baseDate
      }));
      const txt = 'newterm';
      const res = importFromTxt(txt, existing);
      expect(res.failed.some(f => f.reason === 'LIMIT_EXCEEDED')).toBe(true);
      expect(res.inserted).toBe(0);
    });

    it('handles CRLF line endings', () => {
      const txt = 'hello\r\nworld\r\napple';
      const res = importFromTxt(txt, []);
      expect(res.inserted).toBe(3);
    });

    it('merges with existing list', () => {
      const existing = [{ term: 'existing', createdAt: baseDate }];
      const res = importFromTxt('newterm', existing);
      expect(res.list.length).toBe(2);
      expect(res.inserted).toBe(1);
    });
  });

  describe('importFromJson', () => {
    it('handles invalid JSON', () => {
      const res = importFromJson('not json', []);
      expect(res.failed).toEqual([{ line: 0, reason: 'INVALID_JSON' }]);
      expect(res.inserted).toBe(0);
    });

    it('imports valid JSON items', () => {
      const json = JSON.stringify({
        version: 1,
        items: [{ term: 'hello' }, { term: 'world' }]
      });
      const res = importFromJson(json, []);
      expect(res.inserted).toBe(2);
      expect(res.list.length).toBe(2);
    });

    it('handles empty items array', () => {
      const json = JSON.stringify({ version: 1, items: [] });
      const res = importFromJson(json, []);
      expect(res.inserted).toBe(0);
      expect(res.list).toEqual([]);
    });

    it('handles missing items key', () => {
      const json = JSON.stringify({ version: 1 });
      const res = importFromJson(json, []);
      expect(res.inserted).toBe(0);
      expect(res.list).toEqual([]);
    });

    it('handles invalid items', () => {
      const json = JSON.stringify({
        version: 1,
        items: [{ term: '' }, { term: 'valid' }, null, { foo: 'bar' }]
      });
      const res = importFromJson(json, []);
      expect(res.inserted).toBe(1);
      expect(res.failed.some(f => f.reason === 'INVALID_TERM')).toBe(true);
    });

    it('stops at MAX_VOCAB and marks remaining as failed', () => {
      const existing = Array.from({ length: MAX_VOCAB }, (_, i) => ({
        term: `term${i}`,
        createdAt: baseDate
      }));
      const json = JSON.stringify({
        version: 1,
        items: [{ term: 'newterm' }]
      });
      const res = importFromJson(json, existing);
      expect(res.failed.some(f => f.reason === 'LIMIT_EXCEEDED')).toBe(true);
      expect(res.inserted).toBe(0);
    });

    it('merges with existing list', () => {
      const existing = [{ term: 'existing', createdAt: baseDate }];
      const json = JSON.stringify({
        version: 1,
        items: [{ term: 'newterm' }]
      });
      const res = importFromJson(json, existing);
      expect(res.list.length).toBe(2);
      expect(res.inserted).toBe(1);
    });

    it('handles null/undefined gracefully', () => {
      const res = importFromJson(null, []);
      expect(res.failed[0].reason).toBe('INVALID_JSON');
    });
  });
});
