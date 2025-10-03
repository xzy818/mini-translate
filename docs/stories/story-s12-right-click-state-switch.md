# Story S12: 右键状态切换蓝图

## 背景

近期用户反馈指出，架构文档中描述的右键菜单状态机与实际实现存在明显偏差：菜单文案无法准确反映词库与 Tab 状态，操作后状态不一致，缺乏统一的错误提示与测试覆盖。为避免进一步的行为漂移，需要将架构期望转化为明确的 Story，指导后续代码重构与验证。

## 目标

确保右键菜单行为与以下原则完全一致：

1. 以“当前选中词是否在词库”与“当前 Tab 是否启用”为唯一判定维度。
2. 菜单文案与实际执行操作一致，操作完成后立即刷新状态。
3. 维护词库 (`storage.local`) 与 Tab 启用状态 (`storage.session`) 的一致性，并对内容脚本发送正确的消息。
4. 对错误场景提供统一、可理解的用户提示。

## 场景与状态分析

### 1. 选中词未在词库

- 条件：`selection.trim() !== ''` 且 `!vocabulary.includes(selection)`。
- 菜单文案：`add & mini-translate`。
- 执行步骤：
  1. 校验配置（模型与 API Key）。
  2. 调用翻译服务，得到译文或失败原因。
  3. 写入词库（成功时状态 `active`，失败时状态 `error` 并提示）。
  4. `APPLY_TRANSLATION` 消息广播至当前 Tab；更新菜单状态。

### 2. 选中词已在词库

- 条件：`selection !== ''` 且 `vocabulary.includes(selection)`。
- 菜单文案：`remove from mini-translate`。
- 执行步骤：
  1. 从词库移除词条。
  2. 发送 `REMOVE_TRANSLATION` 给当前 Tab。
  3. 更新菜单状态，通知用户移除结果。

### 3. 无选中词，当前 Tab 未启用

- 条件：`selection === ''` 且 `tabEnabled === false`。
- 菜单文案：`start mini-translate`（可在描述中附上最近翻译提示或词库条目数）。
- 执行步骤：
  1. 调用 `toggleTabState` 将 `enabled` 置为 `true` 并持久化到 `storage.session`。
  2. 发送 `TRANSLATE_ALL` 携带词库给当前 Tab。
  3. 通过通知提示启用成功；刷新菜单。

### 4. 无选中词，当前 Tab 已启用

- 条件：`selection === ''` 且 `tabEnabled === true`。
- 菜单文案：`stop mini-translate`。
- 执行步骤：
  1. `toggleTabState` 设为 `false`。
  2. 发送 `RESET_PAGE` 给当前 Tab。
  3. 通知提示停用结果；刷新菜单。

## 系统设计细节

### 状态判定

- 函数：`resolveMenuContext(chrome, info, tabId)`。
- 输入：
  - `selection`：来自 `SELECTION_CHANGED` 或用户点击时的选区。
  - `vocabulary`：`storage.local` 中的词条列表。
  - `tabState`：`storage.session` 存储的 `{ [tabId]: { enabled, updatedAt } }`。
- 输出：
  - 菜单标题（含提示）。
  - `execute()` 回调，封装添加/移除/切换逻辑。
  - 若无合适操作，则隐藏菜单。

### 菜单更新

- 函数：`updateMenuForInfo`。
- 流程：
  1. 调用 `resolveMenuContext` 获取上下文。
  2. 写入 `menuState` 缓存（key：`tabId` 或 `'global'`）。
  3. 使用 `chrome.contextMenus.update` 设置标题、可见性。
- 触发时机：
  - `SELECTION_CHANGED` 消息。
  - 用户点击菜单后。
  - Tab 切换、关闭或 Service Worker 初始化。

### 操作执行

- `handleAddTerm`：负责翻译、写库、消息广播与提示。
- `handleRemoveTerm`：负责删除词条、通知内容脚本。
- `handleTogglePage`：负责切换 Tab 状态、读取词库并广播至内容脚本。
- 所有操作均需在完成后调用 `updateMenuForInfo`，确保菜单立即反映新状态。

### 持久化

- `storage.local` (`VOCAB_KEY`)：存储词条数组，字段包含 `term`、`translation`、`status`、`createdAt`、`updatedAt` 等。
- `storage.session` (`TAB_STATE_KEY`)：按 `tabId` 存储 `{ enabled, updatedAt }`，Tab 关闭时需清理。
- `menuState`：运行期 Map 缓存，避免重复计算；当选区或状态改变时刷新。

### 用户通知与错误处理

- 配置缺失：提示“请先在扩展设置中配置模型和 API Key”。
- 翻译失败：记录为 `error` 状态，提示用户稍后重试。
- 词库已满：提示限制信息。
- 消息发送失败：对常见错误静默处理，对异常情况记录日志。

## 测试与验收

1. **单元测试**：
   - `resolveMenuContext` 四个分支；
   - `handleAddTerm`/`handleRemoveTerm`/`handleTogglePage` 的成功与失败路径；
   - 错误提示的输出。
2. **集成测试**：模拟背景脚本与内容脚本交互，验证菜单状态与消息链路。
3. **手动验收清单**：
   - 选中未入库词 → 添加后翻译生效；
   - 再次选中已入库词 → 可移除且页面恢复；
   - 切换 Tab → 菜单显示该 Tab 的启用状态；
   - 缺少配置/翻译失败/词库满时给出明确提示；
   - Service Worker 重启后仍能读取 Tab 状态并正确呈现菜单。

## 后续任务

1. 基于本 Story 重构右键状态机，实现独立的状态控制模块。
2. 更新内容脚本与背景脚本消息流，保障通知与错误处理一致。
3. 补充自动化测试，包括端到端验证。
4. 将本 Story 作为未来右键功能改动的设计基线，要求 PR 对齐蓝图。

