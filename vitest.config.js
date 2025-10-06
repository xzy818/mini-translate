import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup-translation-diagnosis.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test-reports/',
        'scripts/',
        'tests/setup-*.js'
      ]
    },
    testTimeout: 30000, // 30秒超时，支持真实 API 测试
    hookTimeout: 30000
  }
});