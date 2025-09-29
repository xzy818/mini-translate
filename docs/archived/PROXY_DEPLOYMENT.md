# Mini Translate 代理部署指南（已归档 / 可选方案）

## 概述

本指南已归档。默认推荐在 MV3 背景页直接使用标准 `fetch` 直连供应商 API（项目已具备 `host_permissions` 与 DNR 规则）。仅当企业/网络策略阻拦直连时，才建议启用本代理方案。

## 问题背景

Chrome 扩展 MV3 在 Service Worker 中无法直接访问第三方 API，因为：
1. 浏览器 CORS 策略阻止预检请求
2. `declarativeNetRequest` 无法修改预检请求
3. 直接暴露 API 密钥存在安全风险

## 解决方案

通过 Cloudflare Worker 提供代理服务：
- ✅ 解决 CORS 限制
- ✅ 保护 API 密钥安全
- ✅ 提供速率限制
- ✅ 边缘部署，低延迟

## 部署步骤

### 1. 准备工作

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login
```

### 2. 配置环境变量

```bash
# 设置您的 API 密钥（请替换为您自己的密钥，不要写入文件）
export DASHSCOPE_API_KEY=your-real-dashscope-key
```

### 3. 部署代理

```bash
# 进入代理目录
cd proxy

# 运行部署脚本
./deploy.sh
```

### 4. 配置扩展

部署完成后，在扩展配置中设置：

- **模型**: `qwen-mt-turbo`
- **API Base URL**: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **代理基址**: `https://mini-translate-proxy.your-subdomain.workers.dev/compatible-mode/v1`
- **API Key**: 留空（由代理服务端注入）

### 5. 测试连接

点击"测试"按钮验证配置是否正确。

## 代理功能特性

### 安全特性
- API 密钥服务端注入，客户端不暴露
- 速率限制：每分钟最多 30 次请求
- 路径限制：仅允许 `/compatible-mode/v1/*` 路径
- 脱敏日志：不记录敏感信息

### 性能特性
- 边缘部署，全球低延迟
- 自动重试机制
- 响应缓存优化

### 监控特性
- 实时日志查看：`wrangler tail`
- 分析数据：`wrangler analytics`
- 错误追踪和告警

## 故障排除

### 常见问题

1. **CORS 错误**
   - 确保代理正确返回 CORS 头
   - 检查代理 URL 配置是否正确

2. **速率限制**
   - 检查请求频率是否超限
   - 查看响应头中的限制信息

3. **API 错误**
   - 检查 API 密钥是否有效
   - 验证供应商 API 配额

### 调试方法

```bash
# 查看实时日志
wrangler tail

# 本地测试代理
node proxy/test-local.js

# 检查扩展配置
# 在扩展选项页面查看配置是否正确
```

## 扩展配置

### 支持多供应商

如需支持其他供应商，修改 `proxy/worker.js`：

```javascript
const PROVIDERS = {
  'dashscope.aliyuncs.com': {
    apiKey: 'your-dashscope-key',
    baseUrl: 'https://dashscope.aliyuncs.com'
  },
  'api.openai.com': {
    apiKey: 'your-openai-key', 
    baseUrl: 'https://api.openai.com'
  }
};
```

### 自定义域名

在 `proxy/wrangler.toml` 中配置自定义域名：

```toml
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

## 成本估算

### Cloudflare Worker
- 免费额度：每月 100,000 次请求
- 超出部分：$0.50/百万次请求
- 对于个人使用，通常不会超出免费额度

### 带宽成本
- 免费额度：每月 100GB
- 超出部分：$0.09/GB
- 翻译请求通常很小，成本极低

## 安全建议

1. **定期轮换 API 密钥**
2. **监控异常请求模式**
3. **设置适当的速率限制**
4. **启用 Cloudflare 安全功能**

## 支持

如遇到问题，请：
1. 查看 [故障排除](#故障排除) 部分
2. 检查 Cloudflare Worker 日志
3. 提交 Issue 到项目仓库

---

**注意**: 请妥善保管您的 API 密钥，不要在公共场合暴露。


