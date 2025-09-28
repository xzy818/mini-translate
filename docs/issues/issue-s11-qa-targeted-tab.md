# Issue: 扩展 QA 消息增强 (Story S11)

- **Story**: `docs/stories/story-s11-qa-targeted-tab.md`
- **Epic**: `docs/epics/epic-e3-assets-docs.md`
- **Owner**: 待指派（建议 QA 自动化负责人）
- **优先级**: 高
- **里程碑**: M4 — 发布资产与文档

## 背景
MCP 自动化正在推进 Example 页面翻译回写与 Service Worker 重启验证，但当前扩展缺少可定向 tab 的 QA 消息，导致自动化无法稳定驱动翻译与回滚。需要新增针对 tab 的 QA API 以及 Service Worker 重启控制，以满足端到端测试场景。

## TODO
- [ ] 在 background 层新增 QA_APPLY_TERM/QA_REMOVE_TERM/QA_QUERY_TERM/QA_RESET_WORKER 消息并支持 tabId.
- [ ] 更新内容脚本与 qa-bridge，暴露 apply/remove/reset/query API 到 `window.__miniTranslateQA`。
- [ ] 为 QA handler 与桥接逻辑补充单元测试。
- [ ] 调整 MCP 批处理（smoke/storage）调用新消息，完成 Example Domain 翻译与 Service Worker 重启校验。
- [ ] 更新 `docs/qa/chrome-devtools-mcp-test-plan.md` 与 Story S10/S11 QA Results，记录执行证据。

## 参考
- `docs/qa/mcp-qa-targeted-tab-design.md`
- `tests/mcp/batches/smoke.template.json`
- `tests/mcp/batches/storage.template.json`

## 附注
- 所有 QA Hook 需受 `MT_QA_HOOKS` 控制，避免影响正式构建。
- 自动化若仍遇到 message port closed，请记录 tabId 与消息上下文并回报。
