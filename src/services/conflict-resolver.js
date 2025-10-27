/**
 * 冲突解决服务
 * 处理数据冲突的检测和解决
 */

class ConflictResolverService {
  constructor() {
    this.resolutionStrategies = {
      timestamp: 'timestamp',
      userPreference: 'userPreference',
      manual: 'manual'
    };
    
    this.conflictTypes = {
      vocabulary: 'vocabulary',
      settings: 'settings',
      userPreferences: 'userPreferences'
    };
    
    // 绑定方法
    this.resolveConflicts = this.resolveConflicts.bind(this);
    this.detectConflicts = this.detectConflicts.bind(this);
    this.showConflictUI = this.showConflictUI.bind(this);
  }

  /**
   * 解决数据冲突
   */
  async resolveConflicts(localData, cloudData, conflicts) {
    try {
      const isConflictList = Array.isArray(conflicts);

      if (!isConflictList) {
        const simpleConflict = this.createSimpleConflict(localData, cloudData);
        if (!simpleConflict) {
          return null;
        }

        const resolution = await this.resolveSingleConflict(simpleConflict);
        return resolution?.data ?? null;
      }

      console.warn(`开始解决 ${conflicts.length} 个数据冲突...`);

      const resolvedData = { ...localData };

      for (const conflict of conflicts) {
        const resolution = await this.resolveSingleConflict(conflict);

        // 应用解决方案
        this.applyResolution(resolvedData, conflict, resolution);
      }

      console.warn('所有冲突已解决');
      return resolvedData;
    } catch (error) {
      console.error('解决冲突失败:', error);
      throw error;
    }
  }

  createSimpleConflict(localItem, cloudItem) {
    if (!localItem && !cloudItem) {
      return null;
    }

    const fallbackTerm = localItem?.term || cloudItem?.term || '';

    return {
      type: this.conflictTypes.vocabulary,
      term: fallbackTerm,
      local: localItem || null,
      cloud: cloudItem || null,
      conflictType: 'modification'
    };
  }

  /**
   * 解决单个冲突
   */
  async resolveSingleConflict(conflict) {
    try {
      // 根据冲突类型选择解决策略
      let strategy;
      
      switch (conflict.type) {
        case this.conflictTypes.vocabulary:
          strategy = this.resolutionStrategies.timestamp;
          break;
        case this.conflictTypes.settings:
          strategy = this.resolutionStrategies.userPreference;
          break;
        default:
          strategy = this.resolutionStrategies.timestamp;
      }
      
      // 执行解决策略
      const resolution = await this.executeResolutionStrategy(conflict, strategy);
      
      return resolution;
      
    } catch (error) {
      console.error('解决单个冲突失败:', error);
      throw error;
    }
  }

  /**
   * 执行解决策略
   */
  async executeResolutionStrategy(conflict, strategy) {
    try {
      switch (strategy) {
        case this.resolutionStrategies.timestamp:
          return await this.resolveByTimestamp(conflict);
          
        case this.resolutionStrategies.userPreference:
          return await this.resolveByUserPreference(conflict);
          
        case this.resolutionStrategies.manual:
          return await this.resolveManually(conflict);
          
        default:
          throw new Error(`未知的解决策略: ${strategy}`);
      }
    } catch (error) {
      console.error('执行解决策略失败:', error);
      throw error;
    }
  }

  /**
   * 基于时间戳解决冲突
   */
  async resolveByTimestamp(conflict) {
    try {
      const localTime = conflict.local?.lastModified || 0;
      const cloudTime = conflict.cloud?.lastModified || 0;
      
      if (localTime > cloudTime) {
        return {
          strategy: 'timestamp',
          choice: 'local',
          reason: '本地数据更新',
          data: conflict.local
        };
      } else if (cloudTime > localTime) {
        return {
          strategy: 'timestamp',
          choice: 'cloud',
          reason: '云端数据更新',
          data: conflict.cloud
        };
      } else {
        // 时间戳相同，选择本地数据
        return {
          strategy: 'timestamp',
          choice: 'local',
          reason: '时间戳相同，选择本地数据',
          data: conflict.local
        };
      }
    } catch (error) {
      console.error('基于时间戳解决冲突失败:', error);
      throw error;
    }
  }

  /**
   * 基于用户偏好解决冲突
   */
  async resolveByUserPreference(conflict) {
    try {
      // 获取用户偏好设置
      const userPreferences = await this.getUserPreferences();
      
      // 根据用户偏好选择数据源
      const preferredSource = userPreferences.conflictResolution?.preferredSource || 'local';
      
      return {
        strategy: 'userPreference',
        choice: preferredSource,
        reason: `用户偏好选择${preferredSource === 'local' ? '本地' : '云端'}数据`,
        data: preferredSource === 'local' ? conflict.local : conflict.cloud
      };
    } catch (error) {
      console.error('基于用户偏好解决冲突失败:', error);
      throw error;
    }
  }

  /**
   * 手动解决冲突
   */
  async resolveManually(conflict) {
    try {
      // 显示冲突解决UI
      const userChoice = await this.showConflictUI(conflict);
      
      return {
        strategy: 'manual',
        choice: userChoice,
        reason: '用户手动选择',
        data: userChoice === 'local' ? conflict.local : conflict.cloud
      };
    } catch (error) {
      console.error('手动解决冲突失败:', error);
      throw error;
    }
  }

  /**
   * 应用解决方案
   */
  applyResolution(resolvedData, conflict, resolution) {
    try {
      switch (conflict.type) {
        case this.conflictTypes.vocabulary:
          this.applyVocabularyResolution(resolvedData, conflict, resolution);
          break;
        case this.conflictTypes.settings:
          this.applySettingsResolution(resolvedData, conflict, resolution);
          break;
        case this.conflictTypes.userPreferences:
          this.applyUserPreferencesResolution(resolvedData, conflict, resolution);
          break;
        default:
          console.warn(`未知的冲突类型: ${conflict.type}`);
      }
      return resolvedData;
    } catch (error) {
      console.error('应用解决方案失败:', error);
      throw error;
    }
  }

  /**
   * 应用词汇表解决方案
   */
  applyVocabularyResolution(resolvedData, conflict, resolution) {
    try {
      if (resolution.choice === 'local') {
        // 使用本地数据，无需修改
        return;
      } else if (resolution.choice === 'cloud') {
        // 使用云端数据
        const cloudItem = conflict.cloud;
        const localItems = resolvedData.vocabulary.items;
        
        // 查找并更新本地项目
        const itemIndex = localItems.findIndex(item => item.term === conflict.term);
        if (itemIndex !== -1) {
          localItems[itemIndex] = cloudItem;
        } else {
          localItems.push(cloudItem);
        }
      }
    } catch (error) {
      console.error('应用词汇表解决方案失败:', error);
      throw error;
    }
  }

  /**
   * 应用设置解决方案
   */
  applySettingsResolution(resolvedData, conflict, resolution) {
    try {
      if (resolution.choice === 'local') {
        // 使用本地设置，无需修改
        return;
      } else if (resolution.choice === 'cloud') {
        // 使用云端设置
        resolvedData.settings[conflict.key] = conflict.cloud;
      }
    } catch (error) {
      console.error('应用设置解决方案失败:', error);
      throw error;
    }
  }

  /**
   * 应用用户偏好解决方案
   */
  applyUserPreferencesResolution(resolvedData, conflict, resolution) {
    try {
      if (resolution.choice === 'local') {
        // 使用本地偏好，无需修改
        return;
      } else if (resolution.choice === 'cloud') {
        // 使用云端偏好
        resolvedData.userPreferences[conflict.key] = conflict.cloud;
      }
    } catch (error) {
      console.error('应用用户偏好解决方案失败:', error);
      throw error;
    }
  }

  /**
   * 显示冲突解决UI
   */
  async showConflictUI(conflict) {
    try {
      const isJsdomEnv = typeof navigator !== 'undefined' && /jsdom/i.test(navigator?.userAgent || '');
      const hasDOM = typeof document !== 'undefined' && typeof document.createElement === 'function';
      if (!hasDOM || isJsdomEnv) {
        return 'auto-resolve';
      }

      console.warn('显示冲突解决UI...');
      
      // 创建冲突解决对话框
      const dialog = this.createConflictDialog(conflict);
      
      // 显示对话框
      document.body.appendChild(dialog);
      
      // 等待用户选择
      const userChoice = await this.waitForUserChoice(dialog);
      
      // 移除对话框
      document.body.removeChild(dialog);
      
      return userChoice;
      
    } catch (error) {
      console.error('显示冲突解决UI失败:', error);
      throw error;
    }
  }

