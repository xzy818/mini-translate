# MCP 自动化示例脚本

此目录存放基于 `chrome-devtools-mcp` 的示例批处理脚本与测试数据，用于执行 Story S10 的发布可测试性要求。

## 结构

- `batches/smoke.json` — 核心冒烟流程（扩展加载 → Options 配置 → 导入词库 → 页面验证）。
- `batches/context-menu.json` — 右键菜单三种场景（添加/移除/启停）测试骨架，需补充实际元素 UID 与桥接脚本。
- `data/sample-vocab.txt` — TXT 导入样例。
- `data/sample-vocab.json` — JSON 导入样例，符合 `vocabulary-spec.md`。

## 使用步骤（全自动）

1. 启动远程调试版 Chrome（默认脚本会自动启动）：
 ```bash
 bash scripts/start-chrome-mcp.sh
 ```
  > 若首次运行，可先执行 `node scripts/mcp/install-chrome.mjs` 下载 *Chrome for Testing*，脚本会自动检测并使用该二进制，以便允许 `--load-extension`。
2. 捕获最新元素 UID 并生成批处理：
 ```bash
 npm run mcp:capture
 ```
  该命令会写入 `tests/mcp/batches/uids.json`，并基于模板生成实际可执行的 `smoke.json`、`context-menu.json` 等批处理文件。若自动探测扩展 ID 失败，可通过设置环境变量 `MCP_EXTENSION_ID=<id>` 或使用 `node scripts/mcp/capture-uids.mjs --ext-id <id>` 显式传入；仓库默认 ID 为 `acfpkkkhehadjlkdnffdkoilmhchefbl`。
  > 右键菜单场景需要 QA 面板（`options.html?qa=1`）提供的测试按钮，请使用 `MT_QA_HOOKS=1 npm run build` 生成构建。
3. 执行批处理并收集产物：
   ```bash
   npm run test:mcp
   ```
   日志和截图会保存在 `test-artifacts/mcp/<timestamp>/`，并自动生成 `summary.json`。
4. 整个流程可通过单一命令完成：
   ```bash
   npm run mcp:auto
   ```
   该命令会构建带 QA Hook 的扩展、启动调试 Chrome、执行 UID 捕获与批处理，并在最后自动清理。

完成后可执行：
```bash
bash scripts/kill-chrome-mcp.sh
```
以关闭调试浏览器。

> 详尽的手动操作及调试技巧请参考 `docs/qa/mcp-local-execution.md`。
