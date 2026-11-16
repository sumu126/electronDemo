import { describe, expect, it } from 'vitest';
import {
  resolveCloseAction,
  resolveLoadTarget,
  resolveWindowBackgroundColor,
  resolveWindowIconCandidates,
} from './window-policy';

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

describe('resolveWindowBackgroundColor', () => {
  it('显式主题优先于系统配色', () => {
    expect(resolveWindowBackgroundColor('dark', false)).toBe('#16181d');
    expect(resolveWindowBackgroundColor('light', true)).toBe('#f5f5f5');
  });

  it('auto 与未配置时跟随系统配色', () => {
    expect(resolveWindowBackgroundColor('auto', true)).toBe('#16181d');
    expect(resolveWindowBackgroundColor('auto', false)).toBe('#f5f5f5');
    expect(resolveWindowBackgroundColor(undefined, true)).toBe('#16181d');
  });
});

describe('resolveWindowIconCandidates', () => {
  it('Linux 优先 PNG，其它平台优先 ICO', () => {
    expect(resolveWindowIconCandidates('linux')[0]).toBe('assets/icon.png');
    expect(resolveWindowIconCandidates('win32')[0]).toBe('assets/icon.ico');
  });
});
