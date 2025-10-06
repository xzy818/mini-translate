#!/usr/bin/env node

/**
 * 完整修复background.js的Service Worker兼容性
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔧 完整修复background.js Service Worker兼容性...\n');

const backgroundPath = join(projectRoot, 'dist', 'background.js');
let backgroundCode = readFileSync(backgroundPath, 'utf8');

console.log('📖 读取background.js文件...');

// 移除所有import语句（包括多行）
backgroundCode = backgroundCode.replace(/import\s+{[^}]+}\s+from\s+['"][^'"]+['"];?\n?/g, '');
backgroundCode = backgroundCode.replace(/import\s+[^{][^;]+from\s+['"][^'"]+['"];?\n?/g, '');

// 确保importScripts在文件开头
const importScripts = [
  "importScripts('./src/services/context-menu.js');",
  "importScripts('./src/services/translator.js');", 
  "importScripts('./src/services/ai-api-client.js');",
  "importScripts('./src/config/model-providers.js');"
].join('\n');

// 如果文件开头没有importScripts，添加它们
if (!backgroundCode.startsWith('importScripts')) {
  backgroundCode = importScripts + '\n\n' + backgroundCode;
}

console.log('📝 生成修复后的代码...');

// 备份原文件
const backupPath = backgroundPath + '.backup2';
writeFileSync(backupPath, readFileSync(backgroundPath, 'utf8'));
console.log(`💾 备份原文件到: ${backupPath}`);

// 写入修复后的文件
writeFileSync(backgroundPath, backgroundCode);
console.log('✅ 修复完成！');

console.log('\n📊 修复摘要:');
console.log('- 移除了所有ES6 import语句');
console.log('- 添加了importScripts语句');
console.log(`- 文件大小: ${backgroundCode.length} 字符`);

console.log('\n🎉 Service Worker兼容性修复完成！');
