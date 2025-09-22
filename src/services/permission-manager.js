/**
 * Chrome扩展动态权限管理器
 * 实现最小权限原则和动态权限请求
 */

/**
 * 权限配置定义
 */
const PERMISSION_CONFIG = {
  // 基础权限 - 扩展核心功能必需
  BASIC: {
    permissions: ['storage', 'contextMenus', 'notifications'],
    host_permissions: []
  },
  
  // 网络权限 - 根据用户选择的API动态请求
  NETWORK: {
    openai: {
      permissions: [],
      host_permissions: ['https://api.openai.com/*']
    },
    dashscope: {
      permissions: [],
      host_permissions: ['https://dashscope.aliyuncs.com/*']
    },
    deepseek: {
      permissions: [],
      host_permissions: ['https://api.deepseek.com/*']
    }
  },
  
  // 高级功能权限 - 可选功能
  ADVANCED: {
    scripting: {
      permissions: ['scripting', 'activeTab'],
      host_permissions: []
    },
    offscreen: {
      permissions: ['offscreen'],
      host_permissions: []
    }
  }
};

/**
 * 检查权限是否已授予
 */
async function hasPermission(permission) {
  try {
    if (permission.startsWith('http')) {
      // 检查host权限
      const result = await chrome.permissions.contains({
        origins: [permission]
      });
      return result;
    } else {
      // 检查普通权限
      const result = await chrome.permissions.contains({
        permissions: [permission]
      });
      return result;
    }
  } catch (error) {
    console.log('❌ 检查权限失败:', error);
    return false;
  }
}

/**
 * 请求权限
 */
async function requestPermission(permission) {
  try {
    if (permission.startsWith('http')) {
      // 请求host权限
      const result = await chrome.permissions.request({
        origins: [permission]
      });
      return result;
    } else {
      // 请求普通权限
      const result = await chrome.permissions.request({
        permissions: [permission]
      });
      return result;
    }
  } catch (error) {
    console.log('❌ 请求权限失败:', error);
    return false;
  }
}

/**
 * 根据API类型获取所需权限
 */
function getRequiredPermissions(apiType) {
  const config = PERMISSION_CONFIG.NETWORK[apiType];
  if (!config) {
    throw new Error(`不支持的API类型: ${apiType}`);
  }
  
  return {
    permissions: config.permissions,
    host_permissions: config.host_permissions
  };
}

/**
 * 检查API权限是否已授予
 */
async function checkApiPermissions(apiType) {
  try {
    const required = getRequiredPermissions(apiType);
    const allPermissions = [...required.permissions, ...required.host_permissions];
    
    const results = await Promise.all(
      allPermissions.map(permission => hasPermission(permission))
    );
    
    return results.every(result => result === true);
  } catch (error) {
    console.log('❌ 检查API权限失败:', error);
    return false;
  }
}

/**
 * 请求API权限
 */
async function requestApiPermissions(apiType) {
  try {
    console.log(`🔍 请求${apiType} API权限...`);
    
    const required = getRequiredPermissions(apiType);
    const allPermissions = [...required.permissions, ...required.host_permissions];
    
    // 检查哪些权限还没有授予
    const missingPermissions = [];
    const missingHostPermissions = [];
    
    for (const permission of allPermissions) {
      const hasIt = await hasPermission(permission);
      if (!hasIt) {
        if (permission.startsWith('http')) {
          missingHostPermissions.push(permission);
        } else {
          missingPermissions.push(permission);
        }
      }
    }
    
    // 请求缺失的权限
    if (missingPermissions.length > 0 || missingHostPermissions.length > 0) {
      const result = await chrome.permissions.request({
        permissions: missingPermissions,
        origins: missingHostPermissions
      });
      
      if (result) {
        console.log(`✅ ${apiType} API权限请求成功`);
        return true;
      } else {
        console.log(`❌ ${apiType} API权限请求被拒绝`);
        return false;
      }
    } else {
      console.log(`✅ ${apiType} API权限已存在`);
      return true;
    }
  } catch (error) {
    console.log(`❌ 请求${apiType} API权限失败:`, error);
    return false;
  }
}

