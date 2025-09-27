# 右键菜单测试设计分析

## 现有自动化覆盖

文件：`tests/context-menu.test.js`

| 场景 | 描述 | 覆盖状态 |
| --- | --- | --- |
| 新选区 → 添加词条 | 第一次选中未存在于词库的文本时，应展示“add & mini-translate”并在点击后写入词库 | ✅ 单测 `shows add action when selection not in vocabulary`
| 已存在词条 → 移除 | 词库已有条目时应展示“remove from mini-translate”并在点击后移除 | ✅ 单测 `shows remove action when selection exists in vocabulary`
| 无选区／页面开关互斥 | 未选中内容时根据 tab 状态展示 `start/stop mini-translate`，并在点击后刷新状态通知 | ✅ 单测 `shows start/stop based on tab state`
| 无有效 action | 其他异常场景时菜单需隐藏或保持默认 | ✅ 单测 `hides menu when no valid action`

## 差距与补充要求（2025-09 更新）

| 差距 | 说明 | MCP 用例 |
| --- | --- | --- |
| Popup/Options 同步 | 右键菜单仅验证正常路径，缺少对 Popup 统计与 Options 表格同步的检查 | `TC-STAT-006`、`TC-POP-007`
| 词库上限提示 | 当词库满 500 条时应阻止新增并提示 | `TC-CM-101`
| 翻译失败重试 | 翻译 API 失败后应展示 error 状态与重试按钮 | `TC-CM-103`
| 页面翻译回写 | 真实页面翻译与恢复需截图和 DOM 证明 | `TC-TRN-108`
| Service Worker 重启 & 多 Tab | 验证跨标签与 Service Worker 重启后状态是否保持 | `TC-TRN-109`
| QA Toggle 事件 | QA Hook `mt-qa-toggle` 触发应真正影响页面翻译 | `TC-ROB-110`
| 存储可观测性 | 操作后 `chrome.storage.local/session` 应与预期一致 | `TC-OBS-112`

## MCP 自动化测试扩展

1. **添加/移除/启停（基础流）**
   - 使用 QA 面板 (`options.html?qa=1`) 执行 add/remove/toggle。
   - 右键菜单验证后捕获 `test-artifacts/mcp/context-menu/` 下的 DOM Snapshot 与截图。
2. **词库上限测试**
   - 通过批处理预先导入 500 条词条，再次尝试添加 → 断言提示“词库已满”。
   - 验证 Popup/Options 统计保持 500/500。
3. **翻译失败模拟**
   - 设置翻译配置为 `stub://translator/auth-error`。
   - 触发翻译后，右键菜单应显示 error 状态和重试按钮；点击重试后读取日志确认 `[qa:test] error`。
4. **页面翻译与恢复**
   - 在内容页触发 `mt-qa-selection` → 添加词条。
   - 刷新页面，抓取翻译前后 DOM；关闭翻译确认恢复原文。
5. **Service Worker / 多标签**
   - 执行 `chrome.runtime.reload()` 或重启 Service Worker；
   - 打开第二个标签页验证翻译状态同步；
   - 记录 `chrome.storage.session` 中 `miniTranslateTabState` 的持久化结果。

## 结果记录

- 将上述场景纳入 `tests/mcp/batches/context-menu.json` 与 `smoke.json`。
- 执行完毕后在 `test-artifacts/mcp/<timestamp>/` 下保留截图、DOM、日志，以及 `storage/*.json`。
- 在 `docs/qa/story-qa-checklist.md` 的对应复选项打勾并回写 Story QA Results。

## 后续行动

- [ ] 完成词库上限、翻译失败、存储断言等批处理脚本。
- [ ] 在下一次 MCP 执行后更新本文件的“差距与补充要求”状态。
- [ ] 将性能指标（菜单响应 ≤ 500ms）纳入 Trace 收集计划。
