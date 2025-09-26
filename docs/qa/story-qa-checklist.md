# Story QA Checklist

> 目标：统一 Mini Translate 核心用户故事（S1/S3/S5/S6/S9/S10）的高优先级验证项，确保每个版本在发布前完成以下覆盖。执行时请勾选并在 Story QA Results 中记录证据（日志、截图、存储快照路径等）。

## 1. 设置面板（Story S5）
- [ ] **保存持久化**：修改模型/Base URL/API Key → 点击“保存”→ 重新加载 Options → 校验下拉框、输入框显示最新配置，同时通过 `chrome.storage.local.get('settings')` 验证写入成功。
- [ ] **测试按钮成功路径**：使用 QA Stub（`apiBaseUrl=stub://translator/success`）执行“测试”→ 断言提示文案为“测试通过”，并在 console 中记录 `[qa:test] success`。
- [ ] **测试按钮失败路径**：
  - [ ] Auth 失败：`apiBaseUrl=stub://translator/auth-error` → 断言提示“测试失败: 认证失败”。
  - [ ] 网络超时：`apiBaseUrl=stub://translator/timeout` → 断言提示“测试异常”，日志包含 `请求超时`。
- [ ] **存储断言**：保存/测试后通过 MCP `evaluate_script` 调用读取 `chrome.storage.local` & `chrome.storage.session`，确认状态无意外字段。

## 2. 导入 / 导出（Story S6）
- [ ] **JSON 导入**：导入合法 JSON，校验去重/上限提示、统计计数更新、分页刷新。
- [ ] **TXT 导入**：导入合法 TXT，确认成功条数与词条预期。
- [ ] **异常文件**：
  - [ ] 空文件导入 → 提示“空文件或格式无效”。
  - [ ] 非 JSON/TXT 文件 → 阻止导入、提示格式错误。
  - [ ] 超过 500 条 → 提示超限并拒绝。
- [ ] **导出校验**：JSON/TXT 导出后，使用文件系统断言文件存在且内容符合 `docs/vocabulary-spec.md` 定义；校验导出的 JSON `version`、`items` 结构正确。
- [ ] **导入后统计**：导入完成后重新读取 Options 表格 → 校验计数器（`${count} / 500`）、分页、空状态更新；同时通过 Popup 查看统计同步。

## 3. Popup 与右键菜单（Stories S1 & S9）
- [ ] **Popup 同步**：导入 JSON 后打开 Popup → 校验词条计数与 Options 一致，最新词条显示在列表。
- [ ] **Popup 空配置提示**：在未配置模型/API Key 时打开 Popup → 显示指引告知需要先设置。
- [ ] **词库上限**：当词条达到 500 条时，在右键菜单添加新词条 → 弹出提醒“词库已满”。
- [ ] **翻译 API 失败**：模拟翻译请求失败（QA Stub `stub://translator/auth-error`）→ 右键菜单动作为 error 状态，展示“重试”按钮，点击可重新尝试。
- [ ] **导入后 Popup 展示**：导入 JSON 后直接打开 Popup → 最新词条可检索/展示。

## 4. 翻译执行链路（Story S3）
- [ ] **页面翻译与回写**：添加词条 → 刷新真实页面 → 文本替换为翻译 → 关闭翻译后恢复原文（验证 DOM Snapshot）。
- [ ] **Service Worker 重启**：强制重启 Service Worker 或关闭再重新打开浏览器 → 确认词库、开关状态、QA Hooks 均保持。
- [ ] **标签页切换**：在多 Tab 间切换翻译开关，确认状态与词库同步、无异常通知。

## 5. 基础健壮性
- [ ] **空白配置提示**：Options、Popup 在无配置时均能友好提示并阻止执行敏感操作。
- [ ] **QA Toggle 效果**：通过 `mt-qa-toggle` 事件触发翻译开关，验证页面真实翻译/恢复结果。
- [ ] **扩展初装/升级迁移**：
  - [ ] 初次安装：默认状态与空词库提示正确。
  - [ ] 版本升级（manifest version 变更）：旧词库与设置迁移保留，日志没有迁移错误。

## 6. 可观测性与日志
- [ ] 关键动作后读取 `chrome.storage.local`、`chrome.storage.session` 并记录到测试报告。
- [ ] 校验背景页 console 日志包含 `[qa]` 前缀的诊断信息；错误路径日志含义清晰。
- [ ] `test-artifacts/mcp/<run>/summary.json` 中记录所有批次结果、失败重试详情；若失败需附加网络/Trace 证据。

执行完毕后，请将复选结果回抄到对应 Story 的 QA Results，并在 Release Checklist 中附加本次 MCP 执行记录。
