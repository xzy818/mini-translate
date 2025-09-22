/**
 * Chrome扩展错误处理和日志记录服务
 * 提供统一的错误处理、日志记录和监控功能
 */

/**
 * 错误类型枚举
 */
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  STORAGE: 'STORAGE_ERROR',
  TRANSLATION: 'TRANSLATION_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  RUNTIME: 'RUNTIME_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * 错误严重程度枚举
 */
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * 错误信息结构
 */
export class ExtensionError extends Error {
  constructor(message, type = ERROR_TYPES.UNKNOWN, severity = ERROR_SEVERITY.MEDIUM, context = {}) {
    super(message);
    this.name = 'ExtensionError';
    this.type = type;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.extensionId = chrome?.runtime?.id || 'unknown';
    
    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExtensionError);
    }
  }
}

/**
 * 日志级别枚举
 */
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

/**
 * 日志记录器
 */
class Logger {
  constructor() {
    this.logLevel = LOG_LEVELS.INFO;
    this.logs = [];
    this.maxLogs = 1000; // 最大日志条数
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level) {
    this.logLevel = level;
  }

  /**
   * 记录日志
   */
  log(level, message, data = {}) {
    if (level < this.logLevel) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: Object.keys(LOG_LEVELS)[level],
      message,
      data,
      extensionId: chrome?.runtime?.id || 'unknown'
    };

    // 添加到内存日志
    this.logs.push(logEntry);
    
    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 控制台输出
    const consoleMethod = this.getConsoleMethod(level);
    console[consoleMethod](`[${logEntry.level}] ${message}`, data);
  }

  /**
   * 获取控制台方法
   */
  getConsoleMethod(level) {
    switch (level) {
      case LOG_LEVELS.DEBUG:
        return 'debug';
      case LOG_LEVELS.INFO:
        return 'info';
      case LOG_LEVELS.WARN:
        return 'warn';
      case LOG_LEVELS.ERROR:
      case LOG_LEVELS.CRITICAL:
        return 'error';
      default:
        return 'log';
    }
  }

  /**
   * 调试日志
   */
  debug(message, data = {}) {
    this.log(LOG_LEVELS.DEBUG, message, data);
  }

  /**
   * 信息日志
   */
  info(message, data = {}) {
    this.log(LOG_LEVELS.INFO, message, data);
  }

  /**
   * 警告日志
   */
  warn(message, data = {}) {
    this.log(LOG_LEVELS.WARN, message, data);
  }

  /**
   * 错误日志
   */
  error(message, data = {}) {
    this.log(LOG_LEVELS.ERROR, message, data);
  }

  /**
   * 严重错误日志
   */
  critical(message, data = {}) {
    this.log(LOG_LEVELS.CRITICAL, message, data);
  }

  /**
   * 获取日志
   */
  getLogs(level = null, limit = 100) {
    let filteredLogs = this.logs;
    
    if (level !== null) {
      filteredLogs = this.logs.filter(log => log.level === level);
    }
    
    return filteredLogs.slice(-limit);
  }

  /**
   * 清空日志
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * 导出日志
   */
  exportLogs() {
    return {
      exportTime: new Date().toISOString(),
      extensionId: chrome?.runtime?.id || 'unknown',
      logs: this.logs
    };
  }
}

// 创建全局日志记录器实例
export const logger = new Logger();

/**
 * 错误处理器
 */
class ErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.errorThresholds = new Map();
    this.setupGlobalErrorHandlers();
  }

  /**
   * 设置全局错误处理器
   */
  setupGlobalErrorHandlers() {
    // 只在浏览器环境中设置全局错误处理器
    if (typeof window !== 'undefined') {
      // 捕获未处理的Promise拒绝
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(new ExtensionError(
          `Unhandled Promise Rejection: ${event.reason}`,
          ERROR_TYPES.RUNTIME,
          ERROR_SEVERITY.HIGH,
          { reason: event.reason, promise: event.promise }
        ));
      });

      // 捕获全局错误
      window.addEventListener('error', (event) => {
        this.handleError(new ExtensionError(
          `Global Error: ${event.message}`,
          ERROR_TYPES.RUNTIME,
          ERROR_SEVERITY.HIGH,
          { 
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
          }
        ));
      });
    }
  }

  /**
   * 处理错误
   */
  handleError(error, context = {}) {
    // 确保是ExtensionError实例
    if (!(error instanceof ExtensionError)) {
      error = new ExtensionError(
        error.message || 'Unknown error',
        ERROR_TYPES.UNKNOWN,
        ERROR_SEVERITY.MEDIUM,
        { originalError: error, ...context }
      );
    }

    // 记录错误
    this.logError(error);

    // 更新错误计数
    this.updateErrorCount(error);

    // 检查错误阈值
    this.checkErrorThreshold(error);

    // 根据严重程度采取不同行动
    this.takeAction(error);

    return error;
  }

  /**
   * 记录错误
   */
  logError(error) {
    const logLevel = this.getLogLevel(error.severity);
    logger.log(logLevel, `[${error.type}] ${error.message}`, {
      type: error.type,
      severity: error.severity,
      context: error.context,
      stack: error.stack
    });
  }

  /**
   * 获取日志级别
   */
  getLogLevel(severity) {
    switch (severity) {
      case ERROR_SEVERITY.LOW:
        return LOG_LEVELS.INFO;
      case ERROR_SEVERITY.MEDIUM:
        return LOG_LEVELS.WARN;
      case ERROR_SEVERITY.HIGH:
        return LOG_LEVELS.ERROR;
      case ERROR_SEVERITY.CRITICAL:
        return LOG_LEVELS.CRITICAL;
      default:
        return LOG_LEVELS.ERROR;
    }
  }

  /**
   * 更新错误计数
   */
  updateErrorCount(error) {
    const key = `${error.type}:${error.severity}`;
    const count = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, count + 1);
  }

  /**
   * 检查错误阈值
   */
  checkErrorThreshold(error) {
    const key = `${error.type}:${error.severity}`;
    const count = this.errorCounts.get(key) || 0;
    const threshold = this.errorThresholds.get(key) || this.getDefaultThreshold(error.severity);

    if (count >= threshold) {
      logger.critical(`Error threshold exceeded for ${key}: ${count} errors`, {
        errorType: error.type,
        severity: error.severity,
        count,
        threshold
      });
    }
  }

  /**
   * 获取默认阈值
   */
  getDefaultThreshold(severity) {
    switch (severity) {
      case ERROR_SEVERITY.LOW:
        return 100;
      case ERROR_SEVERITY.MEDIUM:
        return 50;
      case ERROR_SEVERITY.HIGH:
        return 20;
      case ERROR_SEVERITY.CRITICAL:
        return 5;
      default:
        return 50;
    }
  }

  /**
   * 根据错误采取行动
   */
  takeAction(error) {
    switch (error.severity) {
      case ERROR_SEVERITY.CRITICAL:
        this.handleCriticalError(error);
        break;
      case ERROR_SEVERITY.HIGH:
        this.handleHighSeverityError(error);
        break;
      case ERROR_SEVERITY.MEDIUM:
        this.handleMediumSeverityError(error);
        break;
      case ERROR_SEVERITY.LOW:
        this.handleLowSeverityError(error);
        break;
    }
  }

  /**
   * 处理严重错误
   */
  handleCriticalError(error) {
    // 发送错误报告
    this.sendErrorReport(error);
    
    // 显示用户通知
    this.showUserNotification('严重错误', '扩展遇到严重错误，请重新加载页面或重启扩展。');
    
    // 尝试恢复
    this.attemptRecovery(error);
  }

  /**
   * 处理高严重性错误
   */
  handleHighSeverityError(error) {
    // 记录详细错误信息
    logger.error('High severity error occurred', error);
    
    // 显示用户通知
    this.showUserNotification('错误', '扩展遇到错误，某些功能可能不可用。');
  }

  /**
   * 处理中等严重性错误
   */
  handleMediumSeverityError(error) {
    // 记录错误
    logger.warn('Medium severity error occurred', error);
  }

  /**
   * 处理低严重性错误
   */
  handleLowSeverityError(error) {
    // 仅记录错误
    logger.info('Low severity error occurred', error);
  }

  /**
   * 发送错误报告
   */
  sendErrorReport(error) {
    // 这里可以实现错误报告发送逻辑
    // 例如发送到错误收集服务
    logger.info('Error report sent', {
      type: error.type,
      severity: error.severity,
      message: error.message
    });
  }

  /**
   * 显示用户通知
   */
  showUserNotification(title, message) {
    if (chrome?.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title,
        message
      });
    }
  }

  /**
   * 尝试恢复
   */
  attemptRecovery(error) {
    // 根据错误类型尝试不同的恢复策略
    switch (error.type) {
      case ERROR_TYPES.NETWORK:
        this.recoverFromNetworkError(error);
        break;
      case ERROR_TYPES.STORAGE:
        this.recoverFromStorageError(error);
        break;
      case ERROR_TYPES.PERMISSION:
        this.recoverFromPermissionError(error);
        break;
      default:
        logger.warn('No recovery strategy for error type', error.type);
    }
  }

  /**
   * 从网络错误恢复
   */
  recoverFromNetworkError(error) {
    logger.info('Attempting network error recovery');
    // 可以实现重试逻辑、切换API等
  }

  /**
   * 从存储错误恢复
   */
  recoverFromStorageError(error) {
    logger.info('Attempting storage error recovery');
    // 可以实现清理存储、重置数据等
  }

  /**
   * 从权限错误恢复
   */
  recoverFromPermissionError(error) {
    logger.info('Attempting permission error recovery');
    // 可以实现重新请求权限等
  }

  /**
   * 获取错误统计
   */
  getErrorStats() {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      errorCounts: Object.fromEntries(this.errorCounts),
      recentLogs: logger.getLogs(null, 50)
    };
  }

  /**
   * 重置错误计数
   */
  resetErrorCounts() {
    this.errorCounts.clear();
  }
}

