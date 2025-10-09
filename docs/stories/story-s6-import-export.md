# Story S6 — 词库导入导出

## 背景
用户需要备份与恢复词库，并批量导入新词条。

## 用户价值
- 保护个人学习成果，便于迁移。
- 批量导入词条，提高效率。

## 需求要点
1. 支持 TXT/JSON 两种格式导入，遵循 `docs/vocabulary-spec.md`。
2. 导入流程校验格式、去重与 500 条上限，提供进度反馈。
3. 导出 TXT：每行一个 `term`（按 `createdAt` 排序）。
4. 导出 JSON：输出 `{ version, exportedAt, items }`。
5. 导入失败时提示失败行/原因，成功部分应写入词库。

## 验收标准
- 导入成功后词库与 UI 同步更新，并遵守上限。
- 导出文件可直接重新导入，结果一致。
- 错误格式导入给出清晰提示，且不会污染现有词库。
- QA 覆盖大批量导入、部分失败、重复词条、上限等场景。

## QA Results
- Gate: PASS — Options 页面新增导入/导出控件，TXT/JSON 互通，失败条目提示清晰。
- Tests: `npm run validate`
- Notes: 自动化针对成功/部分失败/超限场景做了验证；建议在真实文件对接场景确认大文件性能。
- Chrome: 2025-09-27 — 自动化上传 `sample-vocab.json` 并记录摘要，见 `test-artifacts/chrome/2025-09-27T10-24-40-280Z/smoke/smoke.json.log` 与 `.../options/options-after-import.dom.json`。
