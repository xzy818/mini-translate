# 技术架构设计（最新）

> 本文为架构“唯一真相（Single Source of Truth）”。本仓库仅保留此一份架构文档。

## 1. 系统概览
Chrome 插件由四个核心部分组成：
1. **Background Service（`background.js`）**：
   - 负责注册 `chrome.contextMenus`、监听右键事件、转发翻译请求。
   - 计算选区对应的菜单标题与动作，并与 content script 同步翻译状态。
   - 管理 Google 账号认证和云端数据同步。
2. **Content Script（`content.js`）**：
   - 注入到目标页面，执行 DOM 遍历、翻译替换、原文恢复。
   - 监听来自 background 的消息（开始/停止翻译、添加/移除词条）。
3. **Options / 管理页（`options.html` + JS）**：
   - 管理词库、导入导出、API 配置。
   - 直接操作 `chrome.storage.local` 和 `chrome.storage.sync`。
   - 与弹窗共享控制器/模块，作为完整的管理入口。
   - 提供 Google 账号登录状态显示和同步设置。
4. **弹窗快捷面板（`popup.html` + JS）**：
   - 点击扩展图标后出现，提供与 Options 页面相同的核心操作。
   - 复用词库与配置控制器，展示精简 UI 并支持导入导出。
   - 显示同步状态和快速同步操作。

补充模块：
- **翻译服务封装（`services/translator.js`）**：统一处理 DeepSeek、Qwen、OpenAI 等模型调用（极简化：单一通道 + provider 映射 + 通用请求/响应解析，去除重复实现）。
- **存储访问层（`services/storage.js`）**：对 `chrome.storage.local` 和 `chrome.storage.sync` 提供 Promise 封装，统一 schema 校验。
- **Google 认证服务（`services/google-auth.js`）**：处理 Google 账号登录/登出，管理认证状态。
- **云端同步服务（`services/cloud-sync.js`）**：实现数据同步逻辑，处理增量同步和冲突检测。
- **冲突解决服务（`services/conflict-resolver.js`）**：处理数据冲突，提供自动和手动解决策略。
- **打包脚本**：构建 release 压缩包（`scripts/build-release.js`）。

## 2. 运行流程
```
用户右键 → Background 判断场景 →
  - add & mini-translate: 读取选中文本 → 写入词库 → 发送 content script 翻译命令 → 触发云端同步
  - remove from mini-translate: 通知 content script 回退 → 更新词库 → 触发云端同步
content script 接收到指令 → 初始化词库缓存 → 遍历 DOM 替换文本节点
翻译脚本命中词条 → 调用翻译服务（若无缓存）→ 更新显示并标记节点

数据同步流程：
用户登录 Google 账号 → 检查本地数据与云端差异 → 执行数据同步 → 解决冲突（如有）
数据变更 → 更新本地存储 → 触发增量同步 → 更新云端数据
```

## 3. 模块设计
### 3.1 Background Service
- `contextMenuManager`
  - 单一菜单 ID `MINI_TRANSLATE_ACTION`，针对选区动态计算标题与动作。
  - 在 `SELECTION_CHANGED` 消息与菜单点击后刷新可见性与标题。
- `menuState`
  - 使用 `Map` 缓存 `tabId -> menuContext`，避免重复读取词库。
  - 在 `chrome.tabs.onRemoved` 时清理缓存。
- `messageRouter`
  - 使用 `chrome.runtime.onMessage.addListener` 处理 content script 的查询（如获取词库）。
- `syncManager`
  - 管理数据同步状态，监听存储变化。
  - 处理增量同步和冲突检测。
  - 协调本地存储与云端存储的数据一致性。

### 3.2 Content Script
- `domWalker`
  - 使用 `TreeWalker` 遍历文本节点，跳过脚本样式等标签。
  - 对每个文本节点调用 `translateTextNode`。
- `nodeMarker`
  - 使用 `data-mini-translate` 属性存储原文 JSON，便于回退与检测已翻译状态。
- `translationOrchestrator`
  - 接收 background 指令：`APPLY_TRANSLATION`, `REMOVE_TRANSLATION`。
  - 维护词库缓存（由消息驱动更新）。

### 3.3 词库存储
- `storage.js`
  - `getVocabulary()`: 返回数组，按创建时间排序。
  - `setVocabulary(list)`: 写前校验条目与上限。
  - `appendTerm(term)`: 去重（大小写敏感策略）并返回状态码。
  - `removeTerm(term)`: 删除指定原文。
  - `getSettings()` / `setSettings()`：读写 API 配置。
  - `syncVocabulary()`: 同步词库到云端。
  - `resolveConflicts()`: 处理数据冲突。
- 数据结构详见 PO 文档（`docs/references/vocabulary-spec.md`）。
- 同步存储策略：
  - 本地存储：`chrome.storage.local` 用于快速访问和离线使用。
  - 云端存储：`chrome.storage.sync` 用于跨设备同步。
  - 冲突解决：时间戳优先，用户手动选择。

