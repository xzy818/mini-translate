# Story S7 — 蓝色双箭头图标

## 背景
插件需要独特且统一的视觉标识，用于浏览器工具栏、扩展页面和 Chrome 商店。

## 用户价值
- 快速识别插件。
- 与产品定位一致，传达翻译/双向转换含义。

## 需求要点
1. 设计白底蓝色双箭头图形，横梁厚度为图标高度的 1/5。
2. 输出必要尺寸：128×128、48×48、32×32、16×16（PNG），保留源文件（SVG）。
3. 更新 manifest，确保浏览器展示正确。
4. 在 README 中展示图标示意（可选）。

## 验收标准
- 图标在不同尺寸下清晰，无明显锯齿。
- 工具栏、扩展详情页均显示新图标。
- QA 验证图标文件存在、命名正确且已被 manifest 引用。

## QA Results

### Review Date: 2025-09-18
Reviewed By: Quinn

- SVG 源：`public/icons/icon.svg` 已添加
- Manifest 引用：`public/manifest.json` 包含 16/32/48/128 PNG 图标
- README 已展示图标示意

Gate: PASS → docs/qa/gates/e1.s7-icon.yml

Test design: docs/qa/assessments/e1.s7-test-design-20250918.md

