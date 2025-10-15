# Mini Translate 浏览器扩展

一个尽量不打扰阅读体验、只翻译少量生词的小型翻译插件。

## 目的（Purpose）

本项目用于探索 AI 编程工具、BMAD 开发流程，以及 UI 自动化测试等软件工程实践。

## 图标（Icon）

白底圆角方形上的蓝色 “MT” 字样（由 `scripts/generate-mt-icons-sharp.js` 生成）：

<p>
  <img src="public/icons/icon-128.png" alt="Mini Translate Icon" width="128" height="128"/>
  <br/>
  <em>矢量源：public/icons/icon.svg</em>
  <br/>
  <a href="./README.en.md">English</a>
  ·
  <a href="./README.md">语言选择</a>
</p>

## 模型与设置（Models & Settings）

支持的模型通过设置页下拉动态提供（默认：`qwen-mt-turbo`），完整清单见 `docs/SUPPORTED_MODELS.md`。

设置项：
- 模型（下拉选择）
- API Base URL（内置，无需用户配置）
- API Key（隐藏显示切换）

说明：
- MV3 背景脚本内置各提供商域名与端点映射，具备 host 权限即可直连，无需自定义 Base URL/代理。
- 若网络策略限制直连，可自备代理，但并非默认或必要。

## 词库上限与导入/导出

- 最大条目：500（超限会提示并阻止继续添加/导入）
- 导入：TXT（每行一个词）、JSON（见 `docs/vocabulary-spec.md`，失败会给出行号与原因）
- 导出：TXT（按创建时间排序）、JSON `{ version, exportedAt, items }`
- 导出的 JSON 可直接再导入用于备份/迁移

## 构建与加载

### 本地打包
运行 `bash scripts/build-zip.sh` 生成 `dist/` 和 `mini-translate-extension.zip`。

### Chrome 加载（开发）
- 打开 `chrome://extensions/`
- 启用“开发者模式”
- 点击“加载已解压的扩展程序”，选择 `dist/` 目录（先执行打包；`dist/` 已包含服务所需的 `src/` 代码）

### Release 产物
GitHub Release 将包含 ZIP 包及变更记录。

## 🚀 功能

- 右键菜单：添加/移除生词、切换整页翻译
- 智能翻译：仅翻译选中的不熟悉词汇
- 本地存储：维护个人词库（上限 500）
- 不打扰：尽量不改变原本阅读体验

## 📦 安装与开发

### 开发环境

1. 克隆仓库：
   ```bash
   git clone https://github.com/xzy818/mini-translate.git
   cd mini-translate
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 运行校验与测试：
   ```bash
   npm run validate
   ```

4. 在 Chrome 中加载（见上文）

## 🧪 测试

### 运行测试
```bash
# 全量测试
npm test

# 覆盖率
npm run test:coverage

# 集成测试
npm run test:integration

# 监听模式
npm run test:watch
```

### 代码质量
```bash
# Lint 检查
npm run lint

# 自动修复
npm run lint:fix

# 完整校验
npm run validate
```

## 🔧 开发

### CI/CD

- CI：ESLint、单元/集成测试、构建校验、质量门禁
- PR 检查：自动化质量检查与评论
- 发布：打 Tag 后自动产出安装包

## 📋 用户故事

### S1：右键菜单与整页翻译
- 词条增删
- 整页翻译开关
- 背景脚本状态管理

### S2：词库存储与管理
- storage.local 持久化
- 500 条上限
- 去重的 CRUD



## 📄 许可证

ISC License

## 🤝 贡献

1. Fork 仓库
2. 建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交改动（`git commit -m 'Add amazing feature'`）
4. 推送（`git push origin feature/amazing-feature`）
5. 发起 PR

## 🔗 链接

- GitHub 仓库：`https://github.com/xzy818/mini-translate`
- Issues：`https://github.com/xzy818/mini-translate/issues`

