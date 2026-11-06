import { createRouter, createWebHashHistory } from 'vue-router';
import { routes } from './routes';

/**
 * 使用 hash 模式：打包后通过 file:// 加载 index.html，history 模式会 404。
 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
