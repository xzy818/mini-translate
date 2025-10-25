#!/usr/bin/env node

/**
 * 翻译修复验证脚本
 * 测试优化后的翻译prompt
 */

import { translateText } from '../src/services/translator.js';

console.warn('🔍 翻译修复验证开始...\n');

const qwenKey = process.env.TEST_QWEN_KEY;

if (!qwenKey) {
  console.warn('❌ 未检测到 TEST_QWEN_KEY 环境变量');
  process.exit(1);
}

console.warn(`✅ 检测到 Qwen Key: ${qwenKey.substring(0, 8)}...${qwenKey.substring(qwenKey.length - 4)}`);

// 简单翻译测试
const testText = 'hello';

console.warn(`\n📝 测试文本: "${testText}"`);
console.warn('🔄 正在调用翻译API...');

try {
  const config = {
    text: testText,
    model: 'qwen-mt-turbo',
    apiKey: qwenKey,
    apiBaseUrl: 'https://dashscope.aliyuncs.com'
  };

  const result = await translateText(config);
  
  console.warn(`📤 翻译结果: "${result}"`);
  
  // 检查是否包含中文字符
  const hasChinese = /[\u4e00-\u9fff]/.test(result);
  
  if (hasChinese) {
    console.warn('✅ 翻译成功！包含中文字符');
  } else {
    console.warn('⚠️  翻译结果不包含中文字符，可能不是中文翻译');
  }
  
  // 检查结果长度
  if (result.length < 50) {
    console.warn('✅ 翻译结果简洁，符合预期');
  } else {
    console.warn('⚠️  翻译结果较长，可能包含额外内容');
  }
  
} catch (error) {
  console.warn(`❌ 翻译失败: ${error.message}`);
}
