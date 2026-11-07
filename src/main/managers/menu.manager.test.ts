import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMenuTemplate } from './menu.manager';

const setApplicationMenu = vi.hoisted(() => vi.fn());
const buildFromTemplate = vi.hoisted(() => vi.fn((template) => template));

vi.mock('electron', () => ({
  Menu: { setApplicationMenu, buildFromTemplate },
}));

const flatten = (template: unknown[]): string => JSON.stringify(template);

beforeEach(() => {
  setApplicationMenu.mockReset();
  buildFromTemplate.mockClear();
});

describe('buildMenuTemplate', () => {
  it('关闭开发者工具时不包含 toggleDevTools', () => {
    const template = buildMenuTemplate({ allowDevTools: false, platform: 'win32' });

    expect(flatten(template)).not.toContain('toggleDevTools');
    expect(flatten(template)).toContain('editMenu');
    expect(flatten(template)).toContain('windowMenu');
  });

  it('开启后包含 toggleDevTools', () => {
    const template = buildMenuTemplate({ allowDevTools: true, platform: 'win32' });

    expect(flatten(template)).toContain('toggleDevTools');
  });

  it('macOS 才加 appMenu，保证系统快捷键可用', () => {
    const mac = flatten(buildMenuTemplate({ allowDevTools: false, platform: 'darwin' }));
    const win = flatten(buildMenuTemplate({ allowDevTools: false, platform: 'win32' }));

    expect(mac).toContain('appMenu');
    expect(win).not.toContain('appMenu');
  });
});
