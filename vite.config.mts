import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { builtinModules } from 'module';

const rootDir = dirname(fileURLToPath(import.meta.url));

// 渲染进程配置
const rendererConfig = defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': join(rootDir, 'src/renderer'),
      '@shared': join(rootDir, 'src/shared'),
      '@main': join(rootDir, 'src/main'),
      '@preload': join(rootDir, 'src/preload'),
    },
  },
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
});

// 主进程配置
const mainConfig = defineConfig({
  resolve: {
    alias: {
      '@shared': join(rootDir, 'src/shared'),
      '@main': join(rootDir, 'src/main'),
      '@preload': join(rootDir, 'src/preload'),
    },
  },
  build: {
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
      input: {
        main: join(rootDir, 'src/main/index.ts'),
        preload: join(rootDir, 'src/preload/index.ts'),
      },
      output: {
        format: 'cjs',
        entryFileNames: '[name].cjs',
      },
    },
    outDir: 'dist-electron',
    emptyOutDir: true,
  },
});

// 合并配置
export default ({ mode }: { mode: string }) => {
  if (mode === 'electron') {
    return mainConfig;
  }
  return rendererConfig;
};