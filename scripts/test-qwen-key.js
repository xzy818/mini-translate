#!/usr/bin/env node

/**
 * 简化的 Qwen Key 测试脚本
 * 专门用于验证 Qwen MT Turbo API Key 是否有效
 */

import { spawn } from 'child_process';
import path from 'path';

console.warn('🔍 开始 Qwen Key 验证测试...\n');

// 检查环境变量
const qwenKey = process.env.TEST_QWEN_KEY;
if (!qwenKey) {
  console.error('❌ 错误：未设置 TEST_QWEN_KEY 环境变量');
  console.warn('请设置：export TEST_QWEN_KEY="your-qwen-key"');
  process.exit(1);
}

console.warn(`✅ Qwen Key 已设置（已掩码处理）`);
console.warn(`🔑 Key 格式：${qwenKey.substring(0, 8)}...${qwenKey.substring(qwenKey.length - 4)}`);

// 运行简化的测试
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
  console.warn('\n📊 测试完成');
  if (code === 0) {
    console.warn('✅ Qwen Key 验证成功！');
  } else {
    console.warn('❌ Qwen Key 验证失败，请检查 Key 是否正确');
  }
  process.exit(code);
});
