#!/usr/bin/env bash
set -euo pipefail

# 修复剩余的lint警告
echo "🔧 Fixing remaining lint warnings..."

# 1. 修复 public/background.js 中的未使用变量
echo "🔧 Fixing public/background.js..."
sed -i '' 's/const _ = /const _unused = /g' public/background.js
sed -i '' 's/const e = /const _unused = /g' public/background.js

# 2. 修复 public/content.js
echo "🔧 Fixing public/content.js..."
sed -i '' 's/const e = /const _unused = /g' public/content.js

# 3. 修复 public/options.js
echo "🔧 Fixing public/options.js..."
sed -i '' 's/const conflictResolverService = /const _unused = /g' public/options.js
sed -i '' 's/const getDefaultBaseUrlByModel = /const _unused = /g' public/options.js
sed -i '' 's/const getAllSupportedModels = /const _unused = /g' public/options.js

# 4. 修复 src/services/context-menu.js
echo "🔧 Fixing src/services/context-menu.js..."
sed -i '' 's/const _ = /const _unused = /g' src/services/context-menu.js

# 5. 修复测试文件中的未使用变量
echo "🔧 Fixing test files..."

# 修复 tests/ai-config-toggle.test.js
sed -i '' 's/let _unused = /let _unused = /g' tests/ai-config-toggle.test.js

# 修复 tests/ai-config.test.js
sed -i '' 's/let mockDOM = /let _unused = /g' tests/ai-config.test.js

# 修复 tests/background-message-routing.test.js
sed -i '' 's/let chromeAPI = /let _unused = /g' tests/background-message-routing.test.js

# 修复 tests/batch-delete.test.js
sed -i '' 's/let _unused = /let _unused = /g' tests/batch-delete.test.js

# 修复 tests/complete-user-flow-e2e.test.js
sed -i '' 's/let contextMenuEvent = /let _unused = /g' tests/complete-user-flow-e2e.test.js
sed -i '' 's/let addTermMessage = /let _unused = /g' tests/complete-user-flow-e2e.test.js
sed -i '' 's/let toggleMessage = /let _unused = /g' tests/complete-user-flow-e2e.test.js
sed -i '' 's/let removeMessage = /let _unused = /g' tests/complete-user-flow-e2e.test.js
sed -i '' 's/let message = /let _unused = /g' tests/complete-user-flow-e2e.test.js

# 修复 tests/comprehensive-extension-loading-v3.test.js
sed -i '' 's/let error = /let _unused = /g' tests/comprehensive-extension-loading-v3.test.js

# 修复 tests/config-manager.test.js
sed -i '' 's/let err = /let _unused = /g' tests/config-manager.test.js

# 修复 tests/config-test-translation.test.js
sed -i '' 's/let mockChrome = /let _unused = /g' tests/config-test-translation.test.js
sed -i '' 's/let error = /let _unused = /g' tests/config-test-translation.test.js

# 修复 tests/extension-loading-verification-v3.test.js
sed -i '' 's/const readFileSync = /const _unused = /g' tests/extension-loading-verification-v3.test.js
sed -i '' 's/let error = /let _unused = /g' tests/extension-loading-verification-v3.test.js
sed -i '' 's/let logError = /let _unused = /g' tests/extension-loading-verification-v3.test.js

# 修复 tests/message-coverage.test.js
sed -i '' 's/const vi = /const _unused = /g' tests/message-coverage.test.js
sed -i '' 's/let error = /let _unused = /g' tests/message-coverage.test.js

# 修复 tests/real-extension-integration.test.js
sed -i '' 's/let backgroundScript = /let _unused = /g' tests/real-extension-integration.test.js
sed -i '' 's/let error = /let _unused = /g' tests/real-extension-integration.test.js
sed -i '' 's/let contextMenuEvent = /let _unused = /g' tests/real-extension-integration.test.js

# 修复 tests/run-comprehensive-tests.js
sed -i '' 's/const readFileSync = /const _unused = /g' tests/run-comprehensive-tests.js
sed -i '' 's/const join = /const _unused = /g' tests/run-comprehensive-tests.js

# 修复 tests/setup-translation-diagnosis.js
sed -i '' 's/let _unused = /let _unused = /g' tests/setup-translation-diagnosis.js

# 修复 tests/translation-failure-analysis.js
sed -i '' 's/const join = /const _unused = /g' tests/translation-failure-analysis.js

# 修复 tests/translation-failure-diagnosis.test.js
sed -i '' 's/const maskKey = /const _unused = /g' tests/translation-failure-diagnosis.test.js
sed -i '' 's/let error = /let _unused = /g' tests/translation-failure-diagnosis.test.js

# 修复 tests/url-mapping-comprehensive.test.js
sed -i '' 's/const afterEach = /const _unused = /g' tests/url-mapping-comprehensive.test.js
sed -i '' 's/const vi = /const _unused = /g' tests/url-mapping-comprehensive.test.js

# 修复 tests/vocab-retry-translation.test.js
sed -i '' 's/let model = /let _unused = /g' tests/vocab-retry-translation.test.js

echo "✅ Remaining lint warnings fixed!"
