import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // 组件测试需要编译 .vue
  plugins: [vue()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src/renderer', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // 默认 node 环境；组件测试用文件头的 @vitest-environment jsdom 声明
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/renderer/env.d.ts'],
      // 基线门禁：实测 statements 48.09% / branches 47.8% / functions 43.64% / lines 48.58%，
      // 取略低于基线的值防止覆盖率倒退；补测试后逐步上调
      thresholds: {
        statements: 46,
        branches: 45,
        functions: 42,
        lines: 46,
      },
    },
  },
});
