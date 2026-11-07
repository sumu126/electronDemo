import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { builtinModules } from 'module';

const rootDir = dirname(fileURLToPath(import.meta.url));

// 只在开发服务器上放行 Vite 的 HMR WebSocket；构建产物保持 connect-src 'self'
const devCspPlugin: Plugin = {
  name: 'dev-csp-websocket',
  apply: 'serve',
  transformIndexHtml(html: string): string {
    return html.replace("connect-src 'self'", "connect-src 'self' ws://localhost:5173");
  },
};

// 渲染进程配置
const rendererConfig = defineConfig({
  plugins: [vue(), devCspPlugin],
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
  build: {
    rollupOptions: {
      output: {
        // 框架层依赖单独成块：业务代码改动时这几块的 hash 不变，便于命中缓存
        // Vite 8（rolldown）要求 manualChunks 为函数形式
        manualChunks: (id: string) => {
          if (/[\\/]node_modules[\\/](vue|vue-router|pinia|@vue)[\\/]/.test(id)) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
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
    // 主进程跑在 Node 环境：必须走 SSR 构建，否则 Vite 会把 `process.env` 替换成 {}
    // （表现为代码里 process.env.XXX 永远是 undefined，而且不报错）
    ssr: true,
    rollupOptions: {
      external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
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
