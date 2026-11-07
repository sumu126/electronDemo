import type { RouteRecordRaw } from 'vue-router';

/**
 * 页面路由约定：新增页面放在 views/ 下，并在这里注册。
 * 使用懒加载，避免首页之外的页面进入首屏包。
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    // 兜底路由必须最后注册：匹配所有未命中的地址
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
  },
];
