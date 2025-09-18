# Mini Translate Chrome Extension

A mini translation plugin developed for Chrome that does not disrupt the reading experience and only translates a few unfamiliar words.

## Icon

Blue double-arrow icon used by the extension:

<p>
  <img src="public/icons/icon-128.png" alt="Mini Translate Icon" width="128" height="128"/>
  <br/>
  <em>Vector source: public/icons/icon.svg</em>
</p>

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
   - Click "Load unpacked" and select the `public/` directory

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
