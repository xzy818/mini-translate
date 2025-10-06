#!/usr/bin/env node

/**
 * 本地E2E测试运行脚本
 * 仅用于本地开发环境，禁止进入CI
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log('🧪 开始运行本地E2E测试套件...\n');
console.log('⚠️  注意：E2E测试仅用于本地开发，不会进入CI流程\n');

// E2E测试配置
const e2eTestConfig = {
  testFiles: [
    'tests/e2e-config-flow.test.js'
  ],
  environment: 'local-only'
};

// 验证E2E测试文件存在性
function validateE2ETestFiles() {
  console.log('🔍 验证E2E测试文件...');
  
  const missingFiles = e2eTestConfig.testFiles.filter(file => !existsSync(file));
  
  if (missingFiles.length > 0) {
    console.error('❌ 缺少E2E测试文件:');
    missingFiles.forEach(file => console.error(`  - ${file}`));
    return false;
  }
  
  console.log('✅ 所有E2E测试文件存在');
  return true;
}

// 运行E2E测试
function runE2ETests() {
  console.log('📋 E2E测试计划:');
  e2eTestConfig.testFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });
  console.log('');

  try {
    console.log('🚀 运行E2E测试套件...');
    const testCommand = `npx vitest run ${e2eTestConfig.testFiles.join(' ')} --reporter=verbose`;
    execSync(testCommand, { stdio: 'inherit' });
    
    console.log('\n✅ E2E测试通过！');
    return true;
  } catch (error) {
    console.error('\n❌ E2E测试失败:', error.message);
    return false;
  }
}

// 主函数
function main() {
  console.log('🎯 Mini Translate 本地E2E测试套件');
  console.log('=====================================\n');
  
  // 验证测试文件
  if (!validateE2ETestFiles()) {
    process.exit(1);
  }
  
  // 运行E2E测试
  const testPassed = runE2ETests();
  
  if (!testPassed) {
    console.log('\n❌ E2E测试套件执行失败');
    process.exit(1);
  }
  
  console.log('\n🎉 本地E2E测试套件执行完成！');
  console.log('📝 重要提醒:');
  console.log('  - E2E测试仅用于本地开发环境');
  console.log('  - 不会进入CI/CD流程');
  console.log('  - 用于验证完整的用户流程');
}

// 执行主函数
main();
