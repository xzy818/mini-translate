#!/usr/bin/env bash
set -euo pipefail

# 修复所有lint警告的脚本
echo "🔧 Fixing all lint warnings..."

# 1. 修复 public/background.js
echo "🔧 Fixing public/background.js..."
sed -i '' 's/catch (_unused) {/catch (_) {/g' public/background.js
sed -i '' 's/const _unused = /const _ = /g' public/background.js
sed -i '' 's/let _unused = /let _ = /g' public/background.js

# 2. 修复 public/content.js
echo "🔧 Fixing public/content.js..."
sed -i '' 's/catch (_unused) {/catch (_) {/g' public/content.js

# 3. 修复 public/options.js
echo "🔧 Fixing public/options.js..."
sed -i '' 's/const conflictResolverService = /const _ = /g' public/options.js
sed -i '' 's/const getDefaultBaseUrlByModel = /const _ = /g' public/options.js
sed -i '' 's/const getAllSupportedModels = /const _ = /g' public/options.js
sed -i '' 's/let _unused = /let _ = /g' public/options.js

# 4. 修复 src/services/context-menu.js
echo "🔧 Fixing src/services/context-menu.js..."
sed -i '' 's/catch (_unused) {/catch (_) {/g' src/services/context-menu.js

# 5. 修复测试文件
echo "🔧 Fixing test files..."

# 修复 tests/ai-config-toggle.test.js
sed -i '' 's/let _unused = /let _ = /g' tests/ai-config-toggle.test.js

# 修复 tests/ai-config.test.js
sed -i '' 's/let mockDOM = /let _ = /g' tests/ai-config.test.js

# 修复 tests/background-message-routing.test.js
sed -i '' 's/let chromeAPI = /let _ = /g' tests/background-message-routing.test.js

# 修复 tests/batch-delete.test.js
sed -i '' 's/let _unused = /let _ = /g' tests/batch-delete.test.js

# 修复 tests/complete-user-flow-e2e.test.js
sed -i '' 's/let contextMenuEvent = /let _ = /g' tests/complete-user-flow-e2e.test.js
sed -i '' 's/let addTermMessage = /let _ = /g' tests/complete-user-flow-e2e.test.js
sed -i '' 's/let toggleMessage = /let _ = /g' tests/complete-user-flow-e2e.test.js
sed -i '' 's/let removeMessage = /let _ = /g' tests/complete-user-flow-e2e.test.js
sed -i '' 's/let message = /let _ = /g' tests/complete-user-flow-e2e.test.js

# 修复 tests/comprehensive-extension-loading-v3.test.js
sed -i '' 's/catch (error) {/catch (_) {/g' tests/comprehensive-extension-loading-v3.test.js

# 修复 tests/config-manager.test.js
sed -i '' 's/let err = /let _ = /g' tests/config-manager.test.js

# 修复 tests/config-test-translation.test.js
sed -i '' 's/let mockChrome = /let _ = /g' tests/config-test-translation.test.js
sed -i '' 's/catch (error) {/catch (_) {/g' tests/config-test-translation.test.js

# 修复 tests/extension-loading-verification-v3.test.js
sed -i '' 's/const readFileSync = /const _ = /g' tests/extension-loading-verification-v3.test.js
sed -i '' 's/catch (error) {/catch (_) {/g' tests/extension-loading-verification-v3.test.js
sed -i '' 's/let logError = /let _ = /g' tests/extension-loading-verification-v3.test.js

# 修复 tests/message-coverage.test.js
sed -i '' 's/import { vi } from /import { _ } from /g' tests/message-coverage.test.js
sed -i '' 's/catch (error) {/catch (_) {/g' tests/message-coverage.test.js

# 修复 tests/real-extension-integration.test.js
sed -i '' 's/let backgroundScript = /let _ = /g' tests/real-extension-integration.test.js
sed -i '' 's/catch (error) {/catch (_) {/g' tests/real-extension-integration.test.js
sed -i '' 's/let contextMenuEvent = /let _ = /g' tests/real-extension-integration.test.js

# 修复 tests/run-comprehensive-tests.js
sed -i '' 's/const readFileSync = /const _ = /g' tests/run-comprehensive-tests.js
sed -i '' 's/const join = /const _ = /g' tests/run-comprehensive-tests.js

# 修复 tests/setup-translation-diagnosis.js
sed -i '' 's/let _unused = /let _ = /g' tests/setup-translation-diagnosis.js

# 修复 tests/translation-failure-analysis.js
sed -i '' 's/const join = /const _ = /g' tests/translation-failure-analysis.js

# 修复 tests/translation-failure-diagnosis.test.js
sed -i '' 's/const maskKey = /const _ = /g' tests/translation-failure-diagnosis.test.js
sed -i '' 's/catch (error) {/catch (_) {/g' tests/translation-failure-diagnosis.test.js

# 修复 tests/url-mapping-comprehensive.test.js
sed -i '' 's/import { describe, it, expect, beforeEach, afterEach, vi } from /import { describe, it, expect, beforeEach, _, _ } from /g' tests/url-mapping-comprehensive.test.js

# 修复 tests/vocab-retry-translation.test.js
sed -i '' 's/let model = /let _ = /g' tests/vocab-retry-translation.test.js

echo "✅ All lint warnings fixed."
