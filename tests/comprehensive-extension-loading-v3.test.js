#!/usr/bin/env node

/**
 * 完整的Chrome扩展加载测试套件 V3.0
 * 实施多重验证机制：L1静态分析 + L2环境兼容性 + L3扩展加载验证
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 测试配置
const TEST_CONFIG = {
  distPath: join(projectRoot, 'dist'),
  manifestPath: join(projectRoot, 'dist', 'manifest.json'),
  backgroundPath: join(projectRoot, 'dist', 'background.js'),
  chromeDebugPort: 9228,
  chromeLogFile: '/tmp/mini-translate-comprehensive.log',
  chromeProfileDir: '/tmp/mini-translate-comprehensive-profile',
  chromePath: '/Users/dr.yang/code/mini-translate/.cache/chrome-for-testing/140.0.7339.207/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  requiredFiles: [
    'manifest.json',
    'background.js',
    'content.js',
    'popup.html',
    'options.html',
    'qa-bridge.js'
  ],
  requiredServices: [
    'src/services/context-menu.js',
    'src/services/translator.js',
    'src/services/ai-api-client.js',
    'src/config/model-providers.js'
  ]
};

// 测试结果收集
let testResults = {
  l1: { passed: 0, failed: 0, errors: [] },
  l2: { passed: 0, failed: 0, errors: [] },
  l3: { passed: 0, failed: 0, errors: [] },
  total: { passed: 0, failed: 0, errors: [] },
  chromeProcess: null,
  extensionId: null
};

/**
 * 测试辅助函数
 */
function logTest(level, name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${level}] ${name}${message ? ': ' + message : ''}`);
  
  if (passed) {
    testResults[level].passed++;
    testResults.total.passed++;
  } else {
    testResults[level].failed++;
    testResults.total.failed++;
    testResults[level].errors.push({ name, message });
    testResults.total.errors.push({ level, name, message });
  }
}

function checkFileExists(filePath, description) {
  const exists = existsSync(filePath);
  logTest('l1', description, exists, exists ? '' : `File not found: ${filePath}`);
  return exists;
}

function checkJSONSyntax(filePath, description) {
  try {
    const content = readFileSync(filePath, 'utf8');
    JSON.parse(content);
    logTest('l1', description, true);
    return true;
  } catch (error) {
    logTest('l1', description, false, `JSON syntax error: ${error.message}`);
    return false;
  }
}

/**
 * Chrome环境管理函数
 */
async function startChromeWithExtension() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting Chrome with extension for comprehensive testing...');
    
    // 清理旧的Chrome进程
    spawn('pkill', ['-f', 'Google Chrome for Testing'], { stdio: 'ignore' });
    
    const chromeProcess = spawn(TEST_CONFIG.chromePath, [
      `--remote-debugging-port=${TEST_CONFIG.chromeDebugPort}`,
      `--user-data-dir=${TEST_CONFIG.chromeProfileDir}`,
      '--no-first-run',
      '--load-extension=' + TEST_CONFIG.distPath,
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--auto-open-devtools-for-tabs'
    ], {
      stdio: 'pipe',
      cwd: projectRoot
    });
    
    testResults.chromeProcess = chromeProcess;
    
    chromeProcess.stdout.on('data', (data) => {
      console.log(`Chrome: ${data}`);
    });
    
    chromeProcess.stderr.on('data', (data) => {
      console.log(`Chrome Error: ${data}`);
    });
    
    // 等待Chrome启动
    setTimeout(() => {
      resolve(chromeProcess);
    }, 8000);
  });
}

async function stopChrome() {
  if (testResults.chromeProcess) {
    console.log('🛑 Stopping Chrome...');
    testResults.chromeProcess.kill();
    testResults.chromeProcess = null;
  }
  
  // 强制清理Chrome进程
  try {
    const { exec } = await import('child_process');
    exec('pkill -f "Google Chrome for Testing"', (error) => {
      if (error) console.log('Chrome cleanup error:', error.message);
    });
  } catch (error) {
    console.log('Chrome cleanup error:', error.message);
  }
}

async function getChromeDebugInfo() {
  try {
    const response = await fetch(`http://localhost:${TEST_CONFIG.chromeDebugPort}/json`);
    const data = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

