# Mini Translate API Proxy

Chrome扩展MV3的API代理服务，解决CORS限制问题。

## 功能特性

- ✅ 解决Chrome扩展MV3的CORS预检限制
- ✅ 统一API代理，支持多供应商
- ✅ 速率限制，防止滥用
- ✅ 脱敏日志，保护隐私
- ✅ 边缘部署，低延迟

## 部署步骤

### 1. 安装Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录Cloudflare

```bash
wrangler login
```

### 3. 配置环境变量

```bash
# 设置API密钥（请键入真实密钥；不要将密钥写入任何文件）
wrangler secret put DASHSCOPE_API_KEY
# 输入: your-real-dashscope-key
```

### 4. 部署到生产环境

```bash
wrangler deploy --env production
```

### 5. 部署到测试环境

```bash
wrangler deploy --env staging
```

## 使用方式

代理部署后，扩展端配置：

- **API Base URL**: `https://your-worker.your-subdomain.workers.dev/compatible-mode/v1`
- **API Key**: 留空（由代理服务端注入）

## 安全特性

- 速率限制：每分钟最多30次请求
- 路径限制：仅允许 `/compatible-mode/v1/*` 路径
- 脱敏日志：不记录敏感信息
- CORS控制：仅允许必要的方法和头部

## 监控与日志

```bash
# 查看实时日志
wrangler tail

# 查看分析数据
wrangler analytics
```

## 故障排除

1. **CORS错误**: 确保代理正确返回CORS头
2. **速率限制**: 检查请求频率是否超限
3. **API错误**: 检查供应商API密钥和配额

## 扩展配置

如需支持其他供应商，修改 `worker.js` 中的 `PROVIDERS` 配置：

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
