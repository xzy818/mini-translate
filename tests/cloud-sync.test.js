// tests/cloud-sync.test.js
import { cloudSyncService } from '../src/services/cloud-sync.js';

describe('CloudSyncService', () => {
  beforeEach(() => {
    // Mock chrome.storage API
    global.chrome = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn()
        },
        sync: {
          get: jest.fn(),
          set: jest.fn()
        }
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
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

      // Mock the service methods
      cloudSyncService.detectConflicts = jest.fn().mockResolvedValue([]);
      cloudSyncService.mergeData = jest.fn().mockResolvedValue({
        vocabulary: {
          items: [...mockLocalData.vocabulary.items, ...mockCloudData.vocabulary.items]
        }
      });
      cloudSyncService.uploadData = jest.fn().mockResolvedValue();
      cloudSyncService.downloadData = jest.fn().mockResolvedValue(mockCloudData);

      await cloudSyncService.syncData();

      expect(cloudSyncService.detectConflicts).toHaveBeenCalled();
      expect(cloudSyncService.mergeData).toHaveBeenCalled();
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
        }
      };

      chrome.storage.sync.get.mockResolvedValue(mockCloudData);
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
