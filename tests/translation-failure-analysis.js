/**
 * 翻译失败根因分析工具
 * 基于测试结果生成详细的失败根因分析报告
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * 失败根因分析器
 */
export class TranslationFailureAnalyzer {
  constructor() {
    this.errorPatterns = {
      // 配置相关错误
      config: {
        patterns: [
          /API Key 未配置/,
          /不支持的翻译模型/,
          /API Base URL 未配置/,
          /INVALID_CONFIG/
        ],
        category: '配置问题',
        solutions: [
          '检查 API Key 是否正确设置',
          '确认选择的模型是否支持',
          '验证 Base URL 配置是否正确'
        ]
      },
      
      // 认证相关错误
      auth: {
        patterns: [
          /Invalid API key/,
          /Unauthorized/,
          /401/,
          /403/
        ],
        category: '认证失败',
        solutions: [
          '验证 API Key 是否有效',
          '检查 API Key 是否过期',
          '确认账户是否有相应权限'
        ]
      },
      
      // 限流相关错误
      rateLimit: {
        patterns: [
          /Rate limit exceeded/,
          /429/,
          /quota exceeded/,
          /RATE_LIMIT/
        ],
        category: '限流/配额',
        solutions: [
          '降低 API 调用频率',
          '检查账户配额使用情况',
          '考虑升级 API 套餐'
        ]
      },
      
      // 网络相关错误
      network: {
        patterns: [
          /Request timeout/,
          /TIMEOUT/,
          /Network error/,
          /Connection refused/,
          /5\d\d/
        ],
        category: '网络问题',
        solutions: [
          '检查网络连接',
          '验证代理设置',
          '尝试增加超时时间',
          '检查服务端状态'
        ]
      },
      
      // 模型相关错误
      model: {
        patterns: [
          /Model not found/,
          /400/,
          /不支持的模型/,
          /模型名称错误/
        ],
        category: '模型问题',
        solutions: [
          '确认模型名称是否正确',
          '检查模型是否在服务商处可用',
          '验证模型权限设置'
        ]
      }
    };
  }

  /**
   * 分析单个测试结果
   */
  analyzeTestResult(testResult) {
    const analysis = {
      testName: testResult.testName,
      status: testResult.status,
      rootCauses: [],
      recommendations: [],
      severity: 'low'
    };

    if (testResult.status === 'failed') {
      const errorMessage = testResult.details.error || '';
      const logContent = testResult.details.logs || '';

      // 分析错误模式
      for (const [type, config] of Object.entries(this.errorPatterns)) {
        const hasMatch = config.patterns.some(pattern => 
          pattern.test(errorMessage) || pattern.test(logContent)
        );

        if (hasMatch) {
          analysis.rootCauses.push({
            type,
            category: config.category,
            confidence: this.calculateConfidence(errorMessage, config.patterns)
          });
          analysis.recommendations.push(...config.solutions);
        }
      }

      // 确定严重程度
      analysis.severity = this.determineSeverity(analysis.rootCauses);
    }

    return analysis;
  }

  /**
   * 计算错误匹配置信度
   */
  calculateConfidence(errorMessage, patterns) {
    const matches = patterns.filter(pattern => pattern.test(errorMessage));
    return Math.min(matches.length / patterns.length * 100, 100);
  }

  /**
   * 确定问题严重程度
   */
  determineSeverity(rootCauses) {
    if (rootCauses.some(cause => cause.type === 'auth')) return 'high';
    if (rootCauses.some(cause => cause.type === 'config')) return 'high';
    if (rootCauses.some(cause => cause.type === 'model')) return 'medium';
    if (rootCauses.some(cause => cause.type === 'rateLimit')) return 'medium';
    if (rootCauses.some(cause => cause.type === 'network')) return 'low';
    return 'low';
  }

  /**
   * 分析测试报告
   */
  analyzeReport(reportPath) {
    if (!existsSync(reportPath)) {
      throw new Error(`测试报告文件不存在: ${reportPath}`);
    }

    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const analysis = {
      summary: {
        totalTests: report.summary.total,
        passedTests: report.summary.passed,
        failedTests: report.summary.failed,
        skippedTests: report.summary.skipped,
        duration: report.summary.duration
      },
      testAnalyses: [],
      rootCauseSummary: {},
      recommendations: [],
      severity: 'low'
    };

    // 分析每个测试结果
    report.results.forEach(result => {
      const testAnalysis = this.analyzeTestResult(result);
      analysis.testAnalyses.push(testAnalysis);
    });

    // 生成根因汇总
    analysis.rootCauseSummary = this.generateRootCauseSummary(analysis.testAnalyses);
    
    // 生成总体建议
    analysis.recommendations = this.generateOverallRecommendations(analysis.testAnalyses);
    
    // 确定整体严重程度
    analysis.severity = this.determineOverallSeverity(analysis.testAnalyses);

    return analysis;
  }

