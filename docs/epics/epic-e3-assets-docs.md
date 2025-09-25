# Epic E3 — 资产与文档交付

## 概述
完善插件的标识资产与发布文档，确保最终交付物可直接安装并具备完整说明。

## Stories
- **S7**：蓝色双箭头图标 — 设计白底蓝色双箭头图标并输出各尺寸资源，更新 manifest。
- **S8**：文档与 Release — 补充 README、打包流程，生成可直接安装的 Chrome 扩展包并随 Release 发布。

## 依赖
- PRD：`docs/prd.md`
- 架构：`docs/architecture.md`

## 完成定义
- 图标在所有尺寸下渲染清晰且符合视觉规范。
- Release 包含验证通过的 ZIP 安装包及更新的文档说明。
- QA 检查 Release checklist，确保交付完整。
- 根据 `docs/qa/chrome-devtools-mcp-test-plan.md` 执行并通过自动化测试，产出证据随 Release 存档。
