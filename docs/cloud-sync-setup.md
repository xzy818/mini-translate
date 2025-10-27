# 云端同步功能设置指南

## 当前状态
云端同步功能已改为**可选功能**，默认禁用。

## 如何启用

### 1. 获取 Google OAuth Client ID
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建或选择项目
3. 启用 Chrome Identity API
4. 创建 OAuth 2.0 客户端 ID（类型：Chrome 应用）
5. 复制 Client ID

### 2. 配置 manifest.json
将 `public/manifest.json` 中的 `oauth2.client_id` 替换为您的真实 Client ID：

```json
"oauth2": {
  "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
  "scopes": ["openid", "email", "profile"]
}
```

### 3. 显式初始化服务
在需要使用云同步的代码中：

```javascript
import cloudSyncService from './src/services/cloud-sync.js';
import googleAuthService from './src/services/google-auth.js';

// 初始化服务
await googleAuthService.init();
await cloudSyncService.init();

// 使用服务
if (googleAuthService.isUserAuthenticated()) {
  await cloudSyncService.syncData();
}
```

### 4. 重新构建扩展
```bash
npm run build
```

## 测试验证步骤

1. **构建扩展**: `npm run build`
2. **加载扩展**: 在 Chrome 扩展管理页面加载 `dist` 目录
3. **测试 popup**: 点击扩展图标，验证 popup 正常打开，无错误
4. **检查控制台**: 应看到配置验证的警告信息，但不应有错误
5. **测试基本功能**: 验证翻译、词库管理等核心功能正常工作

## 回滚方案

如果修改导致其他问题，可以通过以下方式回滚：

1. 使用 Git 恢复修改的文件
2. 或者临时启用自动初始化（不推荐）：

   - 在构造函数末尾添加 `this.init()`
   - 配置有效的 OAuth client_id

## 相关文件清单

- `src/services/cloud-sync.js` - 云端同步服务
- `src/services/google-auth.js` - Google 认证服务  
- `src/config/oauth-config.js` - OAuth 配置管理
- `public/manifest.json` - 扩展清单文件
- `docs/cloud-sync-setup.md` - 设置指南（新建）
