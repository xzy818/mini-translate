# Story S8 — 文档与 Release 交付

## 背景
项目需要完善文档并在每次 Release 时提供可直接安装的 Chrome 插件包。

## 用户价值
- 用户获取明确的安装、配置指南。
- 团队具备标准化的发布流程与交付物。

## 需求要点
1. 更新 README：模型支持、API 准备、词库上限、导入格式、安装说明、Release 包说明。
2. 编写/更新打包脚本，生成 `mini-translate-extension.zip`（可直接在本地加载）。
3. Release Checklist 执行（详见 `docs/vocabulary-spec.md`）。
4. 发布 GitHub Release 时附上 ZIP 包与变更说明。
5. 如需版本号，遵循 SemVer 管理。

## 验收标准
- README 包含所有必要说明。
- `mini-translate-extension.zip` 在 `chrome://extensions` 通过“加载已解压的扩展程序”即可使用（或直接加载生成的 `dist/` 目录）。
- Release 附件齐全，Checklist 项全部完成。
- QA 验证安装流程、文档内容与打包脚本。

## QA Results
- Gate: PASS — README 更新模型/词库/导入导出说明，打包脚本生成 ZIP 可加载，Release checklist 可执行。
- Tests: `npm run validate`
- Notes: 手动运行 `bash scripts/build-zip.sh` 验证打包产物；实际发布需在 GitHub Release 附加 ZIP 并附更新日志。
