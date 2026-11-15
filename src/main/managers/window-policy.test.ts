import { describe, expect, it } from 'vitest';
import { createWindowStateSnapshot, resolveCloseAction, resolveLoadTarget } from './window-policy';

describe('resolveCloseAction', () => {
  it('正常关闭且托盘可用时藏到托盘', () => {
    expect(resolveCloseAction({ quitting: false, trayAvailable: true })).toBe('hide');
  });

  it('退出流程中直接关闭', () => {
    expect(resolveCloseAction({ quitting: true, trayAvailable: true })).toBe('close');
  });

  it('托盘不可用时直接关闭（否则窗口藏起来无法唤回）', () => {
    expect(resolveCloseAction({ quitting: false, trayAvailable: false })).toBe('close');
  });
});

describe('resolveLoadTarget', () => {
  it('开发态加载本地 Vite 服务', () => {
    expect(
      resolveLoadTarget({
        isDevelopment: true,
        devServerUrl: 'http://localhost:5173',
        resourcesPath: '/opt/app/resources',
      }),
    ).toEqual({ kind: 'url', url: 'http://localhost:5173' });
  });

  it('打包态加载 resources/dist/index.html', () => {
    const target = resolveLoadTarget({
      isDevelopment: false,
      devServerUrl: 'http://localhost:5173',
      resourcesPath: '/opt/app/resources',
    });

    expect(target.kind).toBe('file');
    if (target.kind === 'file') {
      expect(target.file.replace(/\\/g, '/')).toBe('/opt/app/resources/dist/index.html');
    }
  });
});

describe('createWindowStateSnapshot', () => {
  it('把窗口 bounds 与最大化状态映射成配置', () => {
    expect(createWindowStateSnapshot({ width: 1200, height: 800, x: 10, y: 20 }, true)).toEqual({
      width: 1200,
      height: 800,
      x: 10,
      y: 20,
      maximized: true,
    });
  });
});
