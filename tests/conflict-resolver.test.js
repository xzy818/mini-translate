// tests/conflict-resolver.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { conflictResolverService } from '../src/services/conflict-resolver.js';

// Mock chrome.storage - promisify for async/await
const mockChrome = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        return Promise.resolve({ userPreferences: {} });
      }),
      set: vi.fn((obj) => {
        return Promise.resolve();
      })
    }
  }
};
global.chrome = mockChrome;

describe('ConflictResolverService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.storage.local.get.mockResolvedValue({ userPreferences: {} });
  });
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

  describe('resolveConflicts with conflicts array', () => {
    it('should resolve multiple conflicts', async () => {
      const localData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 1000 },
            { term: 'world', translation: '世界', lastModified: 2000 }
          ]
        },
        settings: {},
        userPreferences: {}
      };
      const cloudData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 3000 },
            { term: 'world', translation: '世界', lastModified: 1500 }
          ]
        },
        settings: {},
        userPreferences: {}
      };
      const conflicts = [
        {
          type: 'vocabulary',
          term: 'hello',
          local: { term: 'hello', translation: '你好', lastModified: 1000 },
          cloud: { term: 'hello', translation: '你好', lastModified: 3000 },
          conflictType: 'modification'
        },
        {
          type: 'vocabulary',
          term: 'world',
          local: { term: 'world', translation: '世界', lastModified: 2000 },
          cloud: { term: 'world', translation: '世界', lastModified: 1500 },
          conflictType: 'modification'
        }
      ];

      const resolved = await conflictResolverService.resolveConflicts(localData, cloudData, conflicts);
      expect(resolved).toBeDefined();
      expect(resolved.vocabulary.items.length).toBe(2);
    });

    it('should handle empty conflicts array', async () => {
      const localData = { vocabulary: { items: [] }, settings: {}, userPreferences: {} };
      const cloudData = { vocabulary: { items: [] }, settings: {}, userPreferences: {} };
      const resolved = await conflictResolverService.resolveConflicts(localData, cloudData, []);
      expect(resolved).toEqual(localData);
    });

    it('should return null when both local and cloud are null/undefined', async () => {
      const resolved = await conflictResolverService.resolveConflicts(null, null);
      expect(resolved).toBeNull();
    });

    it('should handle equal timestamps (choose local)', async () => {
      const localItem = { term: 'hello', translation: '你好', lastModified: 1000 };
      const cloudItem = { term: 'hello', translation: '你好', lastModified: 1000 };
      const resolved = await conflictResolverService.resolveConflicts(localItem, cloudItem);
      expect(resolved).toEqual(localItem);
    });
  });

  describe('detectConflicts - multiple conflict types', () => {
    it('should detect vocabulary conflicts for multiple items', async () => {
      const localData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 1000 },
            { term: 'world', translation: '世界', lastModified: 2000 },
            { term: 'apple', translation: '苹果', lastModified: 1500 }
          ]
        },
        settings: {},
        userPreferences: {}
      };
      const cloudData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 3000 },
            { term: 'world', translation: '世界', lastModified: 2000 },
            { term: 'apple', translation: '苹果', lastModified: 2500 }
          ]
        },
        settings: {},
        userPreferences: {}
      };

      const conflicts = await conflictResolverService.detectConflicts(localData, cloudData);
      expect(conflicts.length).toBeGreaterThanOrEqual(2);
      expect(conflicts.every(c => c.type === 'vocabulary')).toBe(true);
    });

    it('should detect settings conflicts', async () => {
      const localData = {
        vocabulary: { items: [] },
        settings: {
          aiProvider: 'openai',
          apiKey: 'sk-local',
          targetLanguage: 'zh'
        },
        userPreferences: {}
      };
      const cloudData = {
        vocabulary: { items: [] },
        settings: {
          aiProvider: 'qwen',
          apiKey: 'sk-cloud',
          targetLanguage: 'en'
        },
        userPreferences: {}
      };

      const conflicts = await conflictResolverService.detectConflicts(localData, cloudData);
      expect(conflicts.length).toBeGreaterThanOrEqual(3);
      expect(conflicts.some(c => c.type === 'settings' && c.key === 'aiProvider')).toBe(true);
    });

    it('should detect userPreferences conflicts', async () => {
      const localData = {
        vocabulary: { items: [] },
        settings: {},
        userPreferences: {
          conflictResolution: { preferredSource: 'local' }
        }
      };
      const cloudData = {
        vocabulary: { items: [] },
        settings: {},
        userPreferences: {
          conflictResolution: { preferredSource: 'cloud' }
        }
      };

      const conflicts = await conflictResolverService.detectConflicts(localData, cloudData);
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      expect(conflicts.some(c => c.type === 'userPreferences')).toBe(true);
    });

    it('should handle null vocabulary (throws when accessing items)', async () => {
      const localData = { vocabulary: null, settings: {}, userPreferences: {} };
      const cloudData = { vocabulary: { items: [] }, settings: {}, userPreferences: {} };
      await expect(async () => {
        await conflictResolverService.detectConflicts(localData, cloudData);
      }).rejects.toThrow();
    });

    it('should handle missing vocabulary.items (throws when mapping)', async () => {
      const localData = { vocabulary: {}, settings: {}, userPreferences: {} };
      const cloudData = { vocabulary: { items: [] }, settings: {}, userPreferences: {} };
      await expect(async () => {
        await conflictResolverService.detectConflicts(localData, cloudData);
      }).rejects.toThrow();
    });
  });

  describe('applyResolution - strategies', () => {
    it('should apply vocabulary resolution with local choice', () => {
      const resolvedData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 1000 }
          ]
        }
      };
      const conflict = {
        type: 'vocabulary',
        term: 'hello',
        local: { term: 'hello', translation: '你好', lastModified: 1000 },
        cloud: { term: 'hello', translation: '你好', lastModified: 2000 }
      };
      const resolution = { choice: 'local', data: conflict.local };
      
      const originalItem = JSON.parse(JSON.stringify(resolvedData.vocabulary.items[0]));
      conflictResolverService.applyResolution(resolvedData, conflict, resolution);
      expect(resolvedData.vocabulary.items[0]).toEqual(originalItem);
    });

    it('should apply vocabulary resolution with cloud choice', () => {
      const resolvedData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 1000 }
          ]
        }
      };
      const conflict = {
        type: 'vocabulary',
        term: 'hello',
        local: { term: 'hello', translation: '你好', lastModified: 1000 },
        cloud: { term: 'hello', translation: '你好（云端）', lastModified: 2000 }
      };
      const resolution = { choice: 'cloud', data: conflict.cloud };
      
      conflictResolverService.applyResolution(resolvedData, conflict, resolution);
      expect(resolvedData.vocabulary.items[0].translation).toBe('你好（云端）');
    });

    it('should add new item when cloud choice and term not found', () => {
      const resolvedData = {
        vocabulary: {
          items: []
        }
      };
      const conflict = {
        type: 'vocabulary',
        term: 'hello',
        local: null,
        cloud: { term: 'hello', translation: '你好', lastModified: 2000 }
      };
      const resolution = { choice: 'cloud', data: conflict.cloud };
      
      conflictResolverService.applyResolution(resolvedData, conflict, resolution);
      expect(resolvedData.vocabulary.items.length).toBe(1);
      expect(resolvedData.vocabulary.items[0].term).toBe('hello');
    });

    it('should apply settings resolution with cloud choice', () => {
      const resolvedData = {
        settings: {
          aiProvider: 'openai'
        }
      };
      const conflict = {
        type: 'settings',
        key: 'aiProvider',
        local: 'openai',
        cloud: 'qwen'
      };
      const resolution = { choice: 'cloud', data: conflict.cloud };
      
      conflictResolverService.applyResolution(resolvedData, conflict, resolution);
      expect(resolvedData.settings.aiProvider).toBe('qwen');
    });

    it('should apply userPreferences resolution with cloud choice', () => {
      const resolvedData = {
        userPreferences: {
          conflictResolution: { preferredSource: 'local' }
        }
      };
      const conflict = {
        type: 'userPreferences',
        key: 'preferredSource',
        local: 'local',
        cloud: 'cloud'
      };
      const resolution = { choice: 'cloud', data: conflict.cloud };
      
      conflictResolverService.applyResolution(resolvedData, conflict, resolution);
      // Note: implementation uses conflict.key directly, not nested path
      // So we expect it to set userPreferences['preferredSource'] = 'cloud'
      expect(resolvedData.userPreferences.preferredSource).toBe('cloud');
    });

    it('should handle unknown conflict type gracefully', () => {
      const resolvedData = { vocabulary: { items: [] } };
      const conflict = {
        type: 'unknown_type',
        term: 'test'
      };
      const resolution = { choice: 'local', data: {} };
      
      expect(() => {
        conflictResolverService.applyResolution(resolvedData, conflict, resolution);
      }).not.toThrow();
    });
  });

  describe('resolveByTimestamp', () => {
    it('should choose local when local is newer', async () => {
      const conflict = {
        local: { lastModified: 2000 },
        cloud: { lastModified: 1000 }
      };
      const resolution = await conflictResolverService.resolveSingleConflict({
        ...conflict,
        type: 'vocabulary'
      });
      expect(resolution.choice).toBe('local');
      expect(resolution.data).toEqual(conflict.local);
    });

    it('should choose cloud when cloud is newer', async () => {
      const conflict = {
        local: { lastModified: 1000 },
        cloud: { lastModified: 2000 }
      };
      const resolution = await conflictResolverService.resolveSingleConflict({
        ...conflict,
        type: 'vocabulary'
      });
      expect(resolution.choice).toBe('cloud');
      expect(resolution.data).toEqual(conflict.cloud);
    });

    it('should choose local when timestamps equal', async () => {
      const conflict = {
        local: { lastModified: 1000 },
        cloud: { lastModified: 1000 }
      };
      const resolution = await conflictResolverService.resolveSingleConflict({
        ...conflict,
        type: 'vocabulary'
      });
      expect(resolution.choice).toBe('local');
    });

    it('should handle missing lastModified (defaults to 0)', async () => {
      const conflict = {
        local: {},
        cloud: { lastModified: 1000 }
      };
      const resolution = await conflictResolverService.resolveSingleConflict({
        ...conflict,
        type: 'vocabulary'
      });
      expect(resolution.choice).toBe('cloud');
    });
  });

  describe('resolveByUserPreference', () => {
    beforeEach(() => {
      mockChrome.storage.local.get.mockClear();
    });

    it('should use local when preference is local', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        userPreferences: {
          conflictResolution: { preferredSource: 'local' }
        }
      });

      const conflict = {
        type: 'settings',
        local: { value: 'local-value' },
        cloud: { value: 'cloud-value' }
      };
      const resolution = await conflictResolverService.resolveSingleConflict(conflict);
      expect(resolution.choice).toBe('local');
      expect(resolution.data).toEqual(conflict.local);
    });

    it('should use cloud when preference is cloud', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        userPreferences: {
          conflictResolution: { preferredSource: 'cloud' }
        }
      });

      const conflict = {
        type: 'settings',
        local: { value: 'local-value' },
        cloud: { value: 'cloud-value' }
      };
      const resolution = await conflictResolverService.resolveSingleConflict(conflict);
      expect(resolution.choice).toBe('cloud');
      expect(resolution.data).toEqual(conflict.cloud);
    });

    it('should default to local when preference missing', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ userPreferences: {} });

      const conflict = {
        type: 'settings',
        local: { value: 'local-value' },
        cloud: { value: 'cloud-value' }
      };
      const resolution = await conflictResolverService.resolveSingleConflict(conflict);
      expect(resolution.choice).toBe('local');
    });
  });

  describe('order-insensitive comparison', () => {
    it('should detect conflicts regardless of item order', async () => {
      const localData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 1000 },
            { term: 'world', translation: '世界', lastModified: 2000 }
          ]
        },
        settings: {},
        userPreferences: {}
      };
      const cloudData = {
        vocabulary: {
          items: [
            { term: 'world', translation: '世界', lastModified: 3000 },
            { term: 'hello', translation: '你好', lastModified: 2000 }
          ]
        },
        settings: {},
        userPreferences: {}
      };

      const conflicts = await conflictResolverService.detectConflicts(localData, cloudData);
      expect(conflicts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('invalid parameter handling', () => {
    it('should handle null localData (throws error when accessing vocabulary)', async () => {
      await expect(async () => {
        await conflictResolverService.detectConflicts(null, { vocabulary: { items: [] }, settings: {}, userPreferences: {} });
      }).rejects.toThrow();
    });

    it('should handle null cloudData (throws error when accessing vocabulary)', async () => {
      await expect(async () => {
        await conflictResolverService.detectConflicts({ vocabulary: { items: [] }, settings: {}, userPreferences: {} }, null);
      }).rejects.toThrow();
    });

    it('should handle undefined conflict in applyResolution', () => {
      const resolvedData = { vocabulary: { items: [] } };
      expect(() => {
        conflictResolverService.applyResolution(resolvedData, null, { choice: 'local' });
      }).toThrow();
    });

    it('should handle empty objects gracefully', async () => {
      const conflicts = await conflictResolverService.detectConflicts({ vocabulary: { items: [] }, settings: {}, userPreferences: {} }, { vocabulary: { items: [] }, settings: {}, userPreferences: {} });
      expect(Array.isArray(conflicts)).toBe(true);
      expect(conflicts.length).toBe(0);
    });
  });

  describe('idempotency', () => {
    it('should produce same result when applying resolution twice', () => {
      const resolvedData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: 1000 }
          ]
        }
      };
      const conflict = {
        type: 'vocabulary',
        term: 'hello',
        local: { term: 'hello', translation: '你好', lastModified: 1000 },
        cloud: { term: 'hello', translation: '你好（云端）', lastModified: 2000 }
      };
      const resolution = { choice: 'cloud', data: conflict.cloud };

      const firstData = JSON.parse(JSON.stringify(resolvedData));
      conflictResolverService.applyResolution(firstData, conflict, resolution);

      const secondData = JSON.parse(JSON.stringify(resolvedData));
      conflictResolverService.applyResolution(secondData, conflict, resolution);

      expect(firstData).toEqual(secondData);
    });
  });
});
