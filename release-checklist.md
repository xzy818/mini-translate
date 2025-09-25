# Release Checklist - Mini Translate v0.2.1

## 📋 Story 验收状态

### Story S1: 右键菜单与页面翻译开关
- [x] **需求实现**: 三种右键菜单场景已实现
  - [x] 原文选中 → `add & mini-translate`
  - [x] 已翻译选中 → `remove from mini-translate`  
  - [x] 任意位置 → `start/stop mini-translate`
- [x] **技术实现**: Background/Content script 架构
- [x] **性能要求**: 菜单响应 ≤500ms
- [x] **状态管理**: Tab 翻译状态持久化
- [x] **测试覆盖**: 22 个测试用例，100% 核心服务覆盖

### Story S2: 词库存储与限制
- [x] **存储实现**: chrome.storage.local 集成
- [x] **数据模型**: 符合 vocabulary-spec.md schema
- [x] **CRUD 操作**: 完整的增删改查功能
- [x] **上限控制**: 500 条限制严格执行
- [x] **去重策略**: 基于 term 字段的智能去重
- [x] **事件通知**: VOCAB_UPDATED 事件机制
- [x] **测试覆盖**: 边界情况和错误处理

### Story S3: 翻译服务抽象
- [x] **统一接口**: `translateText` 支持 DeepSeek V3/Qwen MT Turbo/Plus/GPT-4o-mini
- [x] **错误处理**: 标准化错误（API/网络/超时/配置）
- [x] **鲁棒性**: 超时控制与有限重试（2 次）
- [x] **测试覆盖**: 24 个测试用例全部通过
- [x] **质量门**: Gate PASS（docs/qa/gates/e1.s3-translation-service.yml）

## 🔧 技术质量指标

### 代码质量
- [x] **静态检查**: ESLint 通过（9 个警告，非阻塞）
- [x] **代码规范**: ES2022 标准，Chrome 扩展兼容
- [x] **架构设计**: 模块化，职责分离清晰

### 测试质量
- [x] **单元测试**: 46/46 通过
- [x] **测试覆盖**: 核心服务 100% 覆盖
- [x] **边界测试**: 错误处理、空值、特殊字符
- [x] **集成测试**: Manifest 验证、组件协作

### CI/CD 质量
- [x] **自动化流水线**: GitHub Actions 配置完成
- [x] **多版本测试**: Node.js 18/20/21 矩阵
- [x] **质量门禁**: 静态检查 + 测试 + 构建验证
- [x] **PR 检查**: 自动质量评估和评论

## 📦 发布准备

### Chrome 扩展配置
- [x] **Manifest V3**: 符合最新标准
- [x] **权限配置**: contextMenus, storage, scripting, activeTab
- [x] **图标资源**: 16/32/48/128 尺寸准备就绪
- [x] **内容脚本**: 全 URL 匹配，document_idle 注入

### 文档完整性
- [x] **README**: 完整的安装和使用指南
- [x] **API 文档**: 核心服务函数文档
- [x] **开发指南**: CI/CD 流程和贡献规范
- [x] **架构文档**: 技术架构和设计决策

### 发布流程
- [x] **版本管理**: 语义化版本控制（v0.2.2 修复Chrome扩展网络权限配置）
- [x] **发布脚本**: 自动化打包和发布
- [x] **质量检查**: 发布前完整验证
- [x] **回滚计划**: 版本回退机制
- [ ] **MCP 自动化测试**: 按 `docs/qa/chrome-devtools-mcp-test-plan.md` 执行并记录日志/截图（执行人/时间）

## ⚠️ 已知限制

### 当前版本限制
- 暂无阻塞性缺口；建议在正式发布前于真实 Chrome 环境复核通知授权、超大文件导入及翻译 API 配额。

### 风险缓解
- [x] **核心逻辑**: 全量单测与集成测试通过
- [x] **架构设计**: Background/Content/Options 三层联动已验证
- [x] **扩展性**: Storage 与翻译层均模块化，可继续扩展
- [x] **质量保证**: CI `npm run validate` 持续守护

## 🎯 发布决策

### 建议发布状态: ✅ **READY FOR MVP RELEASE**

**理由**:
1. **核心架构**: 完整且经过测试验证
2. **质量保证**: 通过所有质量门禁
3. **扩展性**: 为后续功能开发奠定基础
4. **文档完整**: 提供完整的开发和部署指南

### 发布策略
- **版本**: v0.2.2
- **范围**: 修复Chrome扩展网络权限配置，支持翻译API调用
- **目标**: 解决Chrome配置测试失败问题，确保翻译功能正常工作
- **后续**: 发布后在真实Chrome中验证翻译功能，并监控API调用成功率
