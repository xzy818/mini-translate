#!/usr/bin/env node

/**
 * Chrome扩展加载测试用例
 * 验证扩展加载阶段的关键功能和错误场景
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 测试配置
const TEST_CONFIG = {
  distPath: join(projectRoot, 'dist'),
  manifestPath: join(projectRoot, 'dist', 'manifest.json'),
  backgroundPath: join(projectRoot, 'dist', 'background.js'),
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
  passed: 0,
  failed: 0,
  errors: []
};

/**
 * 测试辅助函数
 */
function logTest(name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${name}${message ? ': ' + message : ''}`);
  
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
    testResults.errors.push({ name, message });
  }
}

function checkFileExists(filePath, description) {
  const exists = existsSync(filePath);
  logTest(description, exists, exists ? '' : `File not found: ${filePath}`);
  return exists;
}

function checkJSONSyntax(filePath, description) {
  try {
    const content = readFileSync(filePath, 'utf8');
    JSON.parse(content);
    logTest(description, true);
    return true;
  } catch (error) {
    logTest(description, false, `JSON syntax error: ${error.message}`);
    return false;
  }
}

function extractImportPaths(code) {
  const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
  const matches = [];
  let match;
  
  while ((match = importRegex.exec(code)) !== null) {
    matches.push(match[1]);
  }
  
  return matches;
}

function checkImportPaths(code, basePath, description) {
  const importPaths = extractImportPaths(code);
  let allPathsValid = true;
  
  for (const path of importPaths) {
    if (!path.startsWith('chrome:') && !path.startsWith('http')) {
      const fullPath = join(basePath, path);
      if (!existsSync(fullPath)) {
        logTest(`${description} - Import path: ${path}`, false, `File not found: ${fullPath}`);
        allPathsValid = false;
      }
    }
  }
  
  if (allPathsValid && importPaths.length > 0) {
    logTest(description, true, `All ${importPaths.length} import paths valid`);
  }
  
  return allPathsValid;
}

/**
 * 测试用例实现
 */

// TC-FI-001: 文件完整性检查
function testFileIntegrity() {
  console.log('\n📁 Testing File Integrity...');
  
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
  
  return allFilesExist;
}

// TC-MF-001: Manifest语法验证
function testManifestSyntax() {
  console.log('\n📋 Testing Manifest Syntax...');
  
  const manifestExists = checkFileExists(TEST_CONFIG.manifestPath, 'Manifest file exists');
  if (!manifestExists) return false;
  
  const syntaxValid = checkJSONSyntax(TEST_CONFIG.manifestPath, 'Manifest JSON syntax');
  if (!syntaxValid) return false;
  
  return true;
}

// TC-MF-002: Manifest必需字段检查
function testManifestRequiredFields() {
  console.log('\n🔍 Testing Manifest Required Fields...');
  
  try {
    const manifest = JSON.parse(readFileSync(TEST_CONFIG.manifestPath, 'utf8'));
    const requiredFields = ['manifest_version', 'name', 'version', 'permissions'];
    let allFieldsPresent = true;
    
    for (const field of requiredFields) {
      const hasField = manifest[field] !== undefined;
      logTest(`Required field: ${field}`, hasField, hasField ? '' : 'Field missing');
      if (!hasField) allFieldsPresent = false;
    }
    
    // 检查Service Worker配置
    const hasBackground = manifest.background !== undefined;
    const hasServiceWorker = manifest.background && manifest.background.service_worker;
    const serviceWorkerExists = hasServiceWorker && existsSync(join(TEST_CONFIG.distPath, manifest.background.service_worker));
    
    logTest('Background configuration', hasBackground, hasBackground ? '' : 'Background section missing');
    logTest('Service worker file', serviceWorkerExists, serviceWorkerExists ? '' : 'Service worker file not found');
    
    return allFieldsPresent && hasBackground && serviceWorkerExists;
  } catch (error) {
    logTest('Manifest required fields', false, `Error reading manifest: ${error.message}`);
    return false;
  }
}

// TC-MF-003: Service Worker配置检查
function testServiceWorkerConfiguration() {
  console.log('\n⚙️ Testing Service Worker Configuration...');
  
  try {
    const manifest = JSON.parse(readFileSync(TEST_CONFIG.manifestPath, 'utf8'));
    
    // 检查Service Worker配置
    const hasServiceWorker = manifest.background && manifest.background.service_worker;
    logTest('Service worker defined', hasServiceWorker, hasServiceWorker ? '' : 'Service worker not defined');
    
    if (hasServiceWorker) {
      const serviceWorkerPath = join(TEST_CONFIG.distPath, manifest.background.service_worker);
      const serviceWorkerExists = existsSync(serviceWorkerPath);
      logTest('Service worker file exists', serviceWorkerExists, serviceWorkerExists ? '' : 'Service worker file not found');
      
      // 检查type: module配置的兼容性
      const hasTypeModule = manifest.background.type === 'module';
      if (hasTypeModule) {
        logTest('Module type configuration', true, 'Using ES6 modules (may cause compatibility issues)');
      }
      
      return serviceWorkerExists;
    }
    
    return false;
  } catch (error) {
    logTest('Service worker configuration', false, `Error checking configuration: ${error.message}`);
    return false;
  }
}

// TC-SW-001: Service Worker模块导入检查
function testServiceWorkerImports() {
  console.log('\n📦 Testing Service Worker Module Imports...');
  
  const backgroundExists = checkFileExists(TEST_CONFIG.backgroundPath, 'Background script exists');
  if (!backgroundExists) return false;
  
  try {
    const backgroundCode = readFileSync(TEST_CONFIG.backgroundPath, 'utf8');
    
    // 检查import语句
    const hasImports = backgroundCode.includes('import');
    logTest('Has import statements', hasImports, hasImports ? '' : 'No import statements found');
    
    if (hasImports) {
      // 检查所有import路径
      const importsValid = checkImportPaths(backgroundCode, TEST_CONFIG.distPath, 'Service worker imports');
      
      // 检查是否有src/路径的import（可能导致加载失败）
      const hasSrcImports = backgroundCode.includes('from \'../src/') || backgroundCode.includes('from "../src/');
      logTest('No src/ path imports', !hasSrcImports, hasSrcImports ? 'Found src/ path imports (will cause loading failure)' : '');
      
      return importsValid && !hasSrcImports;
    }
    
    return true;
  } catch (error) {
    logTest('Service worker imports', false, `Error reading background script: ${error.message}`);
    return false;
  }
}

// TC-SW-002: Service Worker语法兼容性检查
function testServiceWorkerSyntaxCompatibility() {
  console.log('\n🔧 Testing Service Worker Syntax Compatibility...');
  
  try {
    const backgroundCode = readFileSync(TEST_CONFIG.backgroundPath, 'utf8');
    
    // 检查ES6 class语法（Service Worker可能不支持）
    const hasClassSyntax = /class\s+\w+/.test(backgroundCode);
    logTest('No ES6 class syntax', !hasClassSyntax, hasClassSyntax ? 'Found ES6 class syntax (may cause compatibility issues)' : '');
    
    // 检查async/await语法
    const hasAsyncAwait = /async\s+function|await\s+/.test(backgroundCode);
    logTest('Async/await syntax', hasAsyncAwait, hasAsyncAwait ? 'Using async/await (should be compatible)' : 'No async/await found');
    
    // 检查箭头函数
    const hasArrowFunctions = /=>\s*{/.test(backgroundCode);
    logTest('Arrow functions', hasArrowFunctions, hasArrowFunctions ? 'Using arrow functions (should be compatible)' : 'No arrow functions found');
    
    return !hasClassSyntax; // 主要关注class语法问题
  } catch (error) {
    logTest('Service worker syntax', false, `Error checking syntax: ${error.message}`);
    return false;
  }
}

// TC-EL-001: 扩展加载状态模拟检查
function testExtensionLoadingStatus() {
  console.log('\n🚀 Testing Extension Loading Status...');
  
  // 模拟检查扩展基本信息
  try {
    const manifest = JSON.parse(readFileSync(TEST_CONFIG.manifestPath, 'utf8'));
    
    // 检查版本号格式
    const versionValid = /^\d+\.\d+\.\d+$/.test(manifest.version);
    logTest('Version format valid', versionValid, versionValid ? '' : 'Invalid version format');
    
    // 检查权限配置
    const requiredPermissions = ['contextMenus', 'storage', 'scripting', 'activeTab'];
    const hasRequiredPermissions = requiredPermissions.every(perm => 
      manifest.permissions && manifest.permissions.includes(perm)
    );
    logTest('Required permissions', hasRequiredPermissions, hasRequiredPermissions ? '' : 'Missing required permissions');
    
    // 检查host_permissions
    const hasHostPermissions = manifest.host_permissions && manifest.host_permissions.length > 0;
    logTest('Host permissions configured', hasHostPermissions, hasHostPermissions ? '' : 'No host permissions configured');
    
    return versionValid && hasRequiredPermissions && hasHostPermissions;
  } catch (error) {
    logTest('Extension loading status', false, `Error checking status: ${error.message}`);
    return false;
  }
}

/**
 * 主测试执行函数
 */
async function runExtensionLoadingTests() {
  console.log('🧪 Starting Chrome Extension Loading Tests...\n');
  
  // 检查dist目录是否存在
  const distExists = existsSync(TEST_CONFIG.distPath);
  if (!distExists) {
    console.log('❌ dist/ directory not found. Please run "npm run build" first.');
    process.exit(1);
  }
  
  // 执行所有测试
  const tests = [
    { name: 'File Integrity', fn: testFileIntegrity },
    { name: 'Manifest Syntax', fn: testManifestSyntax },
    { name: 'Manifest Required Fields', fn: testManifestRequiredFields },
    { name: 'Service Worker Configuration', fn: testServiceWorkerConfiguration },
    { name: 'Service Worker Imports', fn: testServiceWorkerImports },
    { name: 'Service Worker Syntax', fn: testServiceWorkerSyntaxCompatibility },
    { name: 'Extension Loading Status', fn: testExtensionLoadingStatus }
  ];
  
  let allTestsPassed = true;
  
  for (const test of tests) {
    try {
      const result = test.fn();
      if (!result) allTestsPassed = false;
    } catch (error) {
      logTest(test.name, false, `Test execution error: ${error.message}`);
      allTestsPassed = false;
    }
  }
  
  // 输出测试结果摘要
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n🚨 Failed Tests:');
    testResults.errors.forEach(error => {
      console.log(`  - ${error.name}: ${error.message}`);
    });
  }
  
  if (allTestsPassed) {
    console.log('\n🎉 All extension loading tests passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed. Please fix the issues before proceeding.');
    process.exit(1);
  }
}

// 执行测试
runExtensionLoadingTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
