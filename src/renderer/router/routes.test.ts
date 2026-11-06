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
});
