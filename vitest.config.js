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
      '**/tests/run-comprehensive-tests.js'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test-reports/',
        'scripts/',
        'tests/setup-*.js',
        'tests/*e2e*.test.js',
        'tests/complete-user-flow-e2e*.test.js',
        'tests/e2e-config-flow.test.js',
        'tests/run-local-e2e-tests.js',
        'tests/run-comprehensive-tests.js'
      ]
    },
    testTimeout: 30000, // 30秒超时，支持真实 API 测试
    hookTimeout: 30000
  }
});