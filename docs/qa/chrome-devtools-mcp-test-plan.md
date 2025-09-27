# chrome-devtools-mcp 端到端自动化测试方案（本地执行版）

> 目标：在 **本地环境**（非 CI）借助 [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) 对 Mini Translate 插件执行端到端验证，覆盖扩展启用、Options 设置持久化、词库导入导出、Popup/右键菜单交互、翻译执行链路、异常与迁移，以及存储可观测性。流程要求使用 QA Stub 模拟翻译成功/失败路径，验证所有提示文案与日志，最终产出完整证据包。

---

## 1. 测试范围与验收目标

| 场景 ID | 说明 | 主要目标 |
| --- | --- | --- |
| TC-EXT-001 | 扩展启用与版本校验 | 确认扩展在 `chrome://extensions/` 已启用、版本号正确 |
| TC-SET-002 | Options 保存 + 重新加载 | 保存模型/Base URL/API Key 后重新打开 Options，UI 与 `chrome.storage.local.settings` 均持久化 |
| TC-SET-003 | Options “测试”成功/失败路径 | QA Stub 返回成功/认证失败/超时，断言提示文案与 `[qa:test]` 日志 |
| TC-IMP-004 | JSON/TXT 导入与异常 | 覆盖合法 JSON/TXT、空文件、格式错误、超过 500 条提示 |
| TC-EXP-005 | 导出结果校验 | 校验导出的 TXT/JSON 文件存在且结构符合 `docs/vocabulary-spec.md` |
| TC-STAT-006 | 导入后计数/分页刷新 | 导入后 Options 计数器、分页、空状态更新；Popup 统计同步 |
| TC-POP-007 | Popup 空配置与最新词条展示 | 无配置时提示、导入后展示最新词条、与 Options 统计一致 |
| TC-CM-101/102 | 右键菜单正常流 + 词库上限 | 添加/移除/启停流程，并在词库满 500 条时提示“词库已满” |
| TC-CM-103 | 翻译失败/重试 | 使用 QA Stub 模拟翻译失败，验证 Popup/右键 error 状态与重试按钮 |
| TC-TRN-108 | 页面翻译与回退 | 添加词条 → 刷新页面 → 文本回写；关闭翻译后恢复原文 |
| TC-TRN-109 | Service Worker 重启 + 多 Tab | 重启 Service Worker、跨标签切换，状态与词库保持一致 |
| TC-ROB-110 | 空白配置提示 | Options/Popup 在未配置时的拦截与提示 |
| TC-MIG-111 | 初装/升级迁移 | 初次安装默认状态正确；升级时词库与设置迁移，无错误日志 |
| TC-OBS-112 | 存储观测 | 在关键节点读取 `chrome.storage.local`/`session`，确保状态一致 |
| TC-PERF-113 | 性能证据 | 记录截图、Trace、日志；失败时保留原始 artifacts |
| TC-CLI-114 | `npm run validate` | CLI 层静态检查 + 单测（先决条件） |
| TC-MAN-115 | Release Checklist | 在 Checklist 中登记 MCP 执行信息 |

所有场景必须依赖真实构建 (`dist/`) 与浏览器行为。除 QA Stub 以外，不允许屏蔽或模拟业务逻辑。

---

## 2. 前置条件

1. Node.js ≥ 22.12，已执行 `npm install`。
2. `npm run build` 生成最新 `dist/`（如需启用 QA Hook，执行 `MT_QA_HOOKS=1 npm run build`）。
3. Chrome 桌面版（建议稳定版或 *Chrome for Testing*）；具备启动参数控制权限。
4. 安装 `chrome-devtools-mcp`（通过 `npx` 自动安装即可）。
5. 本地允许打开端口 `9222`（Chrome 远程调试）。
6. 设置环境变量：
   ```bash
   export MT_QA_HOOKS=1                         # 启用测试专用 Hook（QA 面板 + Stub 开关）
   export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   export MCP_EXTENSION_ID="acfpkkkhehadjlkdnffdkoilmhchefbl"   # 如需覆盖默认 ID
   ```
   > QA Stub 通过 `apiBaseUrl=stub://translator/<scenario>` 激活；正式 Release 必须使用真实 API。