  /**
   * 生成根因汇总
   */
  generateRootCauseSummary(testAnalyses) {
    const summary = {};
    
    testAnalyses.forEach(analysis => {
      analysis.rootCauses.forEach(cause => {
        if (!summary[cause.type]) {
          summary[cause.type] = {
            category: cause.category,
            count: 0,
            tests: [],
            avgConfidence: 0
          };
        }
        
        summary[cause.type].count++;
        summary[cause.type].tests.push(analysis.testName);
        summary[cause.type].avgConfidence += cause.confidence;
      });
    });

    // 计算平均置信度
    Object.values(summary).forEach(cause => {
      cause.avgConfidence = cause.avgConfidence / cause.count;
    });

    return summary;
  }

  /**
   * 生成总体建议
   */
  generateOverallRecommendations(testAnalyses) {
    const allRecommendations = new Set();
    
    testAnalyses.forEach(analysis => {
      analysis.recommendations.forEach(rec => allRecommendations.add(rec));
    });

    return Array.from(allRecommendations);
  }

  /**
   * 确定整体严重程度
   */
  determineOverallSeverity(testAnalyses) {
    const severities = testAnalyses.map(analysis => analysis.severity);
    
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * 生成分析报告
   */
  generateAnalysisReport(analysis) {
    const report = {
      timestamp: new Date().toISOString(),
      analysis,
      insights: this.generateInsights(analysis),
      actionPlan: this.generateActionPlan(analysis)
    };

    return report;
  }

  /**
   * 生成洞察
   */
  generateInsights(analysis) {
    const insights = [];

    // 基于失败率生成洞察
    const failureRate = analysis.summary.failedTests / analysis.summary.totalTests;
    if (failureRate > 0.5) {
      insights.push('失败率较高，建议优先解决配置和认证问题');
    }

    // 基于根因分析生成洞察
    const rootCauseTypes = Object.keys(analysis.rootCauseSummary);
    if (rootCauseTypes.includes('config')) {
      insights.push('存在配置问题，建议检查 API Key 和模型设置');
    }
    if (rootCauseTypes.includes('auth')) {
      insights.push('存在认证问题，建议验证 API Key 有效性');
    }
    if (rootCauseTypes.includes('network')) {
      insights.push('存在网络问题，建议检查网络连接和代理设置');
    }

    return insights;
  }

  /**
   * 生成行动计划
   */
  generateActionPlan(analysis) {
    const plan = [];

    // 按严重程度排序
    const highPriority = analysis.testAnalyses.filter(a => a.severity === 'high');
    const mediumPriority = analysis.testAnalyses.filter(a => a.severity === 'medium');
    const lowPriority = analysis.testAnalyses.filter(a => a.severity === 'low');

    if (highPriority.length > 0) {
      plan.push({
        priority: 'high',
        description: '解决高优先级问题',
        tests: highPriority.map(a => a.testName),
        actions: ['立即检查配置', '验证 API Key', '确认模型权限']
      });
    }

    if (mediumPriority.length > 0) {
      plan.push({
        priority: 'medium',
        description: '解决中优先级问题',
        tests: mediumPriority.map(a => a.testName),
        actions: ['检查限流设置', '验证模型可用性', '优化网络配置']
      });
    }

    if (lowPriority.length > 0) {
      plan.push({
        priority: 'low',
        description: '解决低优先级问题',
        tests: lowPriority.map(a => a.testName),
        actions: ['监控网络状态', '优化重试策略', '改进错误处理']
      });
    }

    return plan;
  }
}

/**
 * 报告生成器
 */
export class ReportGenerator {
  constructor() {
    this.analyzer = new TranslationFailureAnalyzer();
  }

  /**
   * 生成完整的诊断报告
   */
  generateDiagnosticReport(reportPath) {
    const analysis = this.analyzer.analyzeReport(reportPath);
    const fullReport = this.analyzer.generateAnalysisReport(analysis);
    
    return fullReport;
  }

  /**
   * 生成简化的根因摘要
   */
  generateRootCauseSummary(reportPath) {
    const analysis = this.analyzer.analyzeReport(reportPath);
    
    return {
      severity: analysis.severity,
      rootCauses: analysis.rootCauseSummary,
      topRecommendations: analysis.recommendations.slice(0, 5),
      criticalTests: analysis.testAnalyses
        .filter(a => a.severity === 'high')
        .map(a => a.testName)
    };
  }

  /**
   * 生成修复建议
   */
  generateFixSuggestions(reportPath) {
    const analysis = this.analyzer.analyzeReport(reportPath);
    
    const suggestions = {
      immediate: [],
      shortTerm: [],
      longTerm: []
    };

    // 基于根因类型生成建议
    Object.entries(analysis.rootCauseSummary).forEach(([type, cause]) => {
      switch (type) {
        case 'config':
          suggestions.immediate.push('检查并修复 API Key 和模型配置');
          break;
        case 'auth':
          suggestions.immediate.push('验证 API Key 有效性并更新认证信息');
          break;
        case 'rateLimit':
          suggestions.shortTerm.push('实施请求频率限制和重试机制');
          break;
        case 'network':
          suggestions.shortTerm.push('优化网络配置和超时设置');
          break;
        case 'model':
          suggestions.longTerm.push('建立模型可用性监控和自动切换机制');
          break;
      }
    });

    return suggestions;
  }
}

export default TranslationFailureAnalyzer;




