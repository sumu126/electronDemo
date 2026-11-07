import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

describe('routes', () => {
  it('根路径映射到 home', () => {
    const router = createRouter({ history: createMemoryHistory(), routes });

    expect(router.resolve('/').name).toBe('home');
  });

  it('首页组件采用懒加载', () => {
    expect(typeof routes[0].component).toBe('function');
  });

  it('未注册的地址落到 404 兜底页', () => {
    const router = createRouter({ history: createMemoryHistory(), routes });

    expect(router.resolve('/no-such-page').name).toBe('not-found');
  });

  it('兜底路由注册在最后，避免吞掉正常页面', () => {
    expect(routes[routes.length - 1].name).toBe('not-found');
  });
});
