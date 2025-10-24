/**
 * 云端同步服务
 * 处理数据在本地和云端之间的同步
 */

import OAuthConfig from '../config/oauth-config.js';
import googleAuthService from './google-auth.js';
import conflictResolverService from './conflict-resolver.js';

class CloudSyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncQueue = [];
    this.retryCount = 0;
    this.maxRetries = OAuthConfig.sync.maxRetries;
    this.retryDelay = OAuthConfig.sync.retryDelay;
    
    // 绑定方法
    this.syncData = this.syncData.bind(this);
    this.handleSyncError = this.handleSyncError.bind(this);
    
    // 初始化
    this.init();
  }

  /**
   * 初始化同步服务
   */
  async init() {
    try {
      // 加载上次同步时间
      await this.loadLastSyncTime();
      
      // 设置自动同步
      this.setupAutoSync();
      
      console.log('云端同步服务已初始化');
    } catch (error) {
      console.error('初始化云端同步服务失败:', error);
    }
  }

  /**
   * 执行数据同步
   */
  async syncData() {
    if (this.isSyncing) {
      console.log('同步正在进行中，跳过此次同步请求');
      return;
    }

    try {
      this.isSyncing = true;
      console.log('开始云端数据同步...');
      
      // 检查认证状态
      if (!googleAuthService.isUserAuthenticated()) {
        throw new Error('用户未认证，无法进行同步');
      }

      // 获取本地数据
      const localData = await this.getLocalData();
      
      // 获取云端数据
      const cloudData = await this.getCloudData();
      
      // 检测冲突
      const conflicts = await this.detectConflicts(localData, cloudData);
      
      if (conflicts.length > 0) {
        console.log(`检测到 ${conflicts.length} 个数据冲突`);
        // 处理冲突
        const resolvedData = await this.resolveConflicts(localData, cloudData, conflicts);
        await this.uploadData(resolvedData);
        await this.saveLocalData(resolvedData);
      } else {
        console.log('未检测到冲突，执行数据合并');
        // 合并数据
        const mergedData = await this.mergeData(localData, cloudData);
        await this.uploadData(mergedData);
        await this.saveLocalData(mergedData);
      }

      // 更新同步时间
      this.lastSyncTime = Date.now();
      await this.saveLastSyncTime();
      
      // 重置重试计数
      this.retryCount = 0;
      
      console.log('云端数据同步完成');
      
      // 通知同步完成
      this.notifySyncComplete(true);
      
    } catch (error) {
      console.error('同步失败:', error);
      this.handleSyncError(error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 获取本地数据
   */
  async getLocalData() {
    try {
      const result = await chrome.storage.local.get([
        'vocabulary',
        'settings',
        'userPreferences'
      ]);
      
      return {
        vocabulary: result.vocabulary || { items: [] },
        settings: result.settings || {},
        userPreferences: result.userPreferences || {},
        lastModified: Date.now(),
        source: 'local'
      };
    } catch (error) {
      console.error('获取本地数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取云端数据
   */
  async getCloudData() {
    try {
      // 首先尝试从chrome.storage.sync获取
      const syncResult = await chrome.storage.sync.get([
        OAuthConfig.storage.syncKeys.vocabulary,
        OAuthConfig.storage.syncKeys.settings,
        OAuthConfig.storage.syncKeys.syncMetadata
      ]);
      
      if (syncResult && Object.keys(syncResult).length > 0) {
        return {
          vocabulary: syncResult[OAuthConfig.storage.syncKeys.vocabulary] || { items: [] },
          settings: syncResult[OAuthConfig.storage.syncKeys.settings] || {},
          syncMetadata: syncResult[OAuthConfig.storage.syncKeys.syncMetadata] || {},
          lastModified: syncResult.syncMetadata?.lastModified || 0,
          source: 'chrome.sync'
        };
      }
      
      // 如果chrome.storage.sync为空，尝试从Google Drive获取
      return await this.getGoogleDriveData();
      
    } catch (error) {
      console.error('获取云端数据失败:', error);
      throw error;
    }
  }

  /**
   * 从Google Drive获取数据
   */
  async getGoogleDriveData() {
    try {
      const accessToken = googleAuthService.getAccessToken();
      if (!accessToken) {
        throw new Error('无访问令牌，无法访问Google Drive');
      }

      // 搜索备份文件
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='mini-translate-backup.json'&fields=files(id,name,modifiedTime)`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`搜索Google Drive文件失败: ${searchResponse.status}`);
      }

      const searchResult = await searchResponse.json();
      
      if (searchResult.files.length === 0) {
        // 没有找到备份文件，返回空数据
        return {
          vocabulary: { items: [] },
          settings: {},
          syncMetadata: {},
          lastModified: 0,
          source: 'google.drive'
        };
      }

      // 获取最新文件
      const latestFile = searchResult.files[0];
      
      // 下载文件内容
      const downloadResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!downloadResponse.ok) {
        throw new Error(`下载Google Drive文件失败: ${downloadResponse.status}`);
      }

      const fileContent = await downloadResponse.json();
      
      return {
        ...fileContent,
        lastModified: new Date(latestFile.modifiedTime).getTime(),
        source: 'google.drive'
      };
      
    } catch (error) {
      console.error('从Google Drive获取数据失败:', error);
      throw error;
    }
  }

  /**
   * 检测数据冲突
   */
  async detectConflicts(localData, cloudData) {
    try {
      console.log('检测数据冲突...');
      
      const conflicts = [];
      
      // 检查词汇表冲突
      const vocabularyConflicts = await this.detectVocabularyConflicts(
        localData.vocabulary, 
        cloudData.vocabulary
      );
      conflicts.push(...vocabularyConflicts);
      
      // 检查设置冲突
      const settingsConflicts = await this.detectSettingsConflicts(
        localData.settings, 
        cloudData.settings
      );
      conflicts.push(...settingsConflicts);
      
      console.log(`检测到 ${conflicts.length} 个冲突`);
      return conflicts;
      
    } catch (error) {
      console.error('检测冲突失败:', error);
      throw error;
    }
  }

  /**
   * 检测词汇表冲突
   */
  async detectVocabularyConflicts(localVocab, cloudVocab) {
    const conflicts = [];
    const localItems = new Map(localVocab.items.map(item => [item.term, item]));
    const cloudItems = new Map(cloudVocab.items.map(item => [item.term, item]));
    
    // 检查修改冲突
    for (const [term, localItem] of localItems.entries()) {
      if (cloudItems.has(term)) {
        const cloudItem = cloudItems.get(term);
        if (localItem.lastModified !== cloudItem.lastModified) {
          conflicts.push({
            type: 'vocabulary',
            term,
            local: localItem,
            cloud: cloudItem,
            conflictType: 'modification'
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * 检测设置冲突
   */
  async detectSettingsConflicts(localSettings, cloudSettings) {
    const conflicts = [];
    
    // 检查关键设置冲突
    const criticalSettings = ['aiProvider', 'apiKey', 'targetLanguage'];
    
    for (const setting of criticalSettings) {
      if (localSettings[setting] !== cloudSettings[setting]) {
        conflicts.push({
          type: 'settings',
          key: setting,
          local: localSettings[setting],
          cloud: cloudSettings[setting],
          conflictType: 'value_mismatch'
        });
      }
    }
    
    return conflicts;
  }

  /**
   * 解决冲突
   */
  async resolveConflicts(localData, cloudData, conflicts) {
    try {
      console.log('解决数据冲突...');
      
      // 使用冲突解决服务
      const resolvedData = await conflictResolverService.resolveConflicts(
        localData, 
        cloudData, 
        conflicts
      );
      
      return resolvedData;
      
    } catch (error) {
      console.error('解决冲突失败:', error);
      throw error;
    }
  }

  /**
   * 合并数据
   */
  async mergeData(localData, cloudData) {
    try {
      console.log('合并数据...');
      
      // 选择更新的数据源
      const useLocal = localData.lastModified > cloudData.lastModified;
      const baseData = useLocal ? localData : cloudData;
      const otherData = useLocal ? cloudData : localData;
      
      // 合并词汇表
      const mergedVocabulary = await this.mergeVocabulary(
        baseData.vocabulary, 
        otherData.vocabulary
      );
      
      // 合并设置
      const mergedSettings = { ...baseData.settings, ...otherData.settings };
      
      // 合并用户偏好
      const mergedPreferences = { ...baseData.userPreferences, ...otherData.userPreferences };
      
      return {
        vocabulary: mergedVocabulary,
        settings: mergedSettings,
        userPreferences: mergedPreferences,
        lastModified: Date.now(),
        source: 'merged'
      };
      
    } catch (error) {
      console.error('合并数据失败:', error);
      throw error;
    }
  }

  /**
   * 合并词汇表
   */
  async mergeVocabulary(baseVocab, otherVocab) {
    const mergedItems = new Map();
    
    // 添加基础词汇
    for (const item of baseVocab.items) {
      mergedItems.set(item.term, item);
    }
    
    // 添加其他词汇（如果不存在或更新）
    for (const item of otherVocab.items) {
      if (!mergedItems.has(item.term) || 
          item.lastModified > mergedItems.get(item.term).lastModified) {
        mergedItems.set(item.term, item);
      }
    }
    
    return {
      items: Array.from(mergedItems.values()),
      totalCount: mergedItems.size
    };
  }

  /**
   * 上传数据到云端
   */
  async uploadData(data) {
    try {
      console.log('上传数据到云端...');
      
      // 压缩数据
      const compressedData = await this.compressData(data);
      
      // 上传到chrome.storage.sync
      await this.uploadToChromeSync(compressedData);
      
      // 上传到Google Drive作为备份
      await this.uploadToGoogleDrive(compressedData);
      
      console.log('数据上传完成');
      
    } catch (error) {
      console.error('上传数据失败:', error);
      throw error;
    }
  }

  /**
   * 上传到Chrome同步存储
   */
  async uploadToChromeSync(data) {
    try {
      const syncData = {
        [OAuthConfig.storage.syncKeys.vocabulary]: data.vocabulary,
        [OAuthConfig.storage.syncKeys.settings]: data.settings,
        [OAuthConfig.storage.syncKeys.syncMetadata]: {
          lastModified: data.lastModified,
          source: data.source,
          version: '1.0'
        }
      };
      
      await chrome.storage.sync.set(syncData);
      console.log('数据已上传到Chrome同步存储');
      
    } catch (error) {
      console.error('上传到Chrome同步存储失败:', error);
      throw error;
    }
  }

  /**
   * 上传到Google Drive
   */
  async uploadToGoogleDrive(data) {
    try {
      const accessToken = googleAuthService.getAccessToken();
      if (!accessToken) {
        console.warn('无访问令牌，跳过Google Drive上传');
        return;
      }

      const fileName = 'mini-translate-backup.json';
      const fileContent = JSON.stringify(data, null, 2);
      
      // 创建文件元数据
      const metadata = {
        name: fileName,
        parents: ['appDataFolder']
      };
      
      // 上传文件
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', new Blob([fileContent], { type: 'application/json' }));
      
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`上传到Google Drive失败: ${response.status}`);
      }
      
      console.log('数据已上传到Google Drive');
      
    } catch (error) {
      console.error('上传到Google Drive失败:', error);
      // 不抛出错误，因为这是备份功能
    }
  }

  /**
   * 保存本地数据
   */
  async saveLocalData(data) {
    try {
      await chrome.storage.local.set({
        vocabulary: data.vocabulary,
        settings: data.settings,
        userPreferences: data.userPreferences
      });
      
      console.log('本地数据已保存');
      
    } catch (error) {
      console.error('保存本地数据失败:', error);
      throw error;
    }
  }

  /**
   * 压缩数据
   */
  async compressData(data) {
    try {
      // 简单的数据压缩：移除不必要的字段
      const compressed = {
        vocabulary: {
          items: data.vocabulary.items.map(item => ({
            term: item.term,
            translation: item.translation,
            lastModified: item.lastModified
          }))
        },
        settings: data.settings,
        userPreferences: data.userPreferences,
        lastModified: data.lastModified,
        source: data.source
      };
      
      return compressed;
      
    } catch (error) {
      console.error('压缩数据失败:', error);
      return data; // 返回原始数据
    }
  }

  /**
   * 处理同步错误
   */
  async handleSyncError(error) {
    console.error('同步错误:', error);
    
    this.retryCount++;
    
    if (this.retryCount < this.maxRetries) {
      console.log(`将在 ${this.retryDelay}ms 后重试同步 (${this.retryCount}/${this.maxRetries})`);
      
      setTimeout(() => {
        this.syncData().catch(err => {
          console.error('重试同步失败:', err);
        });
      }, this.retryDelay);
    } else {
      console.error('同步重试次数已达上限');
      this.notifySyncComplete(false, error);
    }
  }

  /**
   * 设置自动同步
   */
  setupAutoSync() {
    // 设置定时同步
    setInterval(() => {
      if (googleAuthService.isUserAuthenticated()) {
        this.syncData().catch(error => {
          console.error('自动同步失败:', error);
        });
      }
    }, OAuthConfig.sync.autoSyncInterval);
  }

  /**
   * 加载上次同步时间
   */
  async loadLastSyncTime() {
    try {
      const result = await chrome.storage.local.get(['lastSyncTime']);
      this.lastSyncTime = result.lastSyncTime || null;
    } catch (error) {
      console.error('加载上次同步时间失败:', error);
    }
  }

  /**
   * 保存上次同步时间
   */
  async saveLastSyncTime() {
    try {
      await chrome.storage.local.set({
        lastSyncTime: this.lastSyncTime
      });
    } catch (error) {
      console.error('保存上次同步时间失败:', error);
    }
  }

  /**
   * 通知同步完成
   */
  notifySyncComplete(success, error = null) {
    const event = new CustomEvent('cloudSyncComplete', {
      detail: {
        success,
        error,
        timestamp: Date.now(),
        lastSyncTime: this.lastSyncTime
      }
    });
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries
    };
  }

  /**
   * 强制同步
   */
  async forceSync() {
    console.log('强制同步数据...');
    this.retryCount = 0;
    return await this.syncData();
  }
}

// 创建单例实例
const cloudSyncService = new CloudSyncService();

// 导出服务实例
export default cloudSyncService;