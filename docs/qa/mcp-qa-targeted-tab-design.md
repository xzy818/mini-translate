# MCP QA 扩展消息增强设计

## 1. 背景
当前 chrome-devtools-mcp 自动化已覆盖 Options、导入导出、Popup 与右键菜单等核心流程，但在“Example 页面翻译回写验证”与“Service Worker 重启检查”两项高级场景上受限于扩展缺乏可编排的 QA 消息：
- `window.__miniTranslateQA` 仅能操作 `chrome.storage`，无法指向特定 tab 执行词条添加/移除。
- Service Worker 只能通过 `initializeBackground` 重新初始化，无法脚本化执行 `chrome.runtime.reload()` 并复位状态。
此文档梳理补齐自动化能力的测试性需求、架构方案与详细设计，用于后续开发与测试跟踪。

## 2. 目标与范围
- 新增 QA 专用消息通道，允许指定 tabId 执行词条添加、移除、翻译开关。
- 提供 Service Worker QA 重启指令，验证状态持久性与重新初始化流程。
- 更新内容脚本/qa-bridge，确保 MCP 可在 Example Domain 页面驱动翻译与回退。
- 支持 MCP 批处理在 storage 与 smoke 流程中调用上述指令，生成稳定的翻译断言与重启校验证据。
不在本轮范围：正式用户功能行为调整、CI 集成、非 Chrome 环境兼容性。

## 3. 需求场景
| 场景 ID | 描述 | 触发方式 | 期待结果 |
| --- | --- | --- | --- |
| QA-TAB-APPLY | MCP 指向 Example Domain tab，发起词条添加与翻译触发 | chrome.runtime.sendMessage `{type: 'QA_APPLY_TERM', payload: { term, translation, tabId }}` | 指定 tab 页面文本刷新为翻译内容，同时 `chrome.storage.local.vocabulary` 更新并返回 `{ok: true}` |
| QA-TAB-REMOVE | MCP 指向 Example Domain tab，移除词条并恢复原文 | 同上，type `QA_REMOVE_TERM` | 页面文字恢复原文，词条从 storage 移除 |
| QA-SW-RESET | 自动化验证 Service Worker 重启后状态一致 | Message `{type: 'QA_RESET_WORKER'}` | 执行 `chrome.runtime.reload()` 或等效逻辑，重新初始化 QA hooks，返回 `{ok: true, reloaded: true}` |
| QA-TAB-STATUS | 自动化读取目标 tab 词条应用状态 | Message `{type: 'QA_QUERY_TERM', payload: { tabId, term }}` | 返回当前翻译命中状态 & 最近一次操作时间，供断言使用 |

## 4. 架构设计概要
```
MCP Batch → chrome.debugger Runtime → content script bridge → background QA handler → core vocabulary/service worker modules
```
- **内容脚本 QA Bridge**：注入 `window.__miniTranslateQA`，负责包装消息并附带当前 tabId。
- **Background QA Handler**：新增 QA 消息类型，解析 tabId/term/translation，调用已有 `handleAddTerm`、`handleRemoveTerm`，并向目标 tab 广播结果。
- **Service Worker 控制**：在 QA build 中暴露 `resetWorker` 方法，执行 `chrome.runtime.reload()` 并等待 `initializeBackground` 完成。
- **MCP 集成**：在 `tests/mcp/batches/*.json` 中增加步骤，先利用 `chrome.debugger.sendCommand` 获取 tabId，再调用 QA 消息完成翻译写入与恢复。

## 5. 详细设计
### 5.1 Background QA 消息
```js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isQaBuild()) return false;
  const tabId = Number.isInteger(message.payload?.tabId)
    ? message.payload.tabId
    : sender?.tab?.id ?? null;

  switch (message.type) {
    case 'QA_APPLY_TERM':
      return handleAddTerm(chrome, message.payload, tabId).then((result) => sendResponse({ ok: true, ...result })).catch(
        (error) => sendResponse({ ok: false, error: error.message })
      );
    case 'QA_REMOVE_TERM':
      return handleRemoveTerm(chrome, message.payload, tabId).then(() => sendResponse({ ok: true }));
    case 'QA_QUERY_TERM':
      return resolveTermState(tabId, message.payload.term).then((state) => sendResponse({ ok: true, state }));
    case 'QA_RESET_WORKER':
      chrome.runtime.reload();
      waitForInitialization().then(() => sendResponse({ ok: true, reloaded: true }));
      return true;
    default:
      return false;
  }
});
```
- `resolveTermState` 读取背景内存与 `chrome.storage.local`，对齐页面与存储的词条状态。
- `waitForInitialization` 封装初始化的 Promise，确保自动化在 worker 重启完毕后再继续。

### 5.2 内容脚本 / QA Bridge
- 在 `content/qa-bridge.ts` 中新增：
  - `getCurrentTabId`：通过 `chrome.runtime.sendMessage({type: 'QA_WHOAMI'})` 或 `chrome.tabs.getCurrent`（若不可用，则在注入脚本时由 MCP 传入 tabId）。
  - `window.__miniTranslateQA.applyTerm(term, translation, tabId?)`，内部调用 background QA 消息。
  - `window.__miniTranslateQA.removeTerm(term, tabId?)`、`window.__miniTranslateQA.resetWorker()`。
- 在 Example Domain 页面注入脚本时，MCP 将当前 tabId 写入 `window.__miniTranslateQA.__TAB_ID__`，缺省时 fallback 到 background 推断。

### 5.3 MCP 批处理调整
- `tests/mcp/batches/smoke.template.json`
  - 新增步骤：`chrome.debugger` 获取 Example tabId → `runtime.sendMessage QA_APPLY_TERM` → DOM snapshot 断言 → `QA_REMOVE_TERM` → 截图恢复。
- `tests/mcp/batches/storage.template.json`
  - 执行 `QA_RESET_WORKER` 后等待 3s，再读取 `chrome.storage.local`，确认词库与翻译开关保持。
- `tests/mcp/utils/qa.js`
  - 封装 `sendQaMessage(type, payload, { tabId })`，自动重试 message port closed 情况。

### 5.4 日志与可观测性
- Background 在 QA 消息入口打印 `[qa:msg] type=... tabId=... result=...`，供调试。
- 在 MCP artifact 中记录 QA 指令执行顺序与结果，帮助定位自动化失败。

## 6. 实施计划
1. 扩展源码更新（background/content/qa-bridge + build flag）。
2. 单元测试：新增 QA handler 覆盖（Node 环境 mock chrome API）。
3. 手动验证：Chrome 打开 Example Domain，通过 DevTools Console 调用 `window.__miniTranslateQA.applyTerm(...)` 验证翻译。
4. MCP 批处理更新与本地回归执行。
5. 文档更新：测试计划、release checklist、S9/S10 QA Results。

## 7. 风险与对策
- **TabId 解析失败**：在 MCP 中增加重试与日志；在 background fallback 至 sender.tab.id。
- **Service Worker reload 延迟**：`waitForInitialization` 为 5s 超时，失败时返回错误供自动化定位。
- **QA 逻辑污染正式构建**：通过 `process.env.MT_QA_HOOKS` 开关仅在 QA build 注入。

## 8. 验收标准
- 在 QA build 中，可通过控制台调用 QA API 对特定 tab 添加/移除词条，并观察页面文本与 storage 变化。
- `npm run mcp:auto` 能在 Example Domain 场景稳定完成翻译写入→回退断言。
- Service Worker 重启后自动化断言词库与翻译开关仍正确。
- 新增文档与 Story 完成评审并归档。
