# 翻译失败诊断自动化测试方案

## 概述

本方案提供了完整的自动化测试框架，用于诊断和定位翻译失败的根本原因。支持三个核心场景：网页翻译、生词表翻译、配置管理测试翻译。

## 特性

- 🔒 **安全 Key 处理**：支持临时真实 Key 测试，但绝不保存到任何文件或日志
- 🎯 **精确根因定位**：自动分析配置、认证、限流、网络、模型等各类错误
- 📊 **详细测试报告**：生成包含根因分析和修复建议的完整报告
- 🧪 **真实 API 测试**：支持使用真实 API Key 进行端到端测试
- 🔍 **日志安全验证**：确保所有日志输出都经过 Key 掩码处理

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行基础测试（无需真实 Key）

```bash
# 运行所有诊断测试
npm run test:diagnosis

# 运行特定场景测试
npm run test:diagnosis:pattern "网页翻译失败诊断"
npm run test:diagnosis:pattern "生词表重新翻译失败诊断"
npm run test:diagnosis:pattern "配置管理测试翻译诊断"
```

### 3. 运行真实 API 测试（可选）

```bash
# 设置环境变量（临时，测试后自动清除）
export TEST_DEEPSEEK_KEY="your-deepseek-key"
export TEST_OPENAI_KEY="your-openai-key"
export TEST_QWEN_KEY="your-qwen-key"

# 运行包含真实 API 的测试
npm run test:diagnosis
```

## 测试场景详解

### 1. 网页翻译失败诊断

**目标**：复现网页翻译时出现"T"占位符的根本原因

**测试内容**：
- 配置验证失败（无效 Key、不支持模型、错误 Base URL）
- API 调用失败（401 认证、429 限流、500 服务器错误、网络超时）
- 词条添加失败时的状态处理
- 真实 API 测试（使用临时 Key）

**关键日志**：
```
[Translator] API error { model, url, statusCode }
[Translator] Translate failed { model, url } Error: ...
```

### 2. 生词表重新翻译失败诊断

**目标**：复现词库管理界面重新翻译功能的失败场景

**测试内容**：
- 重新翻译 API 调用失败
- 词库更新失败
- 存储权限问题
- 真实重试测试

**关键日志**：
```
重新翻译失败: Error: ...
[qa] message received RETRY_TRANSLATION
```

### 3. 配置管理测试翻译诊断

**目标**：复现选项页配置测试功能的失败场景

**测试内容**：
- 配置验证失败
- 模型-URL 映射错误
- 测试 API 调用失败
- 真实配置测试

**关键日志**：
```
[qa:test] validation failed [错误列表]
[qa:test] error/timeout { model, apiBaseUrl } Error: ...
```

## 安全机制

### Key 掩码处理

所有日志输出中的 API Key 都会自动掩码：

```javascript
// 原始 Key: sk-1234567890abcdef
// 日志输出: sk-12***cdef
```

### 临时 Key 管理

```javascript
// 设置临时 Key（仅内存，测试后自动清除）
setTemporaryKey('deepseek', 'your-real-key');

// 获取临时 Key
const key = getTemporaryKey('deepseek');

// 测试后自动清除
clearTemporaryKeys();
```

### 环境变量安全

- 测试脚本运行前设置临时环境变量
- 测试完成后自动清理所有环境变量
- 不在任何文件中保存真实 Key

## 测试报告

### 自动生成报告

测试完成后会自动生成详细报告：

```json
{
  "summary": {
    "total": 15,
    "passed": 12,
    "failed": 3,
    "skipped": 0,
    "duration": "2.5s"
  },
  "rootCauseSummary": {
    "config": {
      "category": "配置问题",
      "count": 2,
      "avgConfidence": 85
    },
    "auth": {
      "category": "认证失败", 
      "count": 1,
      "avgConfidence": 95
    }
  },
  "recommendations": [
    "检查 API Key 是否正确设置",
    "验证 API Key 是否有效",
    "确认选择的模型是否支持"
  ]
}
```

### 根因分析

自动分析失败根因并分类：

- **配置问题**：API Key 未配置、模型不支持、Base URL 错误
- **认证失败**：API Key 无效、未授权、权限不足
- **限流/配额**：调用频率超限、配额用尽
- **网络问题**：连接超时、网络错误、服务端 5xx
- **模型问题**：模型不存在、不支持、权限不足

### 修复建议

基于根因分析生成具体修复建议：

```json
{
  "immediate": [
    "检查并修复 API Key 和模型配置",
    "验证 API Key 有效性并更新认证信息"
  ],
  "shortTerm": [
    "实施请求频率限制和重试机制",
    "优化网络配置和超时设置"
  ],
  "longTerm": [
    "建立模型可用性监控和自动切换机制"
  ]
}
```

## 使用示例

### 场景 1：诊断网页翻译显示"T"问题

```bash
# 1. 运行诊断测试
npm run test:diagnosis:pattern "网页翻译失败诊断"

# 2. 查看报告
cat test-reports/translation-diagnosis-report.json

# 3. 根据根因分析修复问题
# 例如：配置问题 -> 检查 API Key 设置
# 例如：认证失败 -> 验证 Key 有效性
```

### 场景 2：使用真实 Key 验证修复效果

```bash
# 1. 设置真实 Key
export TEST_DEEPSEEK_KEY="sk-your-real-key"

# 2. 运行真实 API 测试
npm run test:diagnosis

# 3. 验证翻译是否成功（不再显示"T"）
```

### 场景 3：批量测试多个服务商

```bash
# 设置多个服务商的 Key
export TEST_DEEPSEEK_KEY="sk-deepseek-key"
export TEST_OPENAI_KEY="sk-openai-key" 
export TEST_QWEN_KEY="sk-qwen-key"

# 运行完整测试套件
npm run test:diagnosis:coverage
```

## 故障排除

### 常见问题

1. **测试跳过真实 API 测试**
   - 原因：未设置环境变量或 Key 格式无效
   - 解决：检查环境变量设置和 Key 格式

2. **测试超时**
   - 原因：网络问题或 API 响应慢
   - 解决：增加超时时间或检查网络连接

3. **Key 泄露到日志**
   - 原因：测试代码未使用掩码函数
   - 解决：确保使用 `maskKey()` 函数处理所有 Key 输出

### 调试技巧

1. **查看详细日志**：
   ```bash
   npm run test:diagnosis 2>&1 | tee test.log
   ```

2. **单独运行失败测试**：
   ```bash
   npm test -- --run "特定测试名称"
   ```

3. **生成覆盖率报告**：
   ```bash
   npm run test:diagnosis:coverage
   ```

## 贡献指南

### 添加新的测试场景

1. 在 `tests/` 目录下创建新的测试文件
2. 使用 `setup-translation-diagnosis.js` 提供的安全工具
3. 确保所有 Key 都经过掩码处理
4. 添加相应的根因分析模式

### 扩展根因分析

1. 在 `TranslationFailureAnalyzer` 中添加新的错误模式
2. 更新解决方案建议
3. 测试新的分析逻辑

## 注意事项

- ⚠️ **绝不提交真实 API Key 到代码仓库**
- ⚠️ **测试完成后自动清理所有临时 Key**
- ⚠️ **所有日志输出都经过 Key 掩码处理**
- ⚠️ **真实 API 测试可能产生费用，请谨慎使用**

## 技术支持

如有问题，请查看：
1. 测试报告中的根因分析
2. 控制台输出的详细错误信息
3. 网络面板中的 API 请求/响应
4. 后台 Service Worker 的日志输出



