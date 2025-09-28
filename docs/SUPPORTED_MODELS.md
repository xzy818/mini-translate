# 支持的 AI 模型列表

## 概述

本插件支持 5 大主流 AI 服务商，共 25+ 个模型，通过两级选择（提供商 → 模型）进行配置。

## 1. OpenAI

**服务商**: OpenAI  
**域名**: api.openai.com  
**认证方式**: Bearer Token  

### 支持的模型

| 模型名称 | 模型 ID | 描述 | 推荐用途 |
|---------|---------|------|----------|
| GPT-4o | gpt-4o | 最新多模态模型 | 复杂翻译任务 |
| GPT-4o Mini | gpt-4o-mini | 轻量级 GPT-4o | 日常翻译 |
| GPT-4 Turbo | gpt-4-turbo | 高性能 GPT-4 | 专业翻译 |
| GPT-4 | gpt-4 | 经典 GPT-4 | 高质量翻译 |
| GPT-3.5 Turbo | gpt-3.5-turbo | 经济型模型 | 快速翻译 |
| GPT-3.5 Turbo 16K | gpt-3.5-turbo-16k | 长文本模型 | 长文档翻译 |

### 获取 API Key
- 访问: https://platform.openai.com/api-keys
- 需要: OpenAI 账户和付费计划

## 2. Anthropic

**服务商**: Anthropic  
**域名**: api.anthropic.com  
**认证方式**: x-api-key  

### 支持的模型

| 模型名称 | 模型 ID | 描述 | 推荐用途 |
|---------|---------|------|----------|
| Claude 3.5 Sonnet | claude-3-5-sonnet-20241022 | 最新最强模型 | 复杂翻译任务 |
| Claude 3.5 Haiku | claude-3-5-haiku-20241022 | 轻量级模型 | 快速翻译 |
| Claude 3 Opus | claude-3-opus-20240229 | 高性能模型 | 专业翻译 |
| Claude 3 Sonnet | claude-3-sonnet-20240229 | 平衡型模型 | 日常翻译 |
| Claude 3 Haiku | claude-3-haiku-20240307 | 经济型模型 | 批量翻译 |

### 获取 API Key
- 访问: https://console.anthropic.com/
- 需要: Anthropic 账户

## 3. Google Gemini

**服务商**: Google  
**域名**: generativelanguage.googleapis.com  
**认证方式**: Bearer Token  

### 支持的模型

| 模型名称 | 模型 ID | 描述 | 推荐用途 |
|---------|---------|------|----------|
| Gemini 1.5 Pro | gemini-1.5-pro | 最新专业模型 | 复杂翻译任务 |
| Gemini 1.5 Flash | gemini-1.5-flash | 快速响应模型 | 实时翻译 |
| Gemini 1.5 Flash 8B | gemini-1.5-flash-8b | 轻量级模型 | 快速翻译 |
| Gemini 1.0 Pro | gemini-1.0-pro | 经典专业模型 | 高质量翻译 |
| Gemini Pro | gemini-pro | 通用模型 | 日常翻译 |

### 获取 API Key
- 访问: https://makersuite.google.com/app/apikey
- 需要: Google 账户

## 4. DeepSeek

**服务商**: DeepSeek  
**域名**: api.deepseek.com  
**认证方式**: Bearer Token  

### 支持的模型

| 模型名称 | 模型 ID | 描述 | 推荐用途 |
|---------|---------|------|----------|
| DeepSeek Chat | deepseek-chat | 通用对话模型 | 日常翻译 |
| DeepSeek Coder | deepseek-coder | 代码专用模型 | 技术文档翻译 |
| DeepSeek Chat 32K | deepseek-chat-32k | 长文本模型 | 长文档翻译 |
| DeepSeek Coder 33B | deepseek-coder-33b-instruct | 大型代码模型 | 复杂技术翻译 |

### 获取 API Key
- 访问: https://platform.deepseek.com/api_keys
- 需要: DeepSeek 账户

## 5. Qwen (通义千问)

**服务商**: 阿里云  
**域名**: dashscope.aliyuncs.com  
**认证方式**: Bearer Token  

### 支持的模型

| 模型名称 | 模型 ID | 描述 | 推荐用途 |
|---------|---------|------|----------|
| Qwen Turbo | qwen-turbo | 快速响应模型 | 实时翻译 |
| Qwen Plus | qwen-plus | 平衡型模型 | 日常翻译 |
| Qwen Max | qwen-max | 最强性能模型 | 复杂翻译任务 |
| Qwen Long | qwen-long | 长文本模型 | 长文档翻译 |
| Qwen 2.5 72B | qwen-2.5-72b-instruct | 大型模型 | 专业翻译 |
| Qwen 2.5 32B | qwen-2.5-32b-instruct | 中型模型 | 高质量翻译 |

### 获取 API Key
- 访问: https://dashscope.console.aliyun.com/apiKey
- 需要: 阿里云账户

## 配置流程

### 1. 选择服务商
- 在配置界面选择 AI 服务商
- 系统自动显示对应的 API 域名
- 无需手动输入 URL

### 2. 选择模型
- 根据选择的服务商显示可用模型
- 每个模型都有详细的性能描述
- 支持实时切换模型

### 3. 输入 API Key
- 输入对应服务商的 API Key
- 支持测试连接功能
- 自动保存配置

## 性能对比

### 响应速度
1. **最快**: GPT-3.5 Turbo, Gemini Flash, Qwen Turbo
2. **中等**: GPT-4o Mini, Claude Haiku, DeepSeek Chat
3. **较慢**: GPT-4, Claude Sonnet, Qwen Max

### 翻译质量
1. **最高**: GPT-4o, Claude 3.5 Sonnet, Qwen Max
2. **高**: GPT-4, Claude 3 Opus, Gemini 1.5 Pro
3. **良好**: GPT-3.5 Turbo, Claude Haiku, Qwen Plus

### 成本效益
1. **最经济**: GPT-3.5 Turbo, Qwen Turbo, DeepSeek Chat
2. **平衡**: GPT-4o Mini, Claude Haiku, Gemini Flash
3. **高端**: GPT-4, Claude Sonnet, Qwen Max

## 使用建议

### 日常使用
- **推荐**: GPT-4o Mini, Claude 3.5 Haiku, Gemini 1.5 Flash
- **特点**: 速度快，质量好，成本低

### 专业翻译
- **推荐**: GPT-4o, Claude 3.5 Sonnet, Qwen Max
- **特点**: 质量最高，适合专业文档

### 批量处理
- **推荐**: GPT-3.5 Turbo, Qwen Turbo, DeepSeek Chat
- **特点**: 成本低，适合大量翻译

### 长文档翻译
- **推荐**: GPT-3.5 Turbo 16K, DeepSeek Chat 32K, Qwen Long
- **特点**: 支持长文本，上下文理解好

## 注意事项

1. **API Key 安全**: 请妥善保管 API Key，不要在公共场所暴露
2. **使用限制**: 各服务商都有使用限制，请注意配额
3. **网络要求**: 需要稳定的网络连接访问各服务商 API
4. **成本控制**: 不同模型的价格差异较大，请根据需求选择
5. **隐私保护**: 所有翻译请求都通过 Service Worker 处理，确保数据安全
