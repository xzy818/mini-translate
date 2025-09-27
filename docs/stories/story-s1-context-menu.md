# Story S1 — 右键菜单与页面翻译开关

## 背景
用户需要通过右键菜单快速控制翻译流程：在不同上下文中添加/移除词条，以及启动或停止整个页面翻译。

## 用户价值
- 选中原文生词即可即时加入词库并翻译，提升学习效率。
- 对已翻译词条可以回退，维护词库准确性。
- 可以随时开启/关闭页面翻译，保持阅读节奏。

## 需求要点
1. 浏览器右键菜单只暴露一条可见入口（Chrome 会自动以插件名分组），根据场景动态展示互斥动作。
2. 原文选中且未翻译 → 菜单显示 `add & mini-translate`，执行添加并翻译。
3. 已翻译选中 → 菜单显示 `remove from mini-translate`，执行移除并恢复原文。
4. 未选中文本（默认场景） → 菜单显示 `start mini-translate` 或 `stop mini-translate`，根据当前 tab 状态互斥切换，默认首次为 `start`。
5. Background 维护 `tab` 翻译状态；Content script 根据命令批量翻译或恢复。
6. 菜单更新需≤500ms，操作反馈清晰。

## 验收标准
- 三种场景下菜单项正确展示且逻辑互斥。
- 添加后页面对应词条立即翻译；移除后恢复原文。
- 页面翻译开关可重复开启/关闭，并确保状态持久至标签关闭。
- QA 覆盖主流程与异常场景（API 失败、无选区等）。

## QA Results
- Gate: PASS — 导入的右键菜单逻辑支持添加、移除与页面级开关，词库/翻译事件与 content script 联动正常。
- Tests: `npm run validate`
- Notes: 自动化覆盖词库上限、菜单增删、翻译开启/关闭；需在浏览器环境验证通知展示与实际 API 调用。
- MCP: 2025-09-27 — chrome MCP 自动化覆盖 add/remove/启停路径，证据见 `test-artifacts/mcp/2025-09-27T10-24-40-280Z/context-menu/context-menu.json.log` 与截图 `.../context-menu/context-menu/context-menu-scenes.png`。

### Review Date: 2025-09-19

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment
- ✅ 已实现单一菜单入口与互斥场景切换，`resolveMenuContext`/`menuState` 逻辑清晰。
- ⚠️ `resolveMenuContext` 每次读取全量词库与 tab 状态，500 词库规模下是否能在 500ms 内刷新仍需验证。
- ⚠️ `onShown` → `onClicked` 之间依赖异步缓存，缺少防抖/过期控制，快速点击可能执行旧动作。

### Test Coverage Review
- 自动化：`tests/context-menu.test.js` 覆盖 add/remove/start/stop 场景，单测结果通过。
- 覆盖缺口：缺少真实 Chrome 环境下的端到端验证（Scenario E1.S1-E2E-001/E1.S1-E2E-002），尚未补充 QA 记录。

### NFR & Risk Notes
- 性能：高词库体量下的菜单响应需实测（NFR 状态 CONCERNS）。
- 可靠性：竞态风险未被测试覆盖，建议在 release 验证中重点观察。

### Issues & Recommendations
1. **执行手动 E2E 验证**：按照 Test Design 场景运行真实浏览器测试，记录响应时间、浏览器版本，并更新 Issue #21 与 QA 文档。（Owner: QA）
2. **确认/优化缓存策略**：评估是否需要在 background 中缓存词库或限制 onShown 调用频率，至少提供性能数据支撑。（Owner: Dev）

### Gate Recommendation
- 建议 Gate 结果：`CONCERNS`，待补充端到端验证数据与性能证据后再考虑通过。
