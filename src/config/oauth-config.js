/**
 * OAuth配置
 * 集中管理OAuth相关的配置信息
 */

class OAuthConfig {
  constructor() {
    this.manifest = chrome.runtime.getManifest();
    this.oauth2 = this.manifest.oauth2 || {};
    
    // 基础配置
    this.clientId = this.oauth2.client_id || 'YOUR_CLIENT_ID';
    this.scopes = this.oauth2.scopes || ['openid', 'email', 'profile'];
    
    // 存储配置
    this.storage = {
      syncKeys: {
        vocabulary: 'vocabulary',
        settings: 'settings',
        syncMetadata: 'syncMetadata'
      },
      maxSyncItems: 100,
      maxSyncBytes: 1024 * 1024 // 1MB
    };
    
    // 同步配置
    this.sync = {
      autoSyncInterval: 5 * 60 * 1000, // 5分钟
      maxRetries: 3,
      retryDelay: 1000, // 1秒
      batchSize: 10
    };
    
    // Google Drive配置
    this.googleDrive = {
      backupFileName: 'mini-translate-backup.json',
      maxBackupFiles: 5,
      backupInterval: 24 * 60 * 60 * 1000 // 24小时
    };
    
    // 冲突解决配置
    this.conflictResolution = {
      defaultStrategy: 'timestamp',
      autoResolve: true,
      showUI: true,
      maxConflicts: 10
    };
  }

  /**
   * 获取OAuth配置
   */
  getOAuthConfig() {
    return {
      client_id: this.clientId,
      scopes: this.scopes
    };
  }

  /**
   * 获取存储配置
   */
  getStorageConfig() {
    return this.storage;
  }

  /**
   * 获取同步配置
   */
  getSyncConfig() {
    return this.sync;
  }

  /**
   * 获取Google Drive配置
   */
  getGoogleDriveConfig() {
    return this.googleDrive;
  }

  /**
   * 获取冲突解决配置
   */
  getConflictResolutionConfig() {
    return this.conflictResolution;
  }

  /**
   * 验证配置
   */
  validateConfig() {
    const errors = [];
    
    if (!this.clientId || this.clientId === 'YOUR_CLIENT_ID') {
      errors.push('OAuth client_id 未配置');
    }
    
    if (!this.scopes || this.scopes.length === 0) {
      errors.push('OAuth scopes 未配置');
    }
    
    if (this.sync.autoSyncInterval < 60000) {
      errors.push('自动同步间隔不能少于1分钟');
    }
    
    if (this.sync.maxRetries < 1) {
      errors.push('最大重试次数不能少于1');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    try {
      if (newConfig.storage) {
        this.storage = { ...this.storage, ...newConfig.storage };
      }
      
      if (newConfig.sync) {
        this.sync = { ...this.sync, ...newConfig.sync };
      }
      
      if (newConfig.googleDrive) {
        this.googleDrive = { ...this.googleDrive, ...newConfig.googleDrive };
      }
      
      if (newConfig.conflictResolution) {
        this.conflictResolution = { ...this.conflictResolution, ...newConfig.conflictResolution };
      }
      
      console.log('OAuth配置已更新');
      
    } catch (error) {
      console.error('更新OAuth配置失败:', error);
      throw error;
    }
  }

  /**
   * 重置配置
   */
  resetConfig() {
    this.storage = {
      syncKeys: {
        vocabulary: 'vocabulary',
        settings: 'settings',
        syncMetadata: 'syncMetadata'
      },
      maxSyncItems: 100,
      maxSyncBytes: 1024 * 1024
    };
    
    this.sync = {
      autoSyncInterval: 5 * 60 * 1000,
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 10
    };
    
    this.googleDrive = {
      backupFileName: 'mini-translate-backup.json',
      maxBackupFiles: 5,
      backupInterval: 24 * 60 * 60 * 1000
    };
    
    this.conflictResolution = {
      defaultStrategy: 'timestamp',
      autoResolve: true,
      showUI: true,
      maxConflicts: 10
    };
    
    console.log('OAuth配置已重置');
  }
}

// 创建单例实例
const oauthConfig = new OAuthConfig();

// 导出配置实例
export default oauthConfig;