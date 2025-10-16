# 词库与发布规范

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
