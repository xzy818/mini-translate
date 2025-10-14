# Mini Translate Chrome Extension

A mini translation plugin developed for Chrome that does not disrupt the reading experience and only translates a few unfamiliar words.

## Purpose

本插件开发目的是使用 AI 编程工具，实践 BMAD 开发流程，以及 UI 自动化测试等软件工程实践探索。

## Icon

Blue "MT" lettermark on white rounded square used by the extension (generated via scripts/generate-mt-icons-sharp.js):

<p>
  <img src="public/icons/icon-128.png" alt="Mini Translate Icon" width="128" height="128"/>
  <br/>
  <em>Vector source: public/icons/icon.svg</em>
</p>

## Models & Settings

支持的模型通过“设置”页下拉动态提供（默认：`qwen-mt-turbo`）。完整清单见 `docs/SUPPORTED_MODELS.md`。

Settings fields:
- Model (select)
- API Base URL（内置，无需用户配置）
- API Key (masked, toggle show/hide)

Notes:
- MV3 背景脚本已内置针对各模型提供商的域名与接口映射，具备相应 host 权限后可直接访问，无需配置代理与自定义 Base URL。
- 若网络策略限制直连，可自行准备代理，但非必要也非默认路径。

## Vocabulary Limit & Import/Export

- Max items: 500（超限时会提示并阻止继续添加/导入）
- **导入**：TXT（每行一个词）、JSON（遵循 `docs/vocabulary-spec.md`），部分失败会给出行号和原因
- **导出**：TXT（按创建时间排序），JSON `{ version, exportedAt, items }`
- 导出的 JSON 可直接再次导入，便于备份与迁移

## Build & Release

### Local package
Run `bash scripts/build-zip.sh` to produce `dist/` and `mini-translate-extension.zip`.
Load the unpacked extension by选择 `dist/` 目录或解压 ZIP 后加载根目录。

### Release assets
Each GitHub Release includes the ZIP package and changelog.

## 🚀 Features

- **Right-click Context Menu**: Add/remove vocabulary and toggle page translation
- **Smart Translation**: Only translates selected unfamiliar words
- **Local Storage**: Maintains personal vocabulary with 500-item limit
- **Non-disruptive**: Preserves original reading experience

## 📦 Installation

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/xzy818/mini-translate.git
   cd mini-translate
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run tests and validation:
   ```bash
   npm run validate
   ```

4. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` directory（请先执行上文打包步骤，`dist/` 中已包含运行所需的 `src/` 代码副本）

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

### Code Quality
```bash
# Lint check
npm run lint

# Fix linting issues
npm run lint:fix

# Full validation
npm run validate
```

## 🔧 Development

### Project Structure
```
mini-translate/
├── public/                 # Chrome extension files
│   ├── manifest.json      # Extension manifest
│   ├── background.js      # Background service worker
│   └── content.js         # Content script
├── src/services/          # Core business logic
│   ├── dom.js            # DOM manipulation helpers
│   └── vocab-core.js     # Vocabulary management
├── tests/                 # Test files
│   ├── dom.test.js       # DOM helpers tests
│   ├── vocab-core.test.js # Vocabulary tests
│   └── integration.test.js # Integration tests
└── docs/                  # Documentation
    ├── prd.md            # Product requirements
    ├── architecture.md   # Technical architecture
    └── stories/          # User stories
```

### CI/CD Pipeline

The project includes comprehensive CI/CD pipelines:

- **CI Pipeline** (`.github/workflows/ci.yml`):
  - ESLint static analysis
  - Unit tests across Node.js 18, 20, 21
  - Integration tests
  - Build verification
  - Quality gate

- **PR Check** (`.github/workflows/pr-check.yml`):
  - Automated quality checks on pull requests
  - PR comments with test results

- **Release Pipeline** (`.github/workflows/release.yml`):
  - Automated releases on version tags
  - Extension package creation

## 📋 Stories

### Story S1: Context Menu & Page Translation
- Right-click menu for adding/removing vocabulary
- Page translation toggle functionality
- Background script state management

### Story S2: Vocabulary Storage & Management
- Chrome storage.local integration
- 500-item vocabulary limit
- CRUD operations with deduplication

## 🎯 Quality Metrics

- **Test Coverage**: 100% for core services
- **Total Tests**: 22 tests across 5 files
- **Code Quality**: ESLint compliant
- **Manifest**: Chrome Manifest V3 compliant

## 📄 License

ISC License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow ESLint configuration
- Write tests for new features
- Ensure all tests pass before submitting PR
- Update documentation as needed

## 🔗 Links

- [GitHub Repository](https://github.com/xzy818/mini-translate)
- [Issues](https://github.com/xzy818/mini-translate/issues)
- [Chrome Web Store](https://chrome.google.com/webstore) (Coming soon)