/**
 * 移除不需要的权限
 */
async function removeUnusedPermissions() {
  try {
    console.log('🔍 检查并移除不需要的权限...');
    
    // 获取当前所有权限
    const currentPermissions = await chrome.permissions.getAll();
    
    // 检查哪些权限不再需要
    const permissionsToRemove = [];
    const originsToRemove = [];
    
    // 检查网络权限
    const usedApis = await getUsedApis();
    const requiredHostPermissions = new Set();
    
    for (const api of usedApis) {
      const required = getRequiredPermissions(api);
      required.host_permissions.forEach(host => requiredHostPermissions.add(host));
    }
    
    // 找出不需要的host权限
    currentPermissions.origins?.forEach(origin => {
      if (!requiredHostPermissions.has(origin)) {
        originsToRemove.push(origin);
      }
    });
    
    // 移除不需要的权限
    if (permissionsToRemove.length > 0 || originsToRemove.length > 0) {
      const result = await chrome.permissions.remove({
        permissions: permissionsToRemove,
        origins: originsToRemove
      });
      
      if (result) {
        console.log('✅ 成功移除不需要的权限');
      } else {
        console.log('❌ 移除权限失败');
      }
    } else {
      console.log('✅ 没有需要移除的权限');
    }
  } catch (error) {
    console.log('❌ 移除权限失败:', error);
  }
}

/**
 * 获取当前使用的API类型
 */
async function getUsedApis() {
  try {
    const result = await chrome.storage.local.get(['apiBaseUrl']);
    const apiBaseUrl = result.apiBaseUrl || '';
    
    const usedApis = [];
    
    if (apiBaseUrl.includes('api.openai.com')) {
      usedApis.push('openai');
    }
    if (apiBaseUrl.includes('dashscope.aliyuncs.com')) {
      usedApis.push('dashscope');
    }
    if (apiBaseUrl.includes('api.deepseek.com')) {
      usedApis.push('deepseek');
    }
    
    return usedApis;
  } catch (error) {
    console.log('❌ 获取使用的API失败:', error);
    return [];
  }
}

/**
 * 权限状态监控
 */
function setupPermissionMonitoring() {
  // 监听权限变化
  chrome.permissions.onAdded.addListener((permissions) => {
    console.log('🔍 权限已添加:', permissions);
  });
  
  chrome.permissions.onRemoved.addListener((permissions) => {
    console.log('🔍 权限已移除:', permissions);
  });
}

/**
 * 初始化权限管理器
 */
async function initializePermissionManager() {
  try {
    console.log('🔍 初始化权限管理器...');
    
    // 设置权限监控
    setupPermissionMonitoring();
    
    // 确保基础权限存在
    const basicPermissions = PERMISSION_CONFIG.BASIC.permissions;
    for (const permission of basicPermissions) {
      const hasIt = await hasPermission(permission);
      if (!hasIt) {
        console.log(`⚠️ 缺少基础权限: ${permission}`);
      }
    }
    
    // 检查并请求API权限
    const usedApis = await getUsedApis();
    for (const api of usedApis) {
      const hasApiPermission = await checkApiPermissions(api);
      if (!hasApiPermission) {
        await requestApiPermissions(api);
      }
    }
    
    console.log('✅ 权限管理器初始化完成');
  } catch (error) {
    console.log('❌ 权限管理器初始化失败:', error);
  }
}

export {
  hasPermission,
  requestPermission,
  getRequiredPermissions,
  checkApiPermissions,
  requestApiPermissions,
  removeUnusedPermissions,
  getUsedApis,
  setupPermissionMonitoring,
  initializePermissionManager,
  PERMISSION_CONFIG
};
