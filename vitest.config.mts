import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src/renderer', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      // 只统计 TS：组件暂无测试，且 html reporter 无法解析 .vue 源码
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/renderer/env.d.ts'],
      // 基线门禁：当前实测 statements 29.77% / branches 37.19% / functions 20% / lines 30.05%，
      // 取略低于基线的值防止覆盖率倒退；补测试后逐步上调
      thresholds: {
        statements: 27,
        branches: 34,
        functions: 18,
        lines: 27,
      },
    },
  },
});
