// 监控服务
// 负责请求监控、错误日志记录、性能指标收集和使用量统计

export class MonitorService {
  static logRequest(provider, model, duration, success, tokens = 0) {
    const logEntry = {
      timestamp: Date.now(),
      provider,
      model,
      duration,
      success,
      tokens,
      type: 'request'
    };
    
    console.warn('[AI Monitor] Request:', logEntry);
    this.storeLogEntry(logEntry);
    
    // 更新使用量统计
    if (success) {
      this.trackUsage(provider, model, tokens);
    }
  }

  static logError(provider, model, error) {
    const logEntry = {
      timestamp: Date.now(),
      provider,
      model,
      error: error.message,
      status: error.status,
      code: error.code,
      type: 'error'
    };
    
    console.error('[AI Monitor] Error:', logEntry);
    this.storeLogEntry(logEntry);
  }

  static logInfo(message, context = {}) {
    const logEntry = {
      timestamp: Date.now(),
      message,
      context,
      type: 'info'
    };
    
    console.warn('[AI Monitor] Info:', logEntry);
    this.storeLogEntry(logEntry);
  }

  static trackUsage(provider, model, tokens) {
    const usage = {
      timestamp: Date.now(),
      provider,
      model,
      tokens,
      type: 'usage'
    };
    
    this.storeUsageEntry(usage);
  }

  static async getMetrics(provider = null, timeRange = '24h') {
    try {
      const logs = await this.getLogs();
      const usage = await this.getUsageStats();
      
      const metrics = this.calculateMetrics(logs, usage, provider, timeRange);
      return metrics;
    } catch (error) {
      console.error('[AI Monitor] Failed to get metrics:', error);
      return null;
    }
  }

  static calculateMetrics(logs, usage, provider, timeRange) {
    const now = Date.now();
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const startTime = now - timeRangeMs;
    
    // 过滤时间范围内的数据
    const filteredLogs = logs.filter(log => log.timestamp >= startTime);
    const filteredUsage = usage.filter(usage => usage.timestamp >= startTime);
    
    // 如果指定了提供商，进一步过滤
    const providerLogs = provider ? 
      filteredLogs.filter(log => log.provider === provider) : 
      filteredLogs;
    const providerUsage = provider ? 
      filteredUsage.filter(usage => usage.provider === provider) : 
      filteredUsage;
    
    // 计算指标
    const requestLogs = providerLogs.filter(log => log.type === 'request');
    const errorLogs = providerLogs.filter(log => log.type === 'error');
    
    const totalRequests = requestLogs.length;
    const successfulRequests = requestLogs.filter(log => log.success).length;
    const failedRequests = requestLogs.filter(log => !log.success).length;
    
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    const averageDuration = requestLogs.length > 0 ? 
      requestLogs.reduce((sum, log) => sum + log.duration, 0) / requestLogs.length : 0;
    
    const totalTokens = providerUsage.reduce((sum, usage) => sum + usage.tokens, 0);
    
    // 按提供商分组统计
    const providerStats = this.calculateProviderStats(providerLogs, providerUsage);
    
    return {
      timeRange,
      provider: provider || 'all',
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(averageDuration),
      totalTokens,
      errorCount: errorLogs.length,
      providerStats,
      lastUpdated: now
    };
  }

  static calculateProviderStats(logs, usage) {
    const stats = {};
    
    // 按提供商分组
    const providerGroups = {};
    logs.forEach(log => {
      if (!providerGroups[log.provider]) {
        providerGroups[log.provider] = { requests: [], errors: [] };
      }
      if (log.type === 'request') {
        providerGroups[log.provider].requests.push(log);
      } else if (log.type === 'error') {
        providerGroups[log.provider].errors.push(log);
      }
    });
    
    // 计算每个提供商的统计
    Object.entries(providerGroups).forEach(([provider, data]) => {
      const totalRequests = data.requests.length;
      const successfulRequests = data.requests.filter(req => req.success).length;
      const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
      
      stats[provider] = {
        totalRequests,
        successfulRequests,
        successRate: Math.round(successRate * 100) / 100,
        errorCount: data.errors.length,
        averageDuration: data.requests.length > 0 ? 
          Math.round(data.requests.reduce((sum, req) => sum + req.duration, 0) / data.requests.length) : 0
      };
    });
    
    return stats;
  }

  static getTimeRangeMs(timeRange) {
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    return ranges[timeRange] || ranges['24h'];
  }

  static storeLogEntry(entry) {
    chrome.storage.local.get(['aiLogs'], (result) => {
      const logs = result.aiLogs || [];
      logs.push(entry);
      
      // 保持最近 1000 条日志
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000);
      }
      
      chrome.storage.local.set({ aiLogs: logs });
    });
  }

  static storeUsageEntry(entry) {
    chrome.storage.local.get(['aiUsage'], (result) => {
      const usage = result.aiUsage || [];
      usage.push(entry);
      
      // 保持最近 1000 条使用记录
      if (usage.length > 1000) {
        usage.splice(0, usage.length - 1000);
      }
      
      chrome.storage.local.set({ aiUsage: usage });
    });
  }

  static async getLogs() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['aiLogs'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.aiLogs || []);
        }
      });
    });
  }

  static async getUsageStats() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['aiUsage'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.aiUsage || []);
        }
      });
    });
  }

  static async clearLogs() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(['aiLogs', 'aiUsage'], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  static async exportLogs() {
    try {
      const logs = await this.getLogs();
      const usage = await this.getUsageStats();
      
      return {
        logs,
        usage,
        exportTime: Date.now(),
        version: '1.0'
      };
    } catch (error) {
      console.error('[AI Monitor] Failed to export logs:', error);
      throw error;
    }
  }

  static async importLogs(data) {
    try {
      if (data.logs) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ aiLogs: data.logs }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
      
      if (data.usage) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ aiUsage: data.usage }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.error('[AI Monitor] Failed to import logs:', error);
      throw error;
    }
  }

  static getHealthStatus() {
    // 获取系统健康状态
    return {
      service: 'MonitorService',
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0'
    };
  }
}

// 导出单例实例
export const monitorService = MonitorService;
