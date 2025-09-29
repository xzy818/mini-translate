# Story S11 开发任务清单

## 🎯 开发目标
实现 QA 扩展消息增强功能，为 MCP 自动化提供可编排的 QA 指令。

## 📋 开发任务

### Phase 1: Background 层 QA 消息处理
- [ ] 实现 QA_APPLY_TERM 消息处理逻辑
- [ ] 实现 QA_REMOVE_TERM 消息处理逻辑  
- [ ] 实现 QA_QUERY_TERM 消息处理逻辑
- [ ] 实现 QA_RESET_WORKER 消息处理逻辑
- [ ] 添加 tabId 解析与错误处理
- [ ] 添加 QA build 条件控制 (MT_QA_HOOKS)

### Phase 2: 内容脚本 QA Bridge
- [ ] 更新 qa-bridge.js 暴露 window.__miniTranslateQA API
- [ ] 实现 applyTerm/removeTerm/queryTerm/resetWorker 方法
- [ ] 添加 tabId 自动获取机制
- [ ] 实现消息传递错误处理

### Phase 3: MCP 批处理集成
- [ ] 更新 smoke.template.json 添加 QA 消息步骤
- [ ] 更新 storage.template.json 添加 Service Worker 重启验证
- [ ] 更新 MCP 工具函数支持新消息类型
- [ ] 添加 Example Domain 翻译断言

### Phase 4: 测试覆盖
- [ ] 单元测试：QA handler 分支覆盖
- [ ] 集成测试：API 暴露与消息传递
- [ ] E2E 测试：MCP 自动化完整流程
- [ ] 文档更新：测试计划与 QA Results

## 🧪 测试验证
- [ ] 运行 npm run validate
- [ ] 执行 MCP 自动化测试
- [ ] 验证 QA Hook 仅在 QA build 中注册
- [ ] 确认所有验收标准达成

## 📚 文档更新
- [ ] 更新 Story S11 QA Results
- [ ] 更新 release-checklist.md
- [ ] 更新 MCP 测试计划
- [ ] 记录执行证据和截图
