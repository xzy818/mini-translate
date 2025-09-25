# MCP 自动化示例脚本

此目录存放基于 `chrome-devtools-mcp` 的示例批处理脚本与测试数据，用于执行 Story S10 的发布可测试性要求。

## 结构

- `batches/smoke.json` — 核心冒烟流程（扩展加载 → Options 配置 → 导入词库 → 页面验证）。
- `data/sample-vocab.txt` — TXT 导入样例。
- `data/sample-vocab.json` — JSON 导入样例，符合 `vocabulary-spec.md`。

## 使用步骤（手动执行）

1. 构建插件并确保 dist 存在：
   ```bash
   npm run build
   ```
2. 启动带远程调试端口的 Chrome 并加载 dist 扩展：
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --remote-debugging-port=9222 \
     --user-data-dir=/tmp/chrome-mcp-profile \
     --load-extension=$(pwd)/dist
   ```
3. 启动 MCP 服务端：
   ```bash
   npx chrome-devtools-mcp --browserUrl http://127.0.0.1:9222
   ```
4. 使用 MCP 客户端执行批处理（示例命令，具体 CLI 视环境而定）：
   ```bash
   # TODO: 替换为实际可用的 MCP 客户端命令
   mcp-client run batches/smoke.json
   ```

## TODO

- [ ] 将 `@uid` 占位符替换为 `take_snapshot` 生成的真实元素 UID。
- [ ] 评估可用的 MCP 客户端 CLI，并将命令补充到本 README。
- [ ] 将 `mcp-client run` 包装为 `npm run test:mcp`。
- [ ] 在 CI 中集成最小冒烟场景，支持稳定/ beta 渠道。

执行结果（截图、快照、日志）建议放在 `test-artifacts/mcp/` 下，以便随 release 一同归档。
