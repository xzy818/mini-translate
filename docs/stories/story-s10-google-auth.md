# Story S10: Google账号认证与同步基础

## 状态
Draft

## 故事
作为用户，
我希望能够通过Google账号登录，
以便在不同设备间同步我的生词表数据。

## 验收标准
1. 用户可以通过Google账号登录
2. 登录状态在插件中正确显示
3. 支持登出功能
4. 登录状态持久化保存

## 任务/子任务
- [ ] 实现Google OAuth认证流程
  - [ ] 集成Chrome Identity API
  - [ ] 实现登录/登出功能
  - [ ] 处理认证状态变化
- [ ] 设计用户界面
  - [ ] 在设置页面添加Google登录按钮
  - [ ] 显示当前登录状态
  - [ ] 提供登出选项
- [ ] 实现状态管理
  - [ ] 保存登录状态到chrome.storage.local
  - [ ] 监听登录状态变化
  - [ ] 处理认证失败情况

## 开发说明
### Google OAuth集成
- 使用`chrome.identity.getAuthToken()`获取访问令牌
- 使用`chrome.identity.removeCachedAuthToken()`清除令牌
- 监听`chrome.identity.onSignInChanged`事件

### 权限要求
需要在manifest.json中添加：
```json
{
  "permissions": ["identity"],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID",
    "scopes": ["openid", "email", "profile"]
  }
}
```

### 错误处理
- 处理网络错误
- 处理用户取消授权
- 处理令牌过期

## 测试要求
- 单元测试：认证流程的各个步骤
- 集成测试：完整的登录/登出流程
- 用户测试：不同网络环境下的认证体验

## 文件清单
- `src/services/google-auth.js` - Google认证服务
- `src/config/oauth-config.js` - OAuth配置
- `tests/google-auth.test.js` - 认证测试