---

## 3. 测试资产目录

| 路径 | 内容 |
| --- | --- |
| `tests/mcp/data/sample-vocab.{txt,json}` | 词库导入样例；JSON 版本符合 `vocabulary-spec.md` |
| `tests/mcp/data/invalid-empty.txt` | 空文件异常验证（需新增） |
| `tests/mcp/data/invalid-format.json` | 无效格式示例，用于异常断言 |
| `tests/mcp/batches/smoke.json` | Options 保存/测试、导入导出、翻译链路主流程 |
| `tests/mcp/batches/context-menu.json` | 右键菜单 + Popup 场景、词库上限、错误路径 |
| `tests/mcp/batches/storage.json` | 存储断言批次（新增） |
| `tests/mcp/README.md` | Batch 执行说明与必填占位符 |
| `docs/qa/context-menu-tests.md` | 右键菜单测试分析与 MCP 用例清单（需同步更新） |
| `docs/qa/story-qa-checklist.md` | 统一 Story QA 复选项（新增） |
| `docs/qa/mcp-local-execution.md` | 手动执行详细手册 |
| `test-artifacts/mcp/` | 建议输出截图、DOM snapshot、日志的目录 |

执行前需先补全 batch 文件中的 `<EXTENSION_ID>` 与 `@uid:*` 占位符（见第 5 节）。

---

## 4. 一次完整测试的流程概览

1. **准备构建**：
   - `MT_QA_HOOKS=1 npm run build`
   - 校验 `dist/manifest.json` 版本号与目标版本一致。
2. **启动 Chrome**：`bash scripts/start-chrome-mcp.sh`（第 5.1 节）。首 run 可先执行 `node scripts/mcp/install-chrome.mjs` 下载 *Chrome for Testing*。
3. **启动 MCP Server**：由自动化脚本内部启动（第 5.4 节）。
4. **采集扩展 ID 与 UID**：`npm run mcp:capture` 自动解析 Options/Popup 控件 UID，写入 `tests/mcp/batches/uids.json` 并更新批处理。
5. **执行批处理**：
   - `npm run test:mcp` 依次执行 smoke/context-menu/storage 批次；
   - 每批次产出截图、DOM snapshot、日志、`summary.json`；
   - 批量执行前会验证 JSON 未残留占位。
6. **QA Stub 场景**：在 smoke 批处理中通过表单输入 `stub://translator/*` 切换翻译模拟路径，收集成功/失败提示。
7. **存储断言**：`storage.json` 批次在每个关键阶段读取 `chrome.storage.local/session` 并写入 `test-artifacts/mcp/<timestamp>/storage/*.json`。
8. **记录结果**：
   - 填写 `release-checklist.md` MCP 条目（执行人、时间、证据路径）；
   - 将执行记录同步到相关 Story 的 QA Results。
9. **清理环境**：`bash scripts/kill-chrome-mcp.sh` 关闭调试 Chrome。

> 可使用 `npm run mcp:auto` 一键执行构建 → 启动 → UID 捕获 → 批处理 → 存储断言 → 清理。

---

## 5. 关键操作指南

### 5.1 启动带扩展的 Chrome
`scripts/start-chrome-mcp.sh` 会：
- 关闭旧进程（如存在）；
- 使用 `/tmp/mini-translate-mcp` 作为隔离 profile；
- 加载 `dist/` 扩展并开启端口 `9222`；
- 写入日志 `/tmp/mini-translate-mcp.log`。

停止命令：`bash scripts/kill-chrome-mcp.sh`

### 5.2 捕获扩展 ID 与 UID
执行：
```bash
npm run mcp:capture
```
该命令会：
- 自动探测扩展 ID（可通过 `MCP_EXTENSION_ID` 覆盖）；
- 依次加载 Options/Popup 页面，解析关键控件的 UID；
- 写入 `tests/mcp/batches/uids.json`，并基于模板生成批处理文件；
- 若页面结构变更，请更新 `config/mcp-uid-targets.json` 再次捕获。

