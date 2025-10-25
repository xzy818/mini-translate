#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

try {
  const manifestPath = join(projectRoot, 'public', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  
  console.warn('🔍 Validating Chrome Extension Manifest...');
  
  // 必需字段检查
  const requiredFields = ['manifest_version', 'name', 'version', 'permissions'];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Manifest v3 检查
  if (manifest.manifest_version !== 3) {
    throw new Error('Must use Manifest V3');
  }
  
  // 权限检查
  const requiredPermissions = ['contextMenus', 'storage', 'scripting', 'activeTab'];
  for (const perm of requiredPermissions) {
    if (!manifest.permissions.includes(perm)) {
      throw new Error(`Missing required permission: ${perm}`);
    }
  }
  
  // Content scripts 检查
  if (!manifest.content_scripts || manifest.content_scripts.length === 0) {
    throw new Error('Content scripts must be defined');
  }
  
  // Background service worker 检查
  if (!manifest.background || !manifest.background.service_worker) {
    throw new Error('Background service worker must be defined');
  }
  
  console.warn('✅ Manifest validation passed');
  console.warn(`📦 Extension: ${manifest.name} v${manifest.version}`);
  console.warn(`🔧 Manifest Version: ${manifest.manifest_version}`);
  console.warn(`🔑 Permissions: ${manifest.permissions.join(', ')}`);
  
} catch (error) {
  console.error('❌ Manifest validation failed:', error.message);
  process.exit(1);
}
