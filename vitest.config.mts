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
      // 基线门禁：实测 statements 51.58% / branches 55.24% / functions 47.57% / lines 52.13%，
      // 取略低于基线的值防止覆盖率倒退；补测试后逐步上调
      thresholds: {
        statements: 49,
        branches: 52,
        functions: 45,
        lines: 49,
      },
    },
  },
});