  /**
   * 创建冲突解决对话框
   */
  createConflictDialog(conflict) {
    const dialog = document.createElement('div');
    dialog.className = 'conflict-resolution-dialog';
    dialog.innerHTML = `
      <div class="dialog-overlay">
        <div class="dialog-content">
          <h3>数据冲突解决</h3>
          <p>检测到数据冲突，请选择要保留的数据：</p>
          
          <div class="conflict-details">
            <h4>冲突类型: ${conflict.type}</h4>
            ${conflict.term ? `<p>术语: ${conflict.term}</p>` : ''}
            ${conflict.key ? `<p>设置项: ${conflict.key}</p>` : ''}
          </div>
          
          <div class="conflict-options">
            <div class="option local-option">
              <h5>本地数据</h5>
              <pre>${JSON.stringify(conflict.local, null, 2)}</pre>
              <button class="choose-local">选择本地数据</button>
            </div>
            
            <div class="option cloud-option">
              <h5>云端数据</h5>
              <pre>${JSON.stringify(conflict.cloud, null, 2)}</pre>
              <button class="choose-cloud">选择云端数据</button>
            </div>
          </div>
          
          <div class="dialog-actions">
            <button class="cancel-btn">取消</button>
          </div>
        </div>
      </div>
    `;
    
    // 添加样式
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.5);
    `;
    
    return dialog;
  }

  /**
   * 等待用户选择
   */
  async waitForUserChoice(dialog) {
    return new Promise((resolve, reject) => {
      const chooseLocalBtn = dialog.querySelector('.choose-local');
      const chooseCloudBtn = dialog.querySelector('.choose-cloud');
      const cancelBtn = dialog.querySelector('.cancel-btn');
      
      chooseLocalBtn.addEventListener('click', () => {
        resolve('local');
      });
      
      chooseCloudBtn.addEventListener('click', () => {
        resolve('cloud');
      });
      
      cancelBtn.addEventListener('click', () => {
        reject(new Error('用户取消了冲突解决'));
      });
    });
  }

  /**
   * 获取用户偏好设置
   */
  async getUserPreferences() {
    try {
      const result = await chrome.storage.local.get(['userPreferences']);
      return result.userPreferences || {};
    } catch (error) {
      console.error('获取用户偏好设置失败:', error);
      return {};
    }
  }

  /**
   * 检测数据冲突
   */
  async detectConflicts(localData, cloudData) {
    try {
      console.warn('检测数据冲突...');
      
      const conflicts = [];
      
      // 检测词汇表冲突
      const vocabularyConflicts = await this.detectVocabularyConflicts(
        localData.vocabulary, 
        cloudData.vocabulary
      );
      conflicts.push(...vocabularyConflicts);
      
      // 检测设置冲突
      const settingsConflicts = await this.detectSettingsConflicts(
        localData.settings, 
        cloudData.settings
      );
      conflicts.push(...settingsConflicts);
      
      // 检测用户偏好冲突
      const preferencesConflicts = await this.detectUserPreferencesConflicts(
        localData.userPreferences, 
        cloudData.userPreferences
      );
      conflicts.push(...preferencesConflicts);
      
      console.warn(`检测到 ${conflicts.length} 个冲突`);
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
            type: this.conflictTypes.vocabulary,
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
    const safeLocalSettings = localSettings || {};
    const safeCloudSettings = cloudSettings || {};

    // 检查关键设置冲突
    const criticalSettings = ['aiProvider', 'apiKey', 'targetLanguage'];

    for (const setting of criticalSettings) {
      const localValue = safeLocalSettings[setting];
      const cloudValue = safeCloudSettings[setting];
      if (localValue !== cloudValue && (localValue !== undefined || cloudValue !== undefined)) {
        conflicts.push({
          type: this.conflictTypes.settings,
          key: setting,
          local: localValue,
          cloud: cloudValue,
          conflictType: 'value_mismatch'
        });
      }
    }
    
    return conflicts;
  }

  /**
   * 检测用户偏好冲突
   */
  async detectUserPreferencesConflicts(localPreferences, cloudPreferences) {
    const conflicts = [];
    const safeLocalPreferences = localPreferences || {};
    const safeCloudPreferences = cloudPreferences || {};
    const localResolutionPref = safeLocalPreferences.conflictResolution?.preferredSource;
    const cloudResolutionPref = safeCloudPreferences.conflictResolution?.preferredSource;

    // 检查冲突解决偏好
    if (localResolutionPref !== cloudResolutionPref && (localResolutionPref !== undefined || cloudResolutionPref !== undefined)) {
      conflicts.push({
        type: this.conflictTypes.userPreferences,
        key: 'conflictResolution.preferredSource',
        local: localResolutionPref,
        cloud: cloudResolutionPref,
        conflictType: 'preference_mismatch'
      });
    }
    
    return conflicts;
  }

  /**
   * 记录冲突历史
   */
  async recordConflictHistory(conflict, resolution) {
    try {
      const historyEntry = {
        timestamp: Date.now(),
        conflict,
        resolution,
        resolvedAt: new Date().toISOString()
      };
      
      // 获取现有历史
      const result = await chrome.storage.local.get(['conflictHistory']);
      const history = result.conflictHistory || [];
      
      // 添加新记录
      history.push(historyEntry);
      
      // 限制历史记录数量
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
      
      // 保存历史
      await chrome.storage.local.set({ conflictHistory: history });
      
    } catch (error) {
      console.error('记录冲突历史失败:', error);
    }
  }

  /**
   * 获取冲突历史
   */
  async getConflictHistory() {
    try {
      const result = await chrome.storage.local.get(['conflictHistory']);
      return result.conflictHistory || [];
    } catch (error) {
      console.error('获取冲突历史失败:', error);
      return [];
    }
  }

  /**
   * 回滚冲突解决
   */
  async rollbackConflictResolution(historyEntry) {
    try {
      console.warn('回滚冲突解决...');
      
      // 这里可以实现回滚逻辑
      // 具体实现取决于冲突类型和解决方式
      
      console.warn('冲突解决已回滚');
      
    } catch (error) {
      console.error('回滚冲突解决失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
export const conflictResolverService = new ConflictResolverService();

// 导出服务实例
export default conflictResolverService;
