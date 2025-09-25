# chrome-devtools-mcp 端到端自动化测试方案（本地执行版）

> 目标：在 **本地环境**（非 CI）借助 [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) 完成 Mini Translate 插件的端到端验证，覆盖扩展加载、Options/Popup 操作、右键菜单场景、词库导入导出与翻译链路，全程不使用桩或屏蔽逻辑。

---

## 1. 测试范围与验收目标

| 场景 ID | 说明 | 主要目标 |
| --- | --- | --- |
| TC-EXT-001 | 扩展启用与版本校验 | 确认扩展在 `chrome://extensions/` 已启用、版本号正确 |
| TC-OPT-002 | Options 配置保存 | 修改模型/Base URL/API Key 并验证 `chrome.storage.local` 写入 |
| TC-OPT-003 | Options 导入（JSON/TXT） | 导入样例数据并检查去重/上限提示 |
| TC-POP-005/006 | Popup 快捷操作 | 切换翻译开关、核对词库概览、截图留存 |
| TC-CM-101/102/103 | 右键菜单三场景 | 添加 → 移除 → 启停，验证 DOM/通知/词库同步 |
| TC-TRN-007/008 | 翻译链路 | 在真实页面选词翻译与回退，确认内容脚本效果 |
| TC-NET-009 | 异常提示 | 翻译 API 失败/词库超限等告警 |
| TC-PERF-010 | 性能证据 | 收集执行过程截图、Trace、网络请求日志 |
| TC-CLI-011 | `npm run validate` | CLI 层静态检查 + 单测（已纳入全流程 prerequisite） |
| TC-MAN-012 | Release Checklist | 勾选并记录 MCP 执行信息 |

所有场景必须依赖真实构建 (`dist/`) 与浏览器行为，不允许屏蔽或模拟业务逻辑。

---

## 2. 前置条件

1. Node.js ≥ 22.12，已执行 `npm install`
2. `npm run build` 生成最新 `dist/`
3. Chrome 桌面版（建议稳定版）；具备启动参数控制权限
4. 安装 `chrome-devtools-mcp`（通过 `npx` 自动安装即可）
5. 本地允许打开端口 `9222`（Chrome 远程调试）
6. 设置环境变量：
   ```bash
   export MT_QA_HOOKS=1       # 启用测试专用 Hook
   export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   ```
   > `MT_QA_HOOKS` 仅在测试构建生效；正式 Release 需关闭。

---

## 3. 测试资产目录

| 路径 | 内容 |
| --- | --- |
| `tests/mcp/data/sample-vocab.{txt,json}` | 词库导入样例 |
| `tests/mcp/batches/smoke.json` | 扩展加载/Options/导入冒烟流程（含占位符） |
| `tests/mcp/batches/context-menu.json` | 右键菜单三场景骨架 |
| `tests/mcp/README.md` | Batch 执行说明与 TODO |
| `docs/qa/context-menu-tests.md` | 右键菜单测试分析与 MCP 用例清单 |
| `docs/qa/mcp-local-execution.md` | 本地执行详细手册（Chrome 启停、UID 捕获等） |
| `test-artifacts/mcp/` | 建议输出截图、DOM snapshot、日志的目录 |

执行前需先补全 batch 文件中的 `<EXTENSION_ID>` 与 `@uid:*` 占位符（见第 5 节）。

---

## 4. 一次完整测试的流程概览

1. **准备构建**：`npm run build` → 验证 `dist/manifest.json` 版本。
2. **启动 Chrome**：运行脚本 `scripts/start-chrome-mcp.sh`（见第 5.1）。
3. **启动 MCP Server**：`npx chrome-devtools-mcp --browserUrl http://127.0.0.1:9222`。
4. **采集扩展 ID 与 UID**：用 Snapshot 脚本写入 batch（见第 5.2）。
5. **执行批处理**：`npm run test:mcp`（内部串联 smoke、context-menu 等 batch）。
6. **收集证据**：自动/手动保存截图、DOM snapshot、控制台日志至 `test-artifacts/mcp/<timestamp>/`。
7. **记录结果**：在 `release-checklist.md` MCP 条目填写执行人、时间、证据路径；更新 Story S10 QA 记录。
8. **清理环境**：使用 `scripts/kill-chrome-mcp.sh` 关闭调试 Chrome。

