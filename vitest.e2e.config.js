import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // E2E 专用配置：不排除 e2e 测试
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/test-reports/**',
      '**/scripts/**',
      '**/tests/setup-*.js'
    ],
    testTimeout: 60000,
    hookTimeout: 60000
  }
});


