// tests/conflict-resolver.test.js
import { conflictResolverService } from '../src/services/conflict-resolver.js';

describe('ConflictResolverService', () => {
  describe('resolveConflicts', () => {
    it('should resolve conflicts using timestamp priority', async () => {
      const localItem = {
        term: 'hello',
        translation: '你好',
        lastModified: 2000
      };
      const cloudItem = {
        term: 'hello',
        translation: '你好',
        lastModified: 1000
      };

      const resolved = await conflictResolverService.resolveConflicts(localItem, cloudItem);
      expect(resolved).toEqual(localItem);
    });

    it('should return cloud item when cloud is newer', async () => {
      const localItem = {
        term: 'hello',
        translation: '你好',
        lastModified: 1000
      };
      const cloudItem = {
        term: 'hello',
        translation: '你好',
        lastModified: 2000
      };

      const resolved = await conflictResolverService.resolveConflicts(localItem, cloudItem);
      expect(resolved).toEqual(cloudItem);
    });

    it('should return local item when cloud item is null', async () => {
      const localItem = {
        term: 'hello',
        translation: '你好',
        lastModified: 1000
      };

      const resolved = await conflictResolverService.resolveConflicts(localItem, null);
      expect(resolved).toEqual(localItem);
    });

    it('should return cloud item when local item is null', async () => {
      const cloudItem = {
        term: 'hello',
        translation: '你好',
        lastModified: 1000
      };

      const resolved = await conflictResolverService.resolveConflicts(null, cloudItem);
      expect(resolved).toEqual(cloudItem);
    });
  });

  describe('detectConflicts', () => {
    it('should detect conflicts between local and cloud data', async () => {
      const localData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 1000 }
          ]
        }
      };
      const cloudData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 2000 }
          ]
        }
      };

      const conflicts = await conflictResolverService.detectConflicts(localData, cloudData);
      expect(Array.isArray(conflicts)).toBe(true);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]).toHaveProperty('type', 'vocabulary');
      expect(conflicts[0]).toHaveProperty('term', 'hello');
    });

    it('should not detect conflicts when data is identical', async () => {
      const localData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 1000 }
          ]
        }
      };
      const cloudData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 1000 }
          ]
        }
      };

      const conflicts = await conflictResolverService.detectConflicts(localData, cloudData);
      expect(conflicts).toEqual([]);
    });

    it('should detect conflicts for different terms', async () => {
      const localData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 1000 }
          ]
        }
      };
      const cloudData = {
        vocabulary: {
          items: [
            { term: 'world', translation: '世界', lastModified: 2000 }
          ]
        }
      };

      const conflicts = await conflictResolverService.detectConflicts(localData, cloudData);
      expect(conflicts).toEqual([]); // No conflicts for different terms
    });
  });

  describe('showConflictUI', () => {
    it('should display conflict resolution UI', async () => {
      const conflictDetails = {
        type: 'vocabulary',
        term: 'hello',
        local: { term: 'hello', translation: '你好', lastModified: 1000 },
        cloud: { term: 'hello', translation: '你好', lastModified: 2000 }
      };

      const result = await conflictResolverService.showConflictUI(conflictDetails);
      expect(result).toBe('auto-resolve');
    });
  });

  describe('applyResolution', () => {
    it('should apply conflict resolution', async () => {
      const resolution = 'auto-resolve';
      const localData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 1000 }
          ]
        }
      };
      const cloudData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 2000 }
          ]
        }
      };

      const mergedData = await conflictResolverService.applyResolution(resolution, localData, cloudData);
      expect(mergedData).toBeDefined();
    });
  });
});