---

## 5. 关键操作指南

### 5.1 启动带扩展的 Chrome
```bash
bash scripts/start-chrome-mcp.sh
```
脚本需完成：
- 关闭旧进程（如存在）
- 使用独立 profile（防止账号干扰）
- 加载 `dist/` 扩展并开启端口 `9222`
- 将日志写入 `/tmp/mini-translate-mcp.log`

停止命令：`bash scripts/kill-chrome-mcp.sh`

### 5.2 捕获扩展 ID 与 UID
1. 打开 `chrome://extensions/`，复制扩展 ID（设为 `EXT_ID`）。
2. 执行 Snapshot 脚本（示例）：
   ```bash
   node scripts/mcp-capture-uids.mjs --ext-id "$EXT_ID" \
     --output tests/mcp/batches/uids.json
   ```
   脚本需连接 MCP Server，打开 Options/Popup，取出关键元素的 `uid`。
3. 将结果写入 batch：
   - `smoke.json` 中替换 `@uid:model`、`@uid:import-json` 等
   - `context-menu.json` 中替换选词/移除/启停操作所需的 `uid`
   - 将 `<EXTENSION_ID>` 替换为实际 ID

> 若暂未实现脚本，可临时使用 `take_snapshot` 命令手工解析 UID。

### 5.3 启用 QA Hook
- 在开发构建中，`MT_QA_HOOKS=1 npm run build`
- Hook 作用：允许通过 `evaluate_script` 触发 `mt-qa-selection`、`mt-qa-remove`、`mt-qa-toggle` 等事件，驱动 Service Worker 与 Content Script 协作。
- Release 构建应确保 Hook 关闭。

### 5.4 执行批处理
在 `package.json` 中定义：
```json
"scripts": {
  "test:mcp": "node scripts/run-mcp-suite.mjs"
}
```
`run-mcp-suite.mjs` 需实现：
1. 校验端口 `9222`
2. 按顺序执行 `tests/mcp/batches/*.json`
3. 为每个 batch 创建 `test-artifacts/mcp/<timestamp>/...` 目录并保存产物
4. 汇总执行报告（成功/失败 + 证据路径）

如未完成脚本，可先手工执行 batch，并在完成后补充自动化。

---

## 6. 验证与取证要求

- **截图**：Options 保存、Popup 操作、右键菜单翻译前后、翻译页面效果。
- **DOM Snapshot**：在添加/移除后保存 `context-menu-options-snapshot.json` 等文件。
- **Logs**：导出 `list_console_messages`、`chrome.runtime` 通知、网络请求详情。
- **性能**：需要时使用 `performance_start_trace` / `performance_stop_trace` 生成 Trace。
- **Release Checklist**：在 MCP 条目下写入 `(<日期>) <执行人> — <证据目录>`。

---

## 7. 维护与扩展

- 批处理脚本更新后同步修改 `tests/mcp/README.md`。
- 词库样例需与 `docs/vocabulary-spec.md` 保持一致。
- 元素 UID 可能随 UI 变动，请在 UI 变更后重新执行 Snapshot。
- 若扩展权限、路由或 Hook 机制调整，务必同步更新 batch 与 README。

---

## 8. 未完成事项追踪

- [ ] 研发 `scripts/start-chrome-mcp.sh`、`scripts/kill-chrome-mcp.sh`
- [ ] 研发 `scripts/mcp-capture-uids.mjs`、`scripts/run-mcp-suite.mjs`
- [ ] 在 batch 中替换真实 UID 与扩展 ID
- [ ] 通过 MCP 自动化完整执行 TC-EXT ~ TC-PERF（生成 `test-artifacts/mcp/` 证据）
- [ ] 在 `release-checklist.md` 记录一次成功执行
- [ ] 将执行经验回写至 Story S10 QA Results 和 `docs/qa/context-menu-tests.md`

---

## 9. 参考资料

- `docs/qa/mcp-local-execution.md` — 本地执行详细手册
- `tests/mcp/README.md` — 批处理与数据说明
- `docs/qa/context-menu-tests.md` — 右键菜单测试分析
- `release-checklist.md` — 发布必备事项
- Story S10：`docs/stories/story-s10-mcp-automation.md`

执行完成后请务必将经验与产出同步到相关文档，确保方案持续有效。
