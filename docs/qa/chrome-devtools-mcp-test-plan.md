# chrome-devtools-mcp 自动化测试方案

## 1. 目的
基于 [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) 自动化操控 Chrome 浏览器，对 mini-translate 插件进行端到端验证，覆盖扩展加载、配置、词库操作、翻译链路与回归检查，保证发布包可用性与可重复测试能力。

## 2. 前置条件
- Node.js ≥ 22.12（`chrome-devtools-mcp` CLI 运行要求）。
- 本仓库已执行 `npm install`，并完成 `npm run build` 生成最新的 `dist/` 与 `mini-translate-extension.zip`。
- 可访问本地 Chrome 稳定版或指定渠道版本。
- 本地具备 `npx` 与 `@modelcontextprotocol/cli`。

## 3. 环境准备
1. **启动带远程调试的 Chrome**
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --remote-debugging-port=9222 \
     --user-data-dir=/tmp/chrome-mcp-profile \
     --load-extension=/path/to/mini-translate/dist
   ```
   - 如需沿用已加载的 Chrome，可手动启用扩展后执行 `chrome --remote-debugging-port=9222`。
2. **启动 MCP 服务器**
   ```bash
   npx chrome-devtools-mcp@latest \
     --browserUrl http://127.0.0.1:9222 \
     --headless=false \
     --isolated=false
   ```
   - 可使用 `--channel` 或 `--executablePath` 指定浏览器版本；若在沙箱环境受限，请改用 `--browserUrl` 连接外部已启动的 Chrome。
3. **连接 MCP 客户端**
   ```bash
   npx @modelcontextprotocol/cli@latest \
     --server-type stdio \
     --command npx \
     --arg chrome-devtools-mcp@latest \
     --arg --browserUrl \
     --arg http://127.0.0.1:9222
   ```
   - 支持将常用命令编入 JSON（batch 模式）以便持续集成执行。

## 4. 核心测试场景
| 场景 | 目标 | 主要工具调用 |
| --- | --- | --- |
| 扩展加载确认 | 验证扩展在 `chrome://extensions/` 处于启用状态并记录扩展 ID | `navigate_page`, `take_snapshot`, `evaluate_script (chrome.management.getAll)` |
| Options 设置冒烟 | 在 `options.html` 中更改模型、Base URL、API Key，并校验 `chrome.storage.local` 更新 | `new_page`, `take_snapshot`, `fill`, `evaluate_script` |
| Popup 快捷操作 | 打开 `popup.html`，切换翻译开关并截图留存 | `new_page`, `click`, `take_screenshot`, `list_console_messages` |
| 词库导入导出 | 上传 TXT/JSON，校验导入提示与条目上限；触发导出并监控网络请求 | `upload_file`, `wait_for`, `evaluate_script`, `list_network_requests` |
| 翻译链路验证 | 在示例网页选词、触发添加/移除词条，检查页面 DOM 翻译效果与消息日志 | `navigate_page`, `evaluate_script`, `wait_for`, `take_snapshot` |
| 回归与性能检查 | 记录关键操作的截图/快照；必要时收集性能 Trace | `take_screenshot`, `take_snapshot`, `performance_start_trace`, `performance_stop_trace` |

> 建议将每个场景封装为独立脚本（JSON batch），并在执行后保存产出（截图、网络日志、Trace 文件）作为发布附证。

## 5. 测试流程
1. 构建产物并运行 `npm run validate`；仅在成功后执行 MCP 测试。
2. 按“核心测试场景”顺序执行，必要时重复“词库导入/翻译链路”覆盖不同模型或 API 情况。
3. 测试完成后，收集：
   - 扩展版本信息 (`dist/manifest.json` 与 ZIP manifest)。
   - MCP 执行日志与输出截图/快照。
   - 若有性能 Trace，附在 release 记录中。
4. 在 `release-checklist.md` 上记录执行人、执行时间与结果，保证可追溯。

