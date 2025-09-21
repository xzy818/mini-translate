# Changelog

All notable changes to this project will be documented in this file.

## [0.2.3] - 2025-01-18

### 🐛 Bug Fixes
- **修复Qwen API兼容性问题**
  - 修复API URL路径重复拼接问题（DashScope兼容模式）
  - 移除Qwen API不支持的system角色
  - 添加智能URL处理，支持不同API提供商的URL格式
  - 将system提示合并到user消息中，确保Qwen API兼容性
  - 解决Chrome配置测试失败的根本原因

### 🔧 Technical Changes
- 优化API Base URL处理逻辑
- 统一所有翻译API提供商的URL拼接方式
- 改进Qwen API的消息格式兼容性

### 📋 Impact
- **用户影响**: Chrome配置测试现在可以成功通过
- **开发者影响**: 支持更多API URL格式，提高兼容性
- **兼容性**: 完全向后兼容，不影响现有用户设置

## [0.2.2] - 2025-01-18

### 🐛 Bug Fixes
- **修复Chrome扩展网络权限配置问题**
  - 在 `manifest.json` 中添加了 `host_permissions` 配置
  - 支持所有翻译API提供商：
    - DeepSeek API: `https://api.deepseek.com/*`
    - OpenAI API: `https://api.openai.com/*`
    - 阿里云DashScope: `https://dashscope.aliyuncs.com/*`
  - 解决了Chrome配置测试失败的问题
  - 修复了翻译功能无法正常工作的根本原因

### 🔧 Technical Changes
- 更新了Chrome Manifest V3权限配置
- 确保扩展能够向外部API发送网络请求
- 保持了所有现有功能的完整性

### 📋 Impact
- **用户影响**: 翻译功能现在可以正常工作
- **开发者影响**: 无需额外配置，权限已正确设置
- **兼容性**: 完全向后兼容，不影响现有用户设置

## [0.2.1] - 2025-01-17

### 🐛 Bug Fixes
- 修复右键菜单互斥回归问题
- 统一动态互斥菜单实现
- 同步版本号与打包产物

## [0.2.0] - 2025-01-16

### ✨ Features
- 初始版本发布
- 支持多种翻译模型
- 词库管理功能
- Chrome扩展集成