### 3.4 翻译服务
- `translator.js`
  - 统一导出 `translateText({ text, model, apiKey, apiBaseUrl })`。
  - 内部按模型路由到不同实现：
    - DeepSeek：`POST {baseUrl}/v1/chat/completions`，模型为 `deepseek-v3`。
    - Qwen：统一 `/v1/chat/completions` 兼容路径直连，Turbo/Plus 由 `model` 指定。
    - OpenAI：`gpt-4o-mini`。
  - 支持超时、退避重试（指数退避），错误信息标准化。
  - 建议在背景页直接使用标准 `fetch` 直连供应商；仅当企业网络限制时再选用代理方案（参见归档文档）。
- 缓存策略：针对相同 term + model + context 可写入 `chrome.storage.local` 的 LRU（可选优化）。

### 3.5 Google 认证与同步
- `google-auth.js`
  - `authenticate()`: 使用 Chrome Identity API 进行 Google 认证。
  - `getAuthStatus()`: 获取当前认证状态。
  - `logout()`: 清除认证信息。
  - `onAuthStateChanged()`: 监听认证状态变化。
- `cloud-sync.js`
  - `syncData()`: 执行数据同步。
  - `detectConflicts()`: 检测数据冲突。
  - `mergeData()`: 合并数据。
  - `compressData()`: 数据压缩以节省存储空间。
- `conflict-resolver.js`
  - `resolveConflicts()`: 自动解决冲突。
  - `showConflictUI()`: 显示冲突解决界面。
  - `applyResolution()`: 应用冲突解决方案。

## 4. UI 与交互
- Options/弹窗 使用原生 Web 组件或轻量框架（默认为原生）。
- 词库表顶部显示计数（`n/500`），超限后禁用添加按钮。
- API 设置模块提供：模型下拉、Base URL、Key（星号遮挡 + 查看按钮）。
- 导入导出按钮放在词表区域右上角，导入时给出浮层反馈。
- Google 同步模块：
  - 显示当前登录状态（已登录/未登录）。
  - 提供登录/登出按钮。
  - 显示同步状态（同步中/已同步/同步失败）。
  - 提供手动同步按钮。
  - 冲突解决界面：显示冲突详情，提供选择选项。

## 5. 状态管理
- **页面翻译状态**：background 中 `tabStateStore` 是权威数据；content script 初始化时查询当前状态并执行对应动作。
- **词库缓存**：content script 在 `chrome.runtime.onMessage` 中监听 `VOCAB_UPDATED` 事件；Options 页面更新词库时发送事件。
- **模型设置**：Options 保存后触发 `SETTINGS_UPDATED` 广播，background 与 content script 可按需响应。
- **同步状态**：
  - 认证状态：存储在 `chrome.storage.local` 中，监听 `chrome.identity.onSignInChanged` 事件。
  - 同步状态：显示最后同步时间、冲突数量、待同步变更。
  - 数据版本：每个数据项包含版本号和时间戳，用于冲突检测。

## 6. 错误处理
- 翻译失败：
  - 提示信息通过 Chrome 通知或浏览器内 toast（选择 lightweight toast）。
  - 记录失败次数，超过阈值时建议用户检查配置。
- 同步失败：
  - 网络错误：自动重试，显示重试状态。
  - 认证失败：提示重新登录。
  - 存储配额超限：提示数据压缩或清理。
  - 冲突解决：显示冲突界面，引导用户选择。
- 词库超限：
  - 提示“已达到 500 条上限”，阻止继续添加。
- 导入失败：
  - 显示错误行号与原因。

## 7. 安全与隐私
- API Key 仅存储在 `chrome.storage.local`，不上传远端。
- Options 页面主动提醒用户不要分享录屏等敏感信息。
- 仅在用户触发翻译时调用外部 API，不进行后台自动请求。

## 8. 构建与发布
- 使用 `npm run build` 生成 `dist/` 目录：
  - 复制 manifest、背景脚本、content script、Options 静态文件、图标。
- 使用 `bash scripts/build-zip.sh` 生成 `dist/` 与 `mini-translate-extension.zip`，可直接在 Chrome `chrome://extensions` → “加载已解压的扩展程序” 使用。
- Release 流程：
  1. 在 GitHub Actions 中运行 lint/测试。
  2. 打包生成 ZIP，并作为 Release 附件上传。
  3. 更新 README Release 说明。

## 9. 开发注意事项
- 避免在 content script 中使用 `innerHTML` 直接写入，防止 XSS。
- 使用 ESBuild 或 Vite 打包可选，如无必要先采用原生结构。
- 使用 TypeScript 可以增强类型安全（可视资源允许，若采用需在 PRD 中补充）。
- 函数命名使用驼峰，文件夹以 kebab-case。
