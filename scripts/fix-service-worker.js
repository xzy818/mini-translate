#!/usr/bin/env node

/**
 * 修复Service Worker兼容性问题
 * 将ES6 import语句转换为importScripts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.warn('🔧 修复Service Worker兼容性问题...\n');

// 读取background.js
const backgroundPath = join(projectRoot, 'dist', 'background.js');
const backgroundCode = readFileSync(backgroundPath, 'utf8');

console.warn('📖 读取background.js文件...');

// 提取import语句
const importRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];?/g;
const importScriptsRegex = /import\s+([^{][^;]+)\s+from\s+['"]([^'"]+)['"];?/g;

let modifiedCode = backgroundCode;
const importStatements = [];
const importScripts = [];

// 处理命名导入
let match;
while ((match = importRegex.exec(backgroundCode)) !== null) {
  const imports = match[1].split(',').map(imp => imp.trim());
  const modulePath = match[2];
  
  importStatements.push({
    type: 'named',
    imports,
    module: modulePath,
    original: match[0]
  });
}

// 处理默认导入
importRegex.lastIndex = 0;
while ((match = importScriptsRegex.exec(backgroundCode)) !== null) {
  const defaultImport = match[1].trim();
  const modulePath = match[2];
  
  importStatements.push({
    type: 'default',
    imports: [defaultImport],
    module: modulePath,
    original: match[0]
  });
}

console.warn(`📦 发现 ${importStatements.length} 个import语句:`);
importStatements.forEach((imp, index) => {
  console.warn(`  ${index + 1}. ${imp.type} from '${imp.module}'`);
});

// 生成importScripts语句
const importScriptsCode = importStatements
  .map(imp => `importScripts('${imp.module}');`)
  .join('\n');

// 移除所有import语句
modifiedCode = modifiedCode.replace(/import\s+.*?from\s+['"][^'"]+['"];?\n?/g, '');

// 在文件开头添加importScripts
modifiedCode = importScriptsCode + '\n\n' + modifiedCode;

console.warn('\n📝 生成修复后的代码...');
console.warn('添加的importScripts:');
importStatements.forEach(imp => {
  console.warn(`  importScripts('${imp.module}');`);
});

// 备份原文件
const backupPath = backgroundPath + '.backup';
writeFileSync(backupPath, backgroundCode);
console.warn(`\n💾 备份原文件到: ${backupPath}`);

// 写入修复后的文件
writeFileSync(backgroundPath, modifiedCode);
console.warn('✅ 修复完成！');

console.warn('\n📊 修复摘要:');
console.warn(`- 移除了 ${importStatements.length} 个ES6 import语句`);
console.warn(`- 添加了 ${importStatements.length} 个importScripts语句`);
console.warn(`- 文件大小: ${backgroundCode.length} → ${modifiedCode.length} 字符`);

console.warn('\n🎉 Service Worker兼容性修复完成！');
