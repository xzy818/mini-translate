# 词库与发布规范（PO 汇总）

## 1. 词条数据结构
| 字段 | 类型 | 说明 | 约束 |
| --- | --- | --- | --- |
| `term` | string | 原文单词或短语 | 必填，去除首尾空格，长度 1-100，区分大小写。
| `translation` | string | 翻译结果 | 必填，若翻译失败以 `""` 占位并标记 `status=error`。
| `type` | enum | `word` 或 `phrase` | 依据是否包含空格或非字母字符自动判定，可手动覆盖。
| `length` | number | 原文字符数 | 自动计算，无需导入时提供。
| `createdAt` | string | ISO 时间戳 | 插件写入时生成。
| `updatedAt` | string | ISO 时间戳 | 修改/导入时更新，可与 `createdAt` 相同。
| `status` | enum | `active` / `inactive` / `error` | 默认 `active`，当翻译失败或被停用时修改。

> **上限**：词库总条目 ≤ **500**。读取时若超过限制需截断并提示用户整理。

## 2. TXT 导入规范
- 文件编码 UTF-8。
- 每行一个词或短语；空行忽略。
- 导入流程：
  1. 逐行读取 → 去重 → 判断类型 → 调用翻译服务获取译文。
  2. 若翻译失败，仍写入词库但 `status=error` 并提示用户。
  3. 本次批量导入+现有词条数量超 500 时，停止导入并提示“已达到 500 条上限，成功导入 N 条，剩余请删除后重试”。

## 3. JSON 导入规范
- 允许数组或对象包装：
  ```json
  {
    "version": 1,
    "items": [
      {
        "term": "example",
        "translation": "示例",
        "type": "word",
        "createdAt": "2025-09-17T09:30:00.000Z"
      }
    ]
  }
  ```
- 忽略未知字段；缺失 `translation` 时触发即时翻译。
- 校验逻辑：
  - `term` 必填且唯一（与现有词库合并后去重）。
  - `type` 缺省时自动推断。
  - `createdAt` 缺省时以导入时间补填。

## 4. 导出规范
- TXT：按当前词库排序（`createdAt` 升序），每行输出 `term`。
- JSON：导出 `{ version: 1, exportedAt, items: [...] }`，`items` 保留所有字段。
- UI 中提供下载链接，文件名示例：`mini-translate-vocab-20250917.json`。

## 5. 操作流程
### 5.1 添加词条（右键）
1. Background 判断选区是否已翻译。
2. 请求最新词库；若超限，终止并显示提示。
3. 翻译后写入词库，广播 `VOCAB_UPDATED`。
4. Content script 更新页面显示。

### 5.2 移除词条（右键）
1. Background 发送移除命令。
2. Content script 恢复节点原文，通知 Background。
3. Background 更新词库并广播更新事件。

### 5.3 词库页面操作
- 删除：点击删除按钮 → 弹窗确认 → 更新词库。
- 导入：弹窗显示执行进度；完成后给出成功/失败明细。
- 导出：即时生成 Blob 并触发下载。

## 6. 验收标准（按故事汇总）
| Story | 测试要点 | 验收标准 |
| --- | --- | --- |
| S1 | 右键菜单场景切换 | 三种场景下菜单符合期望，翻译开关可互斥切换。 |
| S2 | 词库 CRUD 与上限 | 添加到第 501 条时被拒绝且有提示；导入时同样生效。 |
| S3 | 模型调用 | 四种模型均可配置并调用成功，错误信息可展示。 |
| S4 | 词表 UI | 列表顶部显示 `当前条目/500`，>10 条自动分页或折叠。 |
| S5 | API 设置区 | 位于页面底部，密钥默认遮挡，可保存并恢复。 |
| S6 | 导入导出流程 | 支持 TXT/JSON；导入错误有详细提示；导出格式符合规范。 |
| S7 | 图标 | 128/48/32/16 尺寸清晰，manifest 指向正确。 |
| S8 | Release | Release 附件包含 ZIP 包，可直接在 Chrome 中加载使用。 |

## 7. Release 检查清单
1. `npm run lint && npm run test` 通过。
2. 自动化 / 手动验证所有 Story 验收标准。
3. 运行 `bash scripts/build-zip.sh` 生成 `mini-translate-extension.zip`，验证 `dist/` 可在本地安装。
4. 更新 README release 说明，包含词库上限、模型支持、安装指南。
5. 附件上传：ZIP 包 + 变更日志。
