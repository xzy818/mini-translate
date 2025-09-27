# Story S10 — MCP 自动化测试执行

## 背景
为保障每次 Release 的可重复验证，需要将 chrome-devtools-mcp 自动化方案落地为可执行脚本，并在发布流程中固定运行。

## 用户价值
- 发布负责人可一键执行浏览器端到端验证，减少人工冒烟成本。
- QA 可以引用统一日志与截图作为 Release 附证，提升可追溯性。
- 团队可在后续 CI 中扩展不同 Chrome 渠道的冒烟测试矩阵。

## 需求要点
1. 在 `tests/mcp/` 目录编写 batch JSON 或脚本，封装核心场景（扩展加载、Options 配置、Popup 操作、词库导入导出、翻译链路、性能采集）。
2. 提供执行脚本（npm script 或文档说明），允许手工和 CI 调用。
3. 测试输出需保存至 `test-artifacts/mcp/`（或同等目录）并与 Release checklist 关联。
4. README/测试指南新增 MCP 测试章节，引导执行步骤。
5. 在 release 流程中记录执行人、时间和结果。

## 验收标准
- 提供可运行的 `npm run test:mcp` 或等效命令，内部调用 chrome-devtools-mcp 工具链。
- 每个核心场景执行后保存截图/日志/网络记录，存放于指定目录并自动清理旧数据。
- `docs/qa/chrome-devtools-mcp-test-plan.md` 与 README 说明保持一致，首次执行文档化结果。
- Release checklist 的 MCP 条目可填入执行信息，确保流程闭环。
- CI 或手动执行一次示例并附执行说明（若 CI 接入受限，提供手动执行记录）。

## QA Results
- 2025-09-27 — Passed
  - Artifacts: `test-artifacts/mcp/2025-09-27T10-24-40-280Z/summary.json`（batches: context-menu/smoke/storage/uids）、`tests/mcp/batches/*.json`
  - Notes: MacBook 本地运行 `npm run mcp:auto` 完成构建→启动→UID 捕获→批处理→清理；证据包括 DOM 快照、截图、storage 快照；release checklist 已补录执行信息。