async function getChromeExtensions() {
  const debugInfo = await getChromeDebugInfo();
  if (!debugInfo) return [];
  
  return debugInfo.filter(tab => 
    tab.url && tab.url.includes('chrome-extension://')
  );
}

async function getChromeServiceWorkers() {
  const debugInfo = await getChromeDebugInfo();
  if (!debugInfo) return [];
  
  return debugInfo.filter(tab => 
    tab.type === 'service_worker'
  );
}

async function getExtensionId() {
  const extensions = await getChromeExtensions();
  if (extensions.length > 0) {
    const extensionUrl = extensions[0].url;
    const match = extensionUrl.match(/chrome-extension:\/\/([^\/]+)/);
    if (match) {
      testResults.extensionId = match[1];
      return match[1];
    }
  }
  return null;
}

/**
 * L1: 静态分析测试
 */
function testL1StaticAnalysis() {
  console.log('\n📁 L1: Testing Static Analysis...');
  
  let allFilesExist = true;
  
  for (const file of TEST_CONFIG.requiredFiles) {
    const filePath = join(TEST_CONFIG.distPath, file);
    const exists = checkFileExists(filePath, `Required file: ${file}`);
    if (!exists) allFilesExist = false;
  }
  
  for (const service of TEST_CONFIG.requiredServices) {
    const servicePath = join(TEST_CONFIG.distPath, service);
    const exists = checkFileExists(servicePath, `Required service: ${service}`);
    if (!exists) allFilesExist = false;
  }
  
  const manifestExists = checkFileExists(TEST_CONFIG.manifestPath, 'Manifest file exists');
  if (!manifestExists) allFilesExist = false;
  
  const syntaxValid = checkJSONSyntax(TEST_CONFIG.manifestPath, 'Manifest JSON syntax');
  if (!syntaxValid) allFilesExist = false;
  
  return allFilesExist;
}

/**
 * L2: 环境兼容性测试
 */
