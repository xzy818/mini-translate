#!/usr/bin/env node

/**
 * QA 真实翻译功能测试脚本
 * 使用真实API密钥测试翻译功能
 */

import { translateText } from '../src/services/translator.js';
import { execSync } from 'node:child_process';

console.warn('🔍 QA 真实翻译功能测试开始...\n');

// 预先尝试加载用户 shell 配置中的环境变量（等效于执行：source ~/.bash_profile）
try {
  const loaded = execSync('bash -lc "source ~/.bash_profile >/dev/null 2>&1 || true; echo -n \"$TEST_QWEN_KEY\""', { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  if (loaded && !process.env.TEST_QWEN_KEY) {
    process.env.TEST_QWEN_KEY = loaded;
  }
} catch (_) {}

// 检查环境变量
const qwenKey = process.env.TEST_QWEN_KEY;

if (!qwenKey) {
  console.warn('❌ 未检测到 TEST_QWEN_KEY 环境变量');
  console.warn('请设置：export TEST_QWEN_KEY="your-qwen-key"');
  console.warn('或者直接在命令前设置：TEST_QWEN_KEY="your-key" node scripts/qa-real-translation-test.js');
  process.exit(1);
}

console.warn(`✅ 检测到 Qwen Key（已掩码处理）`);
console.warn(`🔑 Key 格式：${qwenKey.substring(0, 8)}...${qwenKey.substring(qwenKey.length - 4)}`);
console.warn(`📏 Key 长度：${qwenKey.length} 字符`);

// 验证 Key 格式
if (!qwenKey.startsWith('sk-')) {
  console.warn('⚠️  警告：Key 格式可能不正确，应该以 "sk-" 开头');
}

if (qwenKey.length < 20) {
  console.warn('⚠️  警告：Key 长度较短，可能不是有效的 API Key');
}

console.warn('\n🧪 开始真实翻译测试...');

// 测试用例
const testCases = [
  {
    name: '简单英文翻译',
    text: 'hello',
    expected: '你好'
  },
  {
    name: '复杂英文翻译',
    text: 'The quick brown fox jumps over the lazy dog.',
    expected: '敏捷的棕色狐狸跳过懒惰的狗。'
  },
  {
    name: '技术术语翻译',
    text: 'artificial intelligence',
    expected: '人工智能'
  }
];

async function runTranslationTests() {
  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.warn(`\n📝 测试: ${testCase.name}`);
    console.warn(`输入: "${testCase.text}"`);
    
    try {
      const config = {
        text: testCase.text,
        model: 'qwen-mt-turbo',
        apiKey: qwenKey,
        apiBaseUrl: 'https://dashscope.aliyuncs.com'
      };

      console.warn('🔄 正在调用 Qwen API...');
      const result = await translateText(config);
      
      if (result && result.trim()) {
        console.warn(`✅ 翻译成功: "${result}"`);
        passedTests++;
      } else {
        console.warn('⚠️  翻译返回空结果');
      }
    } catch (error) {
      console.warn(`❌ 翻译失败: ${error.message}`);
      
      // 分析失败原因
      if (error.message.includes('401')) {
        console.warn('🔑 问题：API Key 无效或过期');
        console.warn('💡 解决方案：请检查您的 Qwen API Key 是否正确');
      } else if (error.message.includes('403')) {
        console.warn('🚫 问题：API Key 权限不足');
        console.warn('💡 解决方案：请检查您的 API Key 是否有翻译权限');
      } else if (error.message.includes('429')) {
        console.warn('⏱️  问题：API 调用频率限制');
        console.warn('💡 解决方案：请稍后重试或检查您的 API 配额');
      } else if (error.message.includes('404')) {
        console.warn('🌐 问题：API 端点不正确');
        console.warn('💡 解决方案：请检查 API 端点配置');
      } else if (error.message.includes('timeout')) {
        console.warn('🌐 问题：网络连接超时');
        console.warn('💡 解决方案：请检查网络连接');
      } else {
        console.warn(`🔍 其他问题：${error.message}`);
      }
    }
  }

  console.warn('\n📊 测试结果汇总');
  console.warn(`✅ 通过测试: ${passedTests}/${totalTests}`);
  console.warn(`❌ 失败测试: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.warn('🎉 所有翻译测试通过！');
    return true;
  } else {
    console.warn('⚠️  部分测试失败，需要进一步分析');
    return false;
  }
}

// 执行测试
runTranslationTests()
  .then(success => {
    if (success) {
      console.warn('\n✅ QA 真实翻译测试完成 - 所有测试通过');
      process.exit(0);
    } else {
      console.warn('\n❌ QA 真实翻译测试完成 - 存在失败测试');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 测试执行过程中发生错误:', error);
    process.exit(1);
  });
