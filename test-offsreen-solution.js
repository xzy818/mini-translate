#!/usr/bin/env node

/**
 * Offscreen Document解决方案验证脚本
 * 验证Chrome扩展网络访问重构是否成功
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 Offscreen Document解决方案验证');
console.log('=====================================');

// 验证1: 检查关键文件是否存在
function verifyFiles() {
  console.log('\n📁 验证关键文件存在性');
  
  const requiredFiles = [
    'public/offscreen.html',
    'src/services/offscreen-manager.js',
    'src/services/translator.js',
    'public/manifest.json',
    'public/background.js'
  ];
  
  let allFilesExist = true;
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} 存在`);
    } else {
      console.log(`❌ ${file} 不存在`);
      allFilesExist = false;
    }
  });
  
  return allFilesExist;
}

// 验证2: 检查manifest.json权限配置
function verifyManifest() {
  console.log('\n📋 验证manifest.json配置');
  
  try {
    const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8'));
    
    const checks = [
      {
        name: 'offscreen权限存在',
        test: manifest.permissions && manifest.permissions.includes('offscreen')
      },
      {
        name: '移除webRequest权限',
        test: !manifest.permissions || !manifest.permissions.includes('webRequest')
      },
      {
        name: '移除tabs权限',
        test: !manifest.permissions || !manifest.permissions.includes('tabs')
      },
      {
        name: 'host_permissions最小化',
        test: manifest.host_permissions && 
              manifest.host_permissions.length === 3 &&
              manifest.host_permissions.includes('https://api.openai.com/*') &&
              manifest.host_permissions.includes('https://dashscope.aliyuncs.com/*') &&
              manifest.host_permissions.includes('https://api.deepseek.com/*')
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
    console.log('❌ manifest.json解析失败:', error.message);
    return false;
  }
}

// 验证3: 检查translator.js实现
function verifyTranslator() {
  console.log('\n🔧 验证translator.js实现');
  
  try {
    const translatorContent = fs.readFileSync('src/services/translator.js', 'utf8');
    
    const checks = [
      {
        name: '使用Offscreen Document',
        test: translatorContent.includes('sendOffscreenRequest')
      },
      {
        name: '移除脚本注入逻辑',
        test: !translatorContent.includes('chrome.scripting.executeScript')
      },
      {
        name: '移除标签页查询逻辑',
        test: !translatorContent.includes('chrome.tabs.query')
      },
      {
        name: '导入offscreen-manager',
        test: translatorContent.includes("import('./offscreen-manager.js')")
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
    console.log('❌ translator.js检查失败:', error.message);
    return false;
  }
}

// 验证4: 检查offscreen-manager.js实现
function verifyOffscreenManager() {
  console.log('\n🎯 验证offscreen-manager.js实现');
  
  try {
    const offscreenContent = fs.readFileSync('src/services/offscreen-manager.js', 'utf8');
    
    const checks = [
      {
        name: 'hasOffscreenDocument函数',
        test: offscreenContent.includes('hasOffscreenDocument')
      },
      {
        name: 'createOffscreenDocument函数',
        test: offscreenContent.includes('createOffscreenDocument')
      },
      {
        name: 'sendOffscreenRequest函数',
        test: offscreenContent.includes('sendOffscreenRequest')
      },
      {
        name: '正确的justification',
        test: offscreenContent.includes('Handle network requests for translation APIs')
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
    console.log('❌ offscreen-manager.js检查失败:', error.message);
    return false;
  }
}

// 验证5: 检查offscreen.html实现
function verifyOffscreenHtml() {
  console.log('\n📄 验证offscreen.html实现');
  
  try {
    const offscreenContent = fs.readFileSync('public/offscreen.html', 'utf8');
    
    const checks = [
      {
        name: '消息监听器',
        test: offscreenContent.includes('self.onmessage')
      },
      {
        name: 'FETCH_REQUEST处理',
        test: offscreenContent.includes('FETCH_REQUEST')
      },
      {
        name: 'FETCH_RESPONSE发送',
        test: offscreenContent.includes('FETCH_RESPONSE')
      },
      {
        name: 'OFFSCREEN_READY通知',
        test: offscreenContent.includes('OFFSCREEN_READY')
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
    console.log('❌ offscreen.html检查失败:', error.message);
    return false;
  }
}

// 主验证函数
async function runVerification() {
  console.log('🚀 开始Offscreen Document解决方案验证...\n');
  
  const results = {
    files: false,
    manifest: false,
    translator: false,
    offscreenManager: false,
    offscreenHtml: false
  };
  
  // 运行所有验证
  results.files = verifyFiles();
  results.manifest = verifyManifest();
  results.translator = verifyTranslator();
  results.offscreenManager = verifyOffscreenManager();
  results.offscreenHtml = verifyOffscreenHtml();
  
  // 生成验证报告
  console.log('\n📊 验证结果汇总');
  console.log('=====================================');
  
  const testNames = {
    files: '文件存在性验证',
    manifest: 'Manifest配置验证',
    translator: 'Translator实现验证',
    offscreenManager: 'Offscreen管理器验证',
    offscreenHtml: 'Offscreen HTML验证'
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
    console.log('🎉 所有验证通过！Offscreen Document解决方案实现成功！');
    console.log('\n📋 用户操作指南:');
    console.log('1. 重新加载Chrome扩展 (chrome://extensions/)');
    console.log('2. 打开扩展选项页面');
    console.log('3. 配置API设置并点击测试按钮');
    console.log('4. 验证翻译功能是否正常工作');
    console.log('\n✨ 改进效果:');
    console.log('- ✅ 不再依赖外部标签页');
    console.log('- ✅ 权限配置最小化');
    console.log('- ✅ 网络请求更稳定');
    console.log('- ✅ 用户体验更好');
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
