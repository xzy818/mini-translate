# Mini Translate Chrome Extension

A mini translation plugin for Chrome that preserves the reading experience and only translates a few unfamiliar words.

## Purpose

This project explores AI-assisted development, the BMAD development workflow, and software engineering practices such as UI automation testing.

## Icon

Blue "MT" lettermark on a white rounded square (generated via `scripts/generate-mt-icons-sharp.js`):

<p>
  <img src="public/icons/icon-128.png" alt="Mini Translate Icon" width="128" height="128"/>
  <br/>
  <em>Vector source: public/icons/icon.svg</em>
  <br/>
  <a href="./README.zh.md">中文说明</a>
  ·
  <a href="./README.md">Language selection</a>
</p>

## Models & Settings

Supported models are provided dynamically via the Settings page (default: `qwen-mt-turbo`). See `docs/SUPPORTED_MODELS.md` for the full list.

Settings fields:
- Model (select)
- API Base URL (builtin, no user configuration required)
- API Key (masked, toggle show/hide)

Notes:
- MV3 background has built-in mappings for provider domains and endpoints. With proper host permissions, requests go directly without custom Base URL or proxies.
- If your network policy blocks direct calls, you may configure a proxy, but it is not required by default.

## Vocabulary Limit & Import/Export

- Max items: 500 (adding/import beyond the limit is prevented with an alert)
- Import: TXT (one term per line), JSON (see `docs/vocabulary-spec.md`) with per-line errors
- Export: TXT (sorted by created time), JSON `{ version, exportedAt, items }`
- Exported JSON can be re-imported for backup and migration

## Build & Release

### Local package
Run `bash scripts/build-zip.sh` to produce `dist/` and `mini-translate-extension.zip`.

### Load in Chrome (Development)
- Open Chrome and go to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked" and select the `dist/` directory (after build; `dist/` contains the required `src/` modules for MV3)

### Release assets
Each GitHub Release includes the ZIP package and changelog.

## 🚀 Features

- Right-click Context Menu: Add/remove vocabulary and toggle page translation
- Smart Translation: Only translates selected unfamiliar words
- Local Storage: Keeps personal vocabulary with a 500-item limit
- Non-disruptive: Preserves the original reading experience

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

4. Load the unpacked extension in Chrome (see above)

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

### CI/CD Pipeline

The project includes comprehensive CI/CD pipelines:

- CI Pipeline: ESLint, unit/integration tests, build verification, quality gate
- PR Check: Automated quality checks and PR comments
- Release Pipeline: Automated releases on version tags, extension package creation


## 📄 License

ISC License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🔗 Links

- GitHub Repository: `https://github.com/xzy818/mini-translate`
- Issues: `https://github.com/xzy818/mini-translate/issues`


