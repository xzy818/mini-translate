# MCP 本地端到端自动化执行指引

> 适用范围：仅面向本地环境执行 chrome-devtools-mcp 批处理测试，不涉及 CI 部署。

## 1. 前置准备
- Node.js ≥ 22.12
- 已运行 `npm install`
- 执行 `npm run build` 生成最新 `dist/`
- Chrome 桌面版（建议稳定版）安装在本机

## 2. 启动带远程调试的 Chrome
推荐使用仓库提供的脚本（首次运行可通过 `node scripts/mcp/install-chrome.mjs` 安装 *Chrome for Testing*，以避免正式版 Chrome 拒绝 `--load-extension` 参数）：
```bash
bash scripts/start-chrome-mcp.sh
```
该脚本会：
- 使用独立的 user-data-dir (`/tmp/mini-translate-mcp`)，避免污染本地配置；
- 在端口 9222 启动远程调试；
- 自动加载 `dist/` 下的扩展，并禁用文件校验；
- 打开 `https://example.com/` 作为基础页。

如需停止：
```bash
bash scripts/kill-chrome-mcp.sh
```

- 初次启动后可通过 `curl http://127.0.0.1:9222/json/list` 获取扩展 ID；仓库已在 `manifest.json` 中固定公钥，默认 ID 为 `acfpkkkhehadjlkdnffdkoilmhchefbl`，如有变更需同步。

## 3. 启动 MCP 服务器
另开终端：
```bash
npx chrome-devtools-mcp@latest --browserUrl http://127.0.0.1:9222
```

## 4. 采集 UID 与替换占位符
推荐使用自动化脚本：
```bash
npm run mcp:capture
```
脚本会自动访问 Options/Popup，解析元素 UID，并生成 `tests/mcp/batches/uids.json` 与批处理文件。若需要手动指定扩展 ID，可通过 `MCP_EXTENSION_ID=<id>` 或 `--ext-id <id>` 传入。

## 5. 启用 QA Hook（仅测试态）
- 将环境变量 `MT_QA_HOOKS=1`，重新执行 `npm run build`。
- 测试构建会在 content/background 中注册 `mt-qa-selection`/`mt-qa-remove`/`mt-qa-toggle` 事件，方便 MCP 激活右键菜单逻辑。
- Release 构建保持默认关闭，避免副作用。

## 6. 运行批处理
```bash
npm run test:mcp
```
脚本会校验批处理是否已替换占位符，随后执行所有 `.json` 批处理文件，将日志与截图输出到 `test-artifacts/mcp/<timestamp>/`，并生成 `summary.json`。

## 7. 记录结果
- 在 `release-checklist.md` 的 MCP 子条目填写执行人、日期、产物路径。
- 更新 Story S10 QA Results（已执行/证据链接）。
- 如遇阻塞（如权限限制），记录处理方法。

## 8. 常见问题
- **端口占用**：执行 `lsof -i :9222` 判断并关闭残留 Chrome 进程。
- **扩展 ID 变化**：每次使用新 profile 时可能重新生成；重新执行步骤 4 更新 batch。
- **QA Hook 未生效**：确认 `MT_QA_HOOKS=1`，且重新 build 后在 dist/ 中生效。

整套流程可使用 `npm run mcp:auto` 自动化：该命令会构建扩展、捕获 UID、执行批处理并生成汇总，最后自动清理调试浏览器。

该指引覆盖所有阻塞路径，确保在纯本地环境完成端到端自动化测试。