### 5.3 启用 QA Hook 与 Stub
- 构建前设置 `MT_QA_HOOKS=1`；
- 在 Options “测试”场景中输入 `stub://translator/success` / `auth-error` / `timeout`；
- QA Hook 提供 QA 面板按钮 (`options.html?qa=1`) 与页面事件 `mt-qa-*`，用于自动化控制词库与翻译开关；
- 正式环境需回滚至真实 API 地址并重新 build。

### 5.4 执行批处理
`npm run test:mcp` 自动完成：
1. 校验批处理不含 `<EXTENSION_ID>`、`@uid:*` 占位；
2. 调用 `chrome-devtools-mcp` 执行所有 `.json` 批处理；
3. 将日志、截图、DOM snapshot、存储快照写入 `test-artifacts/mcp/<timestamp>/`；
4. 输出 `summary.json` 汇总状态。

### 5.5 存储断言辅助函数（MCP）
在批处理内使用：
```json
{
  "tool": "evaluate_script",
  "params": {
    "expression": "(async () => { const data = await chrome.storage.local.get(); return JSON.stringify(data); })()",
    "saveAs": "../../test-artifacts/mcp/<timestamp>/storage/options-after-save.json"
  }
}
```
并配套 `assert.includes` 校验键值。必要时可通过 `call_tool` → `write_file` 保存快照。

---

## 6. 验证与取证要求

- **截图**：
  - Options 保存后 UI；重新加载后的持久化结果；
  - Popup 统计、错误提示、词库满 500 条提醒；
  - 页面翻译前后对比、右键错误状态、重试按钮。
- **DOM Snapshot**：
  - Options 表格在导入前后；
  - Popup 列表、错误提示；
  - 页面翻译回写/恢复 DOM。
- **存储快照**：
  - `chrome.storage.local`：settings、vocabulary；
  - `chrome.storage.session`：`miniTranslateTabState`、QA toggle。
- **日志**：
  - Options “测试”日志需包含 `[qa:test] success|error|timeout`；
  - Background/Service Worker 错误路径保留完整堆栈；
  - MCP 执行日志保存在 `test-artifacts/mcp/<timestamp>/<batch>.log`。
- **性能**：必要时通过 `performance_start_trace` / `performance_stop_trace` 生成 Trace，关注右键菜单响应。
- **Release Checklist**：在 MCP 条目下写入 `(<日期>) <执行人> — <证据目录>`。

---

## 7. 维护与扩展

- 批处理变更后同步更新 `tests/mcp/README.md` 与本方案；
- 新增控件需更新 `config/mcp-uid-targets.json` 再执行 `npm run mcp:capture`；
- 词库样例与 `docs/vocabulary-spec.md` 保持一致；
- QA Stub 场景更新时在文档附最新路径说明；
- 若扩展权限、路由、Hook 机制调整，必须同步更新批处理与 README，并在 `docs/qa/story-qa-checklist.md` 记录新增测试项。

---

## 8. 未完成事项追踪

- [x] 研发 `scripts/start-chrome-mcp.sh`、`scripts/kill-chrome-mcp.sh`
- [x] 研发 `scripts/mcp/capture-uids.mjs`、`scripts/mcp/run-suite.mjs`
- [x] 在 batch 中替换真实 UID 与扩展 ID（需首次成功执行）
- [x] 通过 MCP 自动化执行 Options/Popup/右键三大场景并生成证据
- [ ] 扩展存储断言批次并完成一次演练（`tests/mcp/batches/storage.json`）
- [ ] 在 `release-checklist.md` 记录最新执行
- [ ] 将执行经验回写至 Story QA Results（S1/S3/S5/S6/S9/S10）

---

## 9. 参考资料

- `docs/qa/mcp-local-execution.md` — 本地执行详细手册
- `tests/mcp/README.md` — 批处理与数据说明
- `docs/qa/context-menu-tests.md` — 右键菜单测试分析
- `docs/qa/story-qa-checklist.md` — Story 级 QA 复选项
- `release-checklist.md` — 发布必备事项
- Story S10：`docs/stories/story-s10-mcp-automation.md`

执行完成后请务必将经验与产出同步到相关文档，确保方案持续有效。
