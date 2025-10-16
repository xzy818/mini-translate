# Epic E1 — mini-translate 核心能力

## 概述
实现插件最核心的上下文翻译体验：动态右键菜单、词库 CRUD 与翻译服务抽象，确保用户在网页场景中顺畅地收集并翻译生词。

## Stories
- **S1**：右键菜单即时翻译 — 构建选区驱动的菜单逻辑，支持添加/移除词条并保持页面同步。
- **S2**：词库存储与限制 — 定义并实现词库 schema、CRUD 接口与 500 条上限控制。
- **S3**：翻译服务抽象 — 接入 DeepSeek V3、Qwen MT Turbo/Plus、gpt-4o-mini，并提供统一调用层。

## 依赖
- 架构文档：`docs/architecture.md`
- 词库规范：`docs/references/vocabulary-spec.md`

## 完成定义
- 所有故事验收标准满足并通过 QA 检查。
- 右键菜单仅在选区场景出现，执行后页面翻译状态即时更新。
- 翻译服务在四种模型下均可调用并反馈错误信息。
