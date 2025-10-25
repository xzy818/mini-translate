#!/usr/bin/env node

/**
 * QA 最终验证脚本
 * 用于验证翻译功能的完整性和正确性
 */

import { translateText } from '../src/services/translator.js';

console.warn('🔍 QA 最终验证开始...\n');

// 检查环境变量
const qwenKey = process.env.TEST_QWEN_KEY;

if (!qwenKey) {
  console.warn('❌ 未检测到 TEST_QWEN_KEY 环境变量');
  console.warn('请设置：export TEST_QWEN_KEY="your-qwen-key"');
  process.exit(1);
}

console.warn(`✅ 检测到 Qwen Key`);
console.warn(`🔑 Key 格式：${qwenKey.substring(0, 8)}...${qwenKey.substring(qwenKey.length - 4)}`);

// 验证 Key 格式
if (!qwenKey.startsWith('sk-')) {
  console.warn('⚠️  警告：Key 格式可能不正确，应该以 "sk-" 开头');
  process.exit(1);
}

if (qwenKey.length < 20) {
  console.warn('⚠️  警告：Key 长度较短，可能不是有效的 API Key');
  process.exit(1);
}

console.warn('\n🧪 开始最终验证测试...');

// 测试用例
const testCases = [
  {
    name: '基础翻译测试',
    text: 'hello',
    description: '测试基本英文翻译功能'
  },
  {
    name: '复杂句子翻译',
    text: 'The quick brown fox jumps over the lazy dog.',
    description: '测试复杂英文句子翻译'
  },
  {
    name: '技术术语翻译',
    text: 'artificial intelligence',
    description: '测试技术术语翻译'
  },
  {
    name: '长文本翻译',
    text: 'This is a comprehensive test of the translation functionality to ensure it works correctly with longer text inputs.',
    description: '测试长文本翻译功能'
  }
];

async function runFinalVerification() {
  let passedTests = 0;
  let totalTests = testCases.length;
  const results = [];

  for (const testCase of testCases) {
    console.warn(`\n📝 测试: ${testCase.name}`);
    console.warn(`描述: ${testCase.description}`);
    console.warn(`输入: "${testCase.text}"`);
    
    try {
      const config = {
        text: testCase.text,
        model: 'qwen-mt-turbo',
        apiKey: qwenKey,
        apiBaseUrl: 'https://dashscope.aliyuncs.com'
      };

      console.warn('🔄 正在调用翻译API...');
      const startTime = Date.now();
      const result = await translateText(config);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (result && result.trim()) {
        console.warn(`✅ 翻译成功: "${result}"`);
        console.warn(`⏱️  响应时间: ${responseTime}ms`);
        
        // 记录结果
        results.push({
          test: testCase.name,
          input: testCase.text,
          output: result,
          responseTime: responseTime,
          status: 'success'
        });
        
        passedTests++;
      } else {
        console.warn('❌ 翻译返回空结果');
        results.push({
          test: testCase.name,
          input: testCase.text,
          output: null,
          responseTime: responseTime,
          status: 'empty_result'
        });
      }
    } catch (error) {
      console.warn(`❌ 翻译失败: ${error.message}`);
      
      // 分析失败原因
      if (error.message.includes('401')) {
        console.warn('🔑 问题：API Key 无效或过期');
      } else if (error.message.includes('403')) {
        console.warn('🚫 问题：API Key 权限不足');
      } else if (error.message.includes('429')) {
        console.warn('⏱️  问题：API 调用频率限制');
      } else if (error.message.includes('timeout')) {
        console.warn('🌐 问题：网络连接超时');
      } else {
        console.warn(`🔍 其他问题：${error.message}`);
      }
      
      results.push({
        test: testCase.name,
        input: testCase.text,
        output: null,
        error: error.message,
        status: 'error'
      });
    }
  }

  // 生成测试报告
  console.warn('\n📊 最终验证结果');
  console.warn(`✅ 通过测试: ${passedTests}/${totalTests}`);
  console.warn(`❌ 失败测试: ${totalTests - passedTests}/${totalTests}`);
  
  // 计算平均响应时间
  const successfulTests = results.filter(r => r.status === 'success');
  if (successfulTests.length > 0) {
    const avgResponseTime = successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length;
    console.warn(`⏱️  平均响应时间: ${Math.round(avgResponseTime)}ms`);
  }
  
  // 保存详细结果
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate: `${Math.round((passedTests / totalTests) * 100)}%`
    },
    results
  };
  
  // 保存到文件
  const fs = await import('fs');
  const reportPath = 'test-reports/qa-final-verification-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.warn(`📄 详细报告已保存到: ${reportPath}`);
  
  if (passedTests === totalTests) {
    console.warn('\n🎉 所有测试通过！翻译功能验证成功！');
    return true;
  } else {
    console.warn('\n⚠️  部分测试失败，需要进一步分析');
    return false;
  }
}

// 执行最终验证
runFinalVerification()
  .then(success => {
    if (success) {
      console.warn('\n✅ QA 最终验证完成 - 翻译功能正常');
      process.exit(0);
    } else {
      console.warn('\n❌ QA 最终验证完成 - 存在问题需要修复');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 验证过程中发生错误:', error);
    process.exit(1);
  });