## 6. 自动化与维护建议
- 将 MCP 操作脚本存放于 `tests/mcp/`（建议新增目录），并在 CI 中通过 Matrix 对多个 Chrome Channel 运行冒烟测试。
- 对关键页面元素（Options/Popup）建立稳定的选择器或运行前快照，降低 DOM 变更导致的定位失败。
- 定期更新测试数据（词库文件、示例网页），并记录在 README “测试指南”章节。
- 若扩展权限或路由变更，需同步更新 MCP 脚本中的 URL/命令。

## 7. 风险与应对
- **沙箱限制**：若 MCP 被安全策略限制无法启动 Chrome，改为预启动带调试端口的浏览器并使用 `--browserUrl` 连接。
- **DOM 结构改变**：维护 DOM 快照与测试脚本，必要时使用 `evaluate_script` 注入选择器定位。
- **外部服务依赖**：翻译 API 失效时可在测试脚本中切换到 mock Base URL，或捕获异常后执行降级验证。

---
此方案作为可测试性需求的依据，应在每次发布前执行并在 Story/Sprint 文档中记录结果。

## 8. TODO 清单（本地执行）
- [ ] 依据 `tests/mcp/batches/smoke.json` 验证并补全所有 `uid` 占位符。
- [ ] 为 Options/Popup/翻译链路拆分独立批处理文件，形成完整回归套件。
- [ ] 编写 `npm run test:mcp` 脚本统一触发批处理（仅考虑本地执行场景）。
- [ ] 首次执行后在 `release-checklist.md` 的 MCP 条目记录日期、责任人与产出链接。

## 9. 执行路线图
1. **获取扩展 ID 与元素 UID**  
   - 在本地启动 Chrome 并加载 `dist/` 扩展，记录扩展 ID。  
   - 运行 `take_snapshot`，提取 Options/Popup 中关键元素 UID，替换 `smoke.json`、`context-menu.json` 中的 `@uid:*`。  
2. **增加 QA Hook（仅测试环境）**  
   - 在内容脚本/背景脚本中监听自定义事件（如 `mt-qa-selection`、`mt-qa-remove`），触发现有业务逻辑，确保 MCP 可以通过 `evaluate_script` 调用这些事件。  
   - 确保 Hook 受 `process.env.MT_QA_HOOKS` 或等价开关控制，避免影响正式构建。  
3. **完善批处理脚本**  
   - 更新 `smoke.json`：补足 Options 保存、导入提示的断言与截图。  
   - 更新 `context-menu.json`：按 `TC-CM-101/102/103` 拆分步骤，验证翻译标记与通知。  
   - 新增 `popup.json`、`translation.json` 等文件，覆盖 Popup 操作与翻译链路。  
4. **封装执行命令**  
   - 在 `package.json` 中添加 `test:mcp` 脚本（指向本地 Chrome，可通过 `CHROME_PATH` 环境变量配置），依次执行上述 batch，并将输出保存至 `test-artifacts/mcp/<timestamp>/`。  
   - 产出后更新 `release-checklist.md` 与 Story S10 QA 记录。  
5. **首次执行与结果归档**  
   - 手动运行 `npm run test:mcp`，收集截图、DOM snapshot、日志、性能 Trace。  
   - 在 `docs/qa/context-menu-tests.md`、`docs/qa/chrome-devtools-mcp-test-plan.md` 中更新执行结果与经验。  
6. **本地执行注意事项**  
   - 启动 Chrome 时使用脚本 `scripts/start-chrome-mcp.sh`，确保端口 9222 可用。  
   - 若端口被占用，先执行 `scripts/kill-chrome-mcp.sh` 停止残留进程。  
   - 建议在 README “测试指南”章节补充“本地 MCP 自动化”段落，引导执行者完成所有步骤。  

若在本地执行中遇到阻塞（例如系统策略禁止远程调试），需记录解决方案或手动执行的替代流程。
