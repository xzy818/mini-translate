# Issue: 落地 MCP 自动化测试（Story S10）

- **Story**: `docs/stories/story-s10-mcp-automation.md`
- **Epic**: `docs/epics/epic-e3-assets-docs.md`
- **Owner**: 待指派（建议 QA / Release 工程负责人）
- **优先级**: 高（每次 Release 必备）
- **里程碑**: M4 — 发布资产与文档

## 背景
为满足 PRD 第 4.5 节新增的可测试性要求，需实现 chrome-devtools-mcp 自动化脚本，确保发布前能重复执行端到端验证并保留证据。

## TODO
- [ ] 在 `tests/mcp/` 中创建脚本（batch JSON 或 CLI）覆盖 test plan 核心场景。
- [ ] 新增 `npm run test:mcp`（或等效命令）并在 README/测试指南说明。
- [ ] 构建输出目录 `test-artifacts/mcp/`，保存截图/日志/网络记录。
- [ ] 首次执行并在 `release-checklist.md` MCP 条目给出示例记录。
- [ ] 评估在 CI 中运行冒烟场景的可行性，并记录结果。

## 参考
- `docs/qa/chrome-devtools-mcp-test-plan.md`
- `release-checklist.md`
- Story S8 QA Gate: `docs/qa/gates/e3.s8-release-docs.yml`

## 附注
- 若受限于环境沙箱，请在 issue 中记录解决方案（如手动启动 Chrome + `--browserUrl`）。
- 执行完成后，请更新 Story S10 的 QA Results、关闭本 issue，并在 Release 记录中附证。
