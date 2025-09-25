# MCP 本地端到端自动化执行指引

> 适用范围：仅面向本地环境执行 chrome-devtools-mcp 批处理测试，不涉及 CI 部署。

## 1. 前置准备
- Node.js ≥ 22.12
- 已运行 `npm install`
- 执行 `npm run build` 生成最新 `dist/`
- Chrome 桌面版（建议稳定版）安装在本机

## 2. 启动带远程调试的 Chrome
执行以下脚本（根据操作系统调整路径）：
```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CHROME_PROFILE="/tmp/mini-translate-mcp"
$CHROME_PATH \
  --remote-debugging-port=9222 \
  --user-data-dir="$CHROME_PROFILE" \
  --load-extension="$(pwd)/dist" \
  --disable-backgrounding-occluded-windows \
  --autoplay-policy=no-user-gesture-required \
  >/tmp/mini-translate-mcp.log 2>&1 &
```
- 如需停止：
  ```bash
  pkill -f "mini-translate-mcp"
  ```
- 初次启动后访问 `chrome://extensions/`，记录扩展 ID（例如 `abcd1234`）。

## 3. 启动 MCP 服务器
另开终端：
```bash
npx chrome-devtools-mcp@latest --browserUrl http://127.0.0.1:9222
```

## 4. 采集 UID 与替换占位符
1. 在 MCP 客户端执行：
   ```bash
   npx mcp-cli run take_snapshot --page "chrome-extension://<EXT_ID>/options.html"
   ```
   解析输出 JSON，找到与 `id="model"`、`id="import-json"` 等元素对应的 `uid`。
2. 使用脚本更新 batch：
   ```bash
   node scripts/mcp-update-uids.mjs --ext-id <EXT_ID>
   ```
   该脚本需读取 snapshot，生成 `tests/mcp/batches/*.json` 的具体 `uid`/URL。

## 5. 启用 QA Hook（仅测试态）
- 将环境变量 `MT_QA_HOOKS=1`，重新执行 `npm run build`。
- 测试构建会在 content/background 中注册 `mt-qa-selection`/`mt-qa-remove`/`mt-qa-toggle` 事件，方便 MCP 激活右键菜单逻辑。
- Release 构建保持默认关闭，避免副作用。

## 6. 运行批处理
```bash
npm run test:mcp
```
脚本需完成：
1. 检查端口 9222 是否可用；若不可用提示用户重新启动 Chrome。
2. 依次执行 `tests/mcp/batches/*.json`。
3. 将产物输出至 `test-artifacts/mcp/<timestamp>/`（截图、DOM snapshot、console log）。
4. 在 CLI 汇总结果。

## 7. 记录结果
- 在 `release-checklist.md` 的 MCP 子条目填写执行人、日期、产物路径。
- 更新 Story S10 QA Results（已执行/证据链接）。
- 如遇阻塞（如权限限制），记录处理方法。

## 8. 常见问题
- **端口占用**：执行 `lsof -i :9222` 判断并关闭残留 Chrome 进程。
- **扩展 ID 变化**：每次使用新 profile 时可能重新生成；重新执行步骤 4 更新 batch。
- **QA Hook 未生效**：确认 `MT_QA_HOOKS=1`，且重新 build 后在 dist/ 中生效。

该指引覆盖所有阻塞路径，确保在纯本地环境完成端到端自动化测试。
