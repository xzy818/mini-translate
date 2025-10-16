import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup-translation-diagnosis.js'],
    // 排除E2E测试，禁止进入CI
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/test-reports/**',
      '**/scripts/**',
      '**/tests/setup-*.js',
      '**/tests/*e2e*.test.js',
      '**/tests/complete-user-flow-e2e*.test.js',
      '**/tests/e2e-config-flow.test.js',
      '**/tests/run-local-e2e-tests.js',
      '**/tests/run-comprehensive-tests.js',
      // CI 稳定性：排除会拉起 Chrome 或依赖真实浏览器/外部环境的测试
      '**/tests/extension-loading*.test.js',
      '**/tests/comprehensive-extension-loading*.test.js',
      '**/tests/extension-loading-verification*.test.js',
      '**/tests/real-extension-integration.test.js',
      // 排除依赖真实外部 API/易波动诊断类测试（仅在本地运行）
      '**/tests/qwen-key-*.test.js',
      '**/tests/*diagnosis*.test.js',
      '**/tests/config-test-translation.test.js'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'test-reports/',
        'scripts/',
        'docs/**',
        // 排除非 *.test.js 的测试辅助脚本，避免拉低覆盖率
        'tests/**/*.js',
        'tests/setup-*.js',
        'tests/*e2e*.test.js',
        'tests/complete-user-flow-e2e*.test.js',
        'tests/e2e-config-flow.test.js',
        'tests/run-local-e2e-tests.js',
        'tests/run-comprehensive-tests.js',
        'tests/extension-loading*.test.js',
        'tests/comprehensive-extension-loading*.test.js',
        'tests/extension-loading-verification*.test.js',
        'tests/real-extension-integration.test.js',
        'tests/qwen-key-*.test.js',
        'tests/*diagnosis*.test.js',
        'tests/config-test-translation.test.js'
      ]
    },
    testTimeout: 30000, // 30秒超时，支持真实 API 测试
    hookTimeout: 30000
  }
});