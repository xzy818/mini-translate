// tests/cloud-sync.test.js
import { vi } from 'vitest';
import { cloudSyncService } from '../src/services/cloud-sync.js';
import { googleAuthService } from '../src/services/google-auth.js';

describe('CloudSyncService', () => {
  beforeEach(() => {
    // Mock chrome.storage API
    global.chrome = {
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue(),
          remove: jest.fn().mockResolvedValue()
        },
        sync: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue()
        }
      }
    };

    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    googleAuthService.isUserAuthenticated = jest.fn(() => true);
    googleAuthService.getAccessToken = jest.fn(() => 'mock-access-token');
  });

  afterEach(() => {
    jest.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('syncData', () => {
    it('should sync data between local and cloud storage', async () => {
      const mockLocalData = {
        vocabulary: {
          items: [
            { term: 'hello', translation: '你好', lastModified: Date.now() }
          ]
        }
      };
      const mockCloudData = {
        vocabulary: {
          items: [
            { term: 'world', translation: '世界', lastModified: Date.now() }
          ]
        }
      };

      chrome.storage.local.get.mockResolvedValue(mockLocalData);
      chrome.storage.sync.get.mockResolvedValue(mockCloudData);

      const detectSpy = vi.spyOn(cloudSyncService, 'detectConflicts').mockResolvedValue([]);
      const mergeSpy = vi.spyOn(cloudSyncService, 'mergeData').mockResolvedValue({
        vocabulary: {
          items: [...mockLocalData.vocabulary.items, ...mockCloudData.vocabulary.items]
        }
      });
      const uploadSpy = vi.spyOn(cloudSyncService, 'uploadData').mockResolvedValue();
      const getCloudSpy = vi.spyOn(cloudSyncService, 'getCloudData').mockResolvedValue(mockCloudData);

      await cloudSyncService.syncData();

      expect(detectSpy).toHaveBeenCalled();
      expect(mergeSpy).toHaveBeenCalled();
      expect(uploadSpy).toHaveBeenCalled();
      expect(getCloudSpy).toHaveBeenCalled();
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

      const conflicts = await cloudSyncService.detectConflicts(localData, cloudData);
      expect(Array.isArray(conflicts)).toBe(true);
    });

    it('should return empty array when no conflicts', async () => {
      const localData = {
        vocabulary: { items: [] }
      };
      const cloudData = {
        vocabulary: { items: [] }
      };

      const conflicts = await cloudSyncService.detectConflicts(localData, cloudData);
      expect(conflicts).toEqual([]);
    });
  });

  describe('mergeData', () => {
    it('should merge local and cloud data', async () => {
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
      const conflicts = [];

      const mergedData = await cloudSyncService.mergeData(localData, cloudData, conflicts);
      expect(mergedData).toBeDefined();
      expect(mergedData.vocabulary).toBeDefined();
    });
  });

  describe('uploadData', () => {
    it('should upload data to cloud storage', async () => {
      const testData = {
        vocabulary: {
          items: [
            { term: 'test', translation: '测试', lastModified: Date.now() }
          ]
        }
      };

      await cloudSyncService.uploadData(testData);
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });
  });

  describe('downloadData', () => {
    it('should download data from cloud storage', async () => {
      const mockCloudData = {
        vocabulary: {
          items: [
            { term: 'cloud', translation: '云端', lastModified: Date.now() }
          ]
        },
        settings: { theme: 'dark' },
        syncMetadata: { lastModified: Date.now(), source: 'chrome.sync' }
      };

      chrome.storage.sync.get.mockResolvedValue({
        vocabulary: mockCloudData.vocabulary,
        settings: mockCloudData.settings,
        syncMetadata: mockCloudData.syncMetadata
      });
      const downloadedData = await cloudSyncService.downloadData();
      expect(downloadedData).toEqual(mockCloudData);
    });
  });

  describe('compressData', () => {
    it('should compress data to save storage space', async () => {
      const testData = {
        vocabulary: {
          items: [
            { term: 'test', translation: '测试', lastModified: Date.now() }
          ]
        }
      };

      const compressedData = await cloudSyncService.compressData(testData);
      expect(compressedData).toBeDefined();
    });
  });
});