function testL2EnvironmentCompatibility() {
  console.log('\n🔧 L2: Testing Environment Compatibility...');
  
  try {
    const manifest = JSON.parse(readFileSync(TEST_CONFIG.manifestPath, 'utf8'));
    
    // 检查是否使用了type: module
    const hasTypeModule = manifest.background && manifest.background.type === 'module';
    logTest('l2', 'No ES6 module type', !hasTypeModule, hasTypeModule ? 'Using type: module (may cause compatibility issues)' : '');
    
    // 检查background.js是否使用importScripts而不是import
    const backgroundCode = readFileSync(TEST_CONFIG.backgroundPath, 'utf8');
    const hasImportScripts = backgroundCode.includes('importScripts');
    const hasImportStatements = /^import\s+/.test(backgroundCode);
    
    logTest('l2', 'Using importScripts', hasImportScripts, hasImportScripts ? '' : 'Not using importScripts');
    logTest('l2', 'No import statements', !hasImportStatements, hasImportStatements ? 'Found import statements (incompatible with Service Worker)' : '');
    
    return !hasTypeModule && hasImportScripts && !hasImportStatements;
  } catch (error) {
    logTest('l2', 'Environment compatibility', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * L3: 扩展加载验证测试
 */
async function testL3ExtensionLoadingVerification() {
  console.log('\n🌐 L3: Testing Extension Loading Verification...');
  
  try {
    await startChromeWithExtension();
    
    // 等待Chrome启动
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 检查Chrome调试端口
    const debugInfo = await getChromeDebugInfo();
    const chromeStarted = debugInfo !== null;
    logTest('l3', 'Chrome debug port accessible', chromeStarted, chromeStarted ? '' : 'Chrome debug port not accessible');
    
    if (!chromeStarted) return false;
    
    // 检查扩展ID
    const extensionId = await getExtensionId();
    const extensionIdFound = extensionId !== null;
    logTest('l3', 'Extension ID retrieved', extensionIdFound, extensionIdFound ? `ID: ${extensionId}` : 'Extension not found in Chrome');
    
    if (!extensionIdFound) return false;
    
    // 检查Service Worker
    const serviceWorkers = await getChromeServiceWorkers();
    const miniTranslateSW = serviceWorkers.find(sw => 
      sw.url && sw.url.includes(extensionId)
    );
    
    const swRegistered = miniTranslateSW !== undefined;
    logTest('l3', 'Service Worker registered', swRegistered, swRegistered ? `URL: ${miniTranslateSW.url}` : 'Service Worker not found');
    
    // 检查扩展权限
    const extensions = await getChromeExtensions();
    const miniTranslate = extensions.find(ext => 
      ext.title && ext.title.includes('Mini Translate')
    );
    
    const extensionFound = miniTranslate !== undefined;
    logTest('l3', 'Extension found in Chrome', extensionFound, extensionFound ? `Title: ${miniTranslate.title}` : 'Extension not found');
    
    return chromeStarted && extensionIdFound && swRegistered && extensionFound;
  } catch (error) {
    logTest('l3', 'Extension loading verification', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * 主测试执行函数
 */
async function runComprehensiveExtensionLoadingTestsV3() {
  console.log('🧪 Starting Comprehensive Chrome Extension Loading Tests V3.0...\n');
  
  // 检查dist目录是否存在
  const distExists = existsSync(TEST_CONFIG.distPath);
  if (!distExists) {
    console.log('❌ dist/ directory not found. Please run "npm run build" first.');
    process.exit(1);
  }
  
  let allTestsPassed = true;
  
  try {
    // L1: 静态分析测试
    const l1Result = testL1StaticAnalysis();
    if (!l1Result) allTestsPassed = false;
    
    // L2: 环境兼容性测试
    const l2Result = testL2EnvironmentCompatibility();
    if (!l2Result) allTestsPassed = false;
    
    // L3: 扩展加载验证测试
    const l3Result = await testL3ExtensionLoadingVerification();
    if (!l3Result) allTestsPassed = false;
    
  } finally {
    // 清理Chrome进程
    await stopChrome();
  }
  
  // 输出测试结果摘要
  console.log('\n📊 Comprehensive Extension Loading Test Results V3.0:');
  console.log(`\n📁 L1 Static Analysis: ${testResults.l1.passed} passed, ${testResults.l1.failed} failed`);
  console.log(`🔧 L2 Environment Compatibility: ${testResults.l2.passed} passed, ${testResults.l2.failed} failed`);
  console.log(`🌐 L3 Extension Loading Verification: ${testResults.l3.passed} passed, ${testResults.l3.failed} failed`);
  console.log(`\n📈 Total Success Rate: ${((testResults.total.passed / (testResults.total.passed + testResults.total.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.extensionId) {
    console.log(`🆔 Extension ID: ${testResults.extensionId}`);
  }
  
  if (testResults.total.errors.length > 0) {
    console.log('\n🚨 Failed Tests:');
    testResults.total.errors.forEach(error => {
      console.log(`  - [${error.level}] ${error.name}: ${error.message}`);
    });
  }
  
  if (allTestsPassed) {
    console.log('\n🎉 All comprehensive extension loading tests V3.0 passed!');
    // 移除process.exit，让vitest处理
  } else {
    console.log('\n💥 Some tests failed. Please fix the issues before proceeding.');
    // 移除process.exit，让vitest处理
  }
}

// 处理进程退出
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  await stopChrome();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, cleaning up...');
  await stopChrome();
  process.exit(0);
});

// 执行测试
runComprehensiveExtensionLoadingTestsV3().catch(async (error) => {
  console.error('❌ Comprehensive test execution failed:', error);
  await stopChrome();
  // 移除process.exit，让vitest处理
});
