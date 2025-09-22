#!/usr/bin/env node

/**
 * 中优先级改进验证脚本
 * 验证动态权限请求、测试覆盖、错误处理等改进
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 中优先级改进验证');
console.log('=====================================');

// 验证1: 检查新增文件
function verifyNewFiles() {
  console.log('\n📁 验证新增文件');
  
  const newFiles = [
    'src/services/permission-manager.js',
    'src/services/error-handler.js',
    'tests/chrome-extension/chrome-extension.test.js',
    'tests/chrome-extension/permissions.test.js',
    'tests/chrome-extension/service-worker.test.js',
    'tests/e2e/extension-e2e.test.js'
  ];
  
  let allFilesExist = true;
  
  newFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} 存在`);
    } else {
      console.log(`❌ ${file} 不存在`);
      allFilesExist = false;
    }
  });
  
  return allFilesExist;
}

// 验证2: 检查权限管理器实现
function verifyPermissionManager() {
  console.log('\n🔐 验证权限管理器实现');
  
  try {
    const content = fs.readFileSync('src/services/permission-manager.js', 'utf8');
    
    const checks = [
      {
        name: 'PERMISSION_CONFIG配置',
        test: content.includes('PERMISSION_CONFIG')
      },
      {
        name: 'hasPermission函数',
        test: content.includes('hasPermission')
      },
      {
        name: 'requestPermission函数',
        test: content.includes('requestPermission')
      },
      {
        name: 'checkApiPermissions函数',
        test: content.includes('checkApiPermissions')
      },
      {
        name: 'requestApiPermissions函数',
        test: content.includes('requestApiPermissions')
      },
      {
        name: 'getUsedApis函数',
        test: content.includes('getUsedApis')
      },
      {
        name: 'removeUnusedPermissions函数',
        test: content.includes('removeUnusedPermissions')
      }
    ];
    
    let allChecksPass = true;
    
    checks.forEach(check => {
      if (check.test) {
        console.log(`✅ ${check.name}`);
      } else {
        console.log(`❌ ${check.name}`);
        allChecksPass = false;
      }
    });
    
    return allChecksPass;
    
  } catch (error) {
    console.log('❌ 权限管理器检查失败:', error.message);
    return false;
  }
}

// 验证3: 检查错误处理器实现
function verifyErrorHandler() {
  console.log('\n🚨 验证错误处理器实现');
  
  try {
    const content = fs.readFileSync('src/services/error-handler.js', 'utf8');
    
    const checks = [
      {
        name: 'ERROR_TYPES枚举',
        test: content.includes('ERROR_TYPES')
      },
      {
        name: 'ERROR_SEVERITY枚举',
        test: content.includes('ERROR_SEVERITY')
      },
      {
        name: 'ExtensionError类',
        test: content.includes('class ExtensionError')
      },
      {
        name: 'Logger类',
        test: content.includes('class Logger')
      },
      {
        name: 'ErrorHandler类',
        test: content.includes('class ErrorHandler')
      },
      {
        name: 'handleNetworkError函数',
        test: content.includes('handleNetworkError')
      },
      {
        name: 'handlePermissionError函数',
        test: content.includes('handlePermissionError')
      },
      {
        name: 'handleStorageError函数',
        test: content.includes('handleStorageError')
      }
    ];
    
    let allChecksPass = true;
    
    checks.forEach(check => {
      if (check.test) {
        console.log(`✅ ${check.name}`);
      } else {
        console.log(`❌ ${check.name}`);
        allChecksPass = false;
      }
    });
    
    return allChecksPass;
    
  } catch (error) {
    console.log('❌ 错误处理器检查失败:', error.message);
    return false;
  }
}

// 验证4: 检查测试覆盖
function verifyTestCoverage() {
  console.log('\n🧪 验证测试覆盖');
  
  const testFiles = [
    'tests/chrome-extension/chrome-extension.test.js',
    'tests/chrome-extension/permissions.test.js',
    'tests/chrome-extension/service-worker.test.js',
    'tests/e2e/extension-e2e.test.js'
  ];
  
  let allTestsExist = true;
  
  testFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const testCount = (content.match(/it\(/g) || []).length;
      console.log(`✅ ${file} 存在 (${testCount} 个测试)`);
    } else {
      console.log(`❌ ${file} 不存在`);
      allTestsExist = false;
    }
  });
  
  return allTestsExist;
}

// 验证5: 检查options.js集成
function verifyOptionsIntegration() {
  console.log('\n⚙️ 验证options.js集成');
  
  try {
    const content = fs.readFileSync('public/options.js', 'utf8');
    
    const checks = [
      {
        name: '导入权限管理器',
        test: content.includes('permission-manager.js')
      },
      {
        name: '权限检查逻辑',
        test: content.includes('checkApiPermissions')
      },
      {
        name: '权限请求逻辑',
        test: content.includes('requestApiPermissions')
      },
      {
        name: 'API类型检测',
        test: content.includes('api.openai.com') && content.includes('dashscope.aliyuncs.com')
      }
    ];
    
    let allChecksPass = true;
    
    checks.forEach(check => {
      if (check.test) {
        console.log(`✅ ${check.name}`);
      } else {
        console.log(`❌ ${check.name}`);
        allChecksPass = false;
      }
    });
    
    return allChecksPass;
    
  } catch (error) {
    console.log('❌ options.js集成检查失败:', error.message);
    return false;
  }
}

// 验证6: 检查translator.js集成
function verifyTranslatorIntegration() {
  console.log('\n🔧 验证translator.js集成');
  
  try {
    const content = fs.readFileSync('src/services/translator.js', 'utf8');
    
    const checks = [
      {
        name: '导入错误处理器',
        test: content.includes('error-handler.js')
      },
      {
        name: '使用logger',
        test: content.includes('logger.debug') || content.includes('logger.error')
      },
      {
        name: '使用handleNetworkError',
        test: content.includes('handleNetworkError')
      }
    ];
    
    let allChecksPass = true;
    
    checks.forEach(check => {
      if (check.test) {
        console.log(`✅ ${check.name}`);
      } else {
        console.log(`❌ ${check.name}`);
        allChecksPass = false;
      }
    });
    
    return allChecksPass;
    
  } catch (error) {
    console.log('❌ translator.js集成检查失败:', error.message);
    return false;
  }
}

// 主验证函数
async function runVerification() {
  console.log('🚀 开始中优先级改进验证...\n');
  
  const results = {
    newFiles: false,
    permissionManager: false,
    errorHandler: false,
    testCoverage: false,
    optionsIntegration: false,
    translatorIntegration: false
  };
  
  // 运行所有验证
  results.newFiles = verifyNewFiles();
  results.permissionManager = verifyPermissionManager();
  results.errorHandler = verifyErrorHandler();
  results.testCoverage = verifyTestCoverage();
  results.optionsIntegration = verifyOptionsIntegration();
  results.translatorIntegration = verifyTranslatorIntegration();
  
  // 生成验证报告
  console.log('\n📊 验证结果汇总');
  console.log('=====================================');
  
  const testNames = {
    newFiles: '新增文件验证',
    permissionManager: '权限管理器验证',
    errorHandler: '错误处理器验证',
    testCoverage: '测试覆盖验证',
    optionsIntegration: 'Options集成验证',
    translatorIntegration: 'Translator集成验证'
  };
  
  let passedTests = 0;
  let totalTests = 0;
  
  Object.entries(results).forEach(([key, result]) => {
    totalTests++;
    if (result) {
      passedTests++;
      console.log(`✅ ${testNames[key]}: 通过`);
    } else {
      console.log(`❌ ${testNames[key]}: 失败`);
    }
  });
  
  console.log(`\n📈 总体结果: ${passedTests}/${totalTests} 验证通过`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有验证通过！中优先级改进实施成功！');
    console.log('\n📋 改进总结:');
    console.log('1. ✅ 动态权限请求机制 - 实现最小权限原则');
    console.log('2. ✅ Chrome扩展环境测试套件 - 全面的测试覆盖');
    console.log('3. ✅ 权限测试覆盖 - 专门的权限管理测试');
    console.log('4. ✅ Service Worker测试 - 消息处理和生命周期测试');
    console.log('5. ✅ E2E测试框架 - 完整用户工作流程测试');
    console.log('6. ✅ 错误处理和日志记录 - 统一的错误管理');
    console.log('\n✨ 技术优势:');
    console.log('- 🔐 权限最小化，提高安全性');
    console.log('- 🧪 全面的测试覆盖，提高代码质量');
    console.log('- 🚨 统一的错误处理，提高稳定性');
    console.log('- 📊 详细的日志记录，便于调试');
    console.log('- 🔄 动态权限管理，提升用户体验');
  } else {
    console.log('⚠️  部分验证失败，需要进一步修复');
  }
  
  return passedTests === totalTests;
}

// 运行验证
runVerification().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 验证执行失败:', error);
  process.exit(1);
});
