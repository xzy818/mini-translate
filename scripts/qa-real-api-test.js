#!/usr/bin/env node

/**
 * QA 真实 API 测试脚本
 * 自动检测环境变量并执行完整的翻译功能测试
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';

console.warn('🔍 QA 真实 API 测试开始...\n');

// 检查环境变量
const qwenKey = process.env.TEST_QWEN_KEY;

if (!qwenKey) {
  console.warn('❌ 未检测到 TEST_QWEN_KEY 环境变量');
  console.warn('请设置：export TEST_QWEN_KEY="your-qwen-key"');
  console.warn('或者直接在命令前设置：TEST_QWEN_KEY="your-key" node scripts/qa-real-api-test.js');
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

console.warn('\n🧪 开始真实 API 测试...');

// 运行测试
const testProcess = spawn('npm', ['test', '--', '--run', 'qwen-key-verification'], {
  cwd: process.cwd(),
  stdio: 'pipe',
  shell: true,
  env: { ...process.env, TEST_QWEN_KEY: qwenKey }
});

let output = '';
let errorOutput = '';

testProcess.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.warn(text);
});

testProcess.stderr.on('data', (data) => {
  const text = data.toString();
  errorOutput += text;
  console.error(text);
});

testProcess.on('close', (code) => {
  console.warn('\n📊 QA 测试完成');
  
  if (code === 0) {
    console.warn('✅ 所有测试通过！');
    
    // 分析测试结果
    if (output.includes('翻译成功')) {
      console.warn('🎉 真实 API 调用成功！');
    } else if (output.includes('API 调用失败')) {
      console.warn('❌ API 调用失败，需要进一步分析');
      
      // 分析失败原因
      if (errorOutput.includes('401')) {
        console.warn('🔑 问题：API Key 无效或过期');
      } else if (errorOutput.includes('403')) {
        console.warn('🚫 问题：API Key 权限不足');
      } else if (errorOutput.includes('429')) {
        console.warn('⏱️  问题：API 调用频率限制');
      } else if (errorOutput.includes('404')) {
        console.warn('🌐 问题：API 端点不正确');
      } else {
        console.warn('🔍 其他问题：需要详细分析');
      }
    }
  } else {
    console.warn('❌ 测试失败，退出码：', code);
  }
  
  process.exit(code);
});



