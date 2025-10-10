# Story S1 — 右键菜单即时翻译动作

## 背景
用户需要通过右键菜单快速控制翻译流程：在不同上下文中添加或移除词条。页面级启停在实践中对用户缺乏价值，因此取消。

## 用户价值
- 选中原文生词即可即时加入词库并翻译，提升学习效率。
- 对已翻译词条可以回退，维护词库准确性。

## 需求要点
1. 浏览器右键菜单只暴露一条可见入口（Chrome 会自动以插件名分组），根据场景动态展示互斥动作。
2. 原文选中且未翻译 → 菜单显示 `add & mini-translate`，执行添加并翻译。
3. 已翻译选中 → 菜单显示 `remove from mini-translate`，执行移除并恢复原文。
4. 未选中文本时隐藏扩展菜单，减少干扰。
5. 菜单更新需≤500ms，操作反馈清晰。

## 验收标准
- 选中/未选中场景下菜单项展示符合预期，逻辑互斥。
- 添加后页面对应词条立即翻译；移除后恢复原文。
- QA 覆盖主流程与异常场景（API 失败、无选区等）。

## QA Results
- Gate: PASS — 右键菜单在选中场景下支持添加/移除词条，默认隐藏状态下无多余入口，词库/翻译事件与 content script 联动正常。
- Tests: `npm run validate`
- Notes: 自动化覆盖词库上限与菜单增删；需在浏览器环境验证通知展示与实际 API 调用。
- Chrome: 2025-09-27 — chrome 自动化覆盖 add/remove 路径，证据见 `test-artifacts/chrome/2025-09-27T10-24-40-280Z/context-menu/context-menu.json.log` 与截图 `.../context-menu/context-menu/context-menu-scenes.png`。

### Review Date: 2025-09-19

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment
- ✅ 已实现单一菜单入口与互斥场景切换，`resolveMenuContext`/`menuState` 逻辑清晰。
- ⚠️ `resolveMenuContext` 每次读取全量词库，500 词库规模下是否能在 500ms 内刷新仍需验证。
- ⚠️ `onShown` → `onClicked` 之间依赖异步缓存，缺少防抖/过期控制，快速点击可能执行旧动作。

- 自动化：`tests/context-menu.test.js` 覆盖 add/remove 场景，单测结果通过。
- 覆盖缺口：缺少真实 Chrome 环境下的端到端验证（Scenario E1.S1-E2E-001/E1.S1-E2E-002），尚未补充 QA 记录。

### NFR & Risk Notes
- 性能：高词库体量下的菜单响应需实测（NFR 状态 CONCERNS）。
- 可靠性：竞态风险未被测试覆盖，建议在 release 验证中重点观察。

### Issues & Recommendations
1. **执行手动 E2E 验证**：按照 Test Design 场景运行真实浏览器测试，记录响应时间、浏览器版本，并更新 Issue #21 与 QA 文档。（Owner: QA）
2. **确认/优化缓存策略**：评估是否需要在 background 中缓存词库或限制 onShown 调用频率，至少提供性能数据支撑。（Owner: Dev）

### Gate Recommendation
- 建议 Gate 结果：`CONCERNS`，待补充端到端验证数据与性能证据后再考虑通过。