// 创建全局错误处理器实例
export const errorHandler = new ErrorHandler();

/**
 * 便捷的错误处理函数
 */
export function handleError(error, type = ERROR_TYPES.UNKNOWN, severity = ERROR_SEVERITY.MEDIUM, context = {}) {
  return errorHandler.handleError(error, { type, severity, ...context });
}

/**
 * 创建特定类型的错误
 */
export function createError(message, type, severity = ERROR_SEVERITY.MEDIUM, context = {}) {
  return new ExtensionError(message, type, severity, context);
}

/**
 * 网络错误处理
 */
export function handleNetworkError(error, context = {}) {
  return handleError(error, ERROR_TYPES.NETWORK, ERROR_SEVERITY.HIGH, context);
}

/**
 * 权限错误处理
 */
export function handlePermissionError(error, context = {}) {
  return handleError(error, ERROR_TYPES.PERMISSION, ERROR_SEVERITY.HIGH, context);
}

/**
 * 存储错误处理
 */
export function handleStorageError(error, context = {}) {
  return handleError(error, ERROR_TYPES.STORAGE, ERROR_SEVERITY.MEDIUM, context);
}

/**
 * 翻译错误处理
 */
export function handleTranslationError(error, context = {}) {
  return handleError(error, ERROR_TYPES.TRANSLATION, ERROR_SEVERITY.MEDIUM, context);
}

/**
 * 验证错误处理
 */
export function handleValidationError(error, context = {}) {
  return handleError(error, ERROR_TYPES.VALIDATION, ERROR_SEVERITY.LOW, context);
}

/**
 * 运行时错误处理
 */
export function handleRuntimeError(error, context = {}) {
  return handleError(error, ERROR_TYPES.RUNTIME, ERROR_SEVERITY.HIGH, context);
}
