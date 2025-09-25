# 右键菜单测试设计分析

## 现有自动化覆盖

文件：`tests/context-menu.test.js`

| 场景 | 描述 | 覆盖状态 |
| --- | --- | --- |
| 新选区 → 添加词条 | 第一次选中未存在于词库的文本时，应展示“add & mini-translate”并在点击后写入词库 | ✅ 自动化单测 `shows add action when selection not in vocabulary`
| 已存在词条 → 移除 | 词库已有条目时应展示“remove from mini-translate”并在点击后移除 | ✅ 自动化单测 `shows remove action when selection exists in vocabulary`
| 无选区／页面开关互斥 | 未选中内容时根据 tab 状态展示 `start/stop mini-translate`，并在点击后刷新状态通知 | ✅ 自动化单测 `shows start/stop based on tab state`
| 无有效 action | 其他异常场景时菜单需隐藏或保持默认 | ✅ 自动化单测 `hides menu when no valid action`

## 差距与补充建议

1. **实机验证缺失**：当前仅在 Vitest stub 环境中验证逻辑，缺少基于 chrome-devtools-mcp 的端到端场景，无法确认 Service Worker/Content Script 真正协同（如 DOM 注入、通知、翻译 API 调用）。
   - 建议在 MCP 批处理计划中补充：
     - `TC-CM-101`：在真实页面选词，验证“add & mini-translate”实际添加词条且页面出现翻译标记。
     - `TC-CM-102`：对已翻译词触发 remove，确认原文恢复。
     - `TC-CM-103`：无选区时多次触发 start/stop，校验通知与 tab 状态。
2. **性能指标缺口**：需求要求右键菜单响应 ≤500ms，当前单测未覆盖此非功能指标。
   - 建议计划在 MCP 测试或手动测试中记录 `contextMenus.update` 响应时间（可通过 DevTools Performance 或脚本测量）。
3. **多窗口/多 tab 交互**：单测仅验证单个 tab 的状态，需在端到端测试中覆盖跨 tab 切换（start 在一个 tab 开启后，其他 tab 的菜单状态）。
4. **异常路径**：单测覆盖 `chrome.runtime.lastError` 等错误路径有限，建议增加：
   - 词库超限时菜单行为
   - 翻译 API 失败时的通知

## 结论
三种核心上下文菜单切换场景（添加/移除/启动-停止）在单元测试层已经覆盖，但要满足 Story S1 的设计目标，仍需：
- 将上述场景纳入 MCP 自动化脚本，实现真实浏览器端到端验证。
- 补充性能与多 tab 行为验证。
- 对异常场景制定额外用例。

建议将新增用例纳入 `tests/mcp/` 计划，并在 release checklist 中记录执行证据。

## MCP 自动化用例草案
- `tests/mcp/batches/context-menu.json` — 新增三大场景脚本骨架，含 `<EXTENSION_ID>` 与 `@uid:*` 等占位符；需要在首轮执行时通过 `take_snapshot` 或扩展内 QA Hook（如监听 `mt-qa-selection`/`mt-qa-remove` 事件）替换为真实值。
- 执行后请将截图（`context-menu-scenes.png`）、DOM 快照等输出写入 `test-artifacts/mcp/` 并在 Release Checklist 的 MCP 条目登记执行人/时间。
- 待完成事项：
  - [ ] 补齐 add/remove/start-stop 三个步骤的实际自动化交互实现。
  - [ ] 扩展 QA Hook，实现从页面注入事件驱动 Service Worker 逻辑。
  - [ ] 在 `npm run test:mcp` 中串联 context-menu 与 smoke 场景，形成完整发布前冒烟。
