import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  calls: [] as string[],
  appHandlers: new Map<string, (...args: any[]) => void>(),
  windows: [] as any[],
  menuOptions: null as null | { allowDevTools: boolean },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(async () => undefined),
  },
  configModule: {
    name: 'ConfigModule',
    getValue: vi.fn(() => false),
  },
}));

vi.mock('electron', () => ({
  app: {
    whenReady: vi.fn(async () => {
      hoisted.calls.push('ready');
    }),
    getPath: vi.fn(() => '/tmp/user-data'),
    getVersion: vi.fn(() => '1.0.0'),
    getName: vi.fn(() => 'test-app'),
    setAppUserModelId: vi.fn(),
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      hoisted.appHandlers.set(event, handler);
    }),
    quit: vi.fn(() => {
      hoisted.calls.push('quit');
    }),
  },
  BrowserWindow: { getAllWindows: () => hoisted.windows },
  ipcMain: {},
  session: {
    defaultSession: {
      setPermissionRequestHandler: vi.fn(() => {
        hoisted.calls.push('permissionRequest');
      }),
      setPermissionCheckHandler: vi.fn(() => {
        hoisted.calls.push('permissionCheck');
      }),
    },
  },
}));

vi.mock('./utils/app-logger', () => ({
  initLogger: vi.fn(() => hoisted.logger),
  getLogger: vi.fn(() => hoisted.logger),
}));

vi.mock('./managers/window.manager', () => ({
  WindowManager: class {
    setConfigModule = vi.fn(() => {
      hoisted.calls.push('setConfigModule');
    });
    createMainWindow = vi.fn(() => {
      hoisted.calls.push('createMainWindow');
      return {};
    });
    markQuitting = vi.fn();
    destroyTray = vi.fn();
    resetQuitting = vi.fn();
    getMainWindow = vi.fn(() => null);
  },
}));

vi.mock('./ipc-manager/ipc.manager', () => ({
  IpcManager: class {
    setupHandlers = vi.fn(() => {
      hoisted.calls.push('ipcSetup');
    });
  },
}));

vi.mock('./managers/module.manager', () => ({
  ModuleManager: class {
    init = vi.fn(async () => {
      hoisted.calls.push('modulesInit');
    });
    getModule = vi.fn((_name: string, guard: (module: unknown) => boolean) => {
      hoisted.calls.push('getModule');
      return guard(hoisted.configModule) ? hoisted.configModule : undefined;
    });
    destroy = vi.fn(async () => {
      hoisted.calls.push('modulesDestroy');
    });
  },
}));

vi.mock('./modules/config.module', () => ({
  isConfigModule: (value: unknown): value is { name: string } =>
    Boolean(value && (value as { name?: string }).name === 'ConfigModule'),
}));

vi.mock('./managers/menu.manager', () => ({
  applyApplicationMenu: vi.fn((options: { allowDevTools: boolean }) => {
    hoisted.menuOptions = options;
    hoisted.calls.push('menu');
  }),
}));

import { App } from './app';

beforeEach(() => {
  hoisted.calls.length = 0;
  hoisted.appHandlers.clear();
  hoisted.windows.length = 0;
  hoisted.menuOptions = null;
  hoisted.logger.info.mockClear();
  hoisted.logger.warn.mockClear();
  hoisted.logger.error.mockClear();
  hoisted.logger.flush.mockClear();
  hoisted.configModule.getValue.mockReset();
  hoisted.configModule.getValue.mockReturnValue(false);
});

describe('App 启动链路', () => {
  it('按固定顺序完成启动：模块 → 配置注入 → IPC → 权限 → 菜单 → 建窗', async () => {
    const instance = new App();
    await instance.init();

    expect(hoisted.calls).toEqual([
      'ready',
      'modulesInit',
      'getModule',
      'setConfigModule',
      'ipcSetup',
      'permissionRequest',
      'permissionCheck',
      'menu',
      'createMainWindow',
    ]);
    expect(hoisted.menuOptions).toEqual({ allowDevTools: false });
    expect(hoisted.logger.info).toHaveBeenCalledWith(
      'Startup completed',
      expect.objectContaining({ total: expect.any(Number) }),
    );
  });

  it('菜单的开发者工具项跟随配置开关', async () => {
    hoisted.configModule.getValue.mockReturnValue(true);

    await new App().init();

    expect(hoisted.menuOptions).toEqual({ allowDevTools: true });
  });

  it('退出时先销毁模块并 flush，再 quit', async () => {
    const instance = new App();
    await instance.init();

    const beforeQuit = hoisted.appHandlers.get('before-quit');
    const event = { preventDefault: vi.fn() };
    beforeQuit?.(event);

    expect(event.preventDefault).toHaveBeenCalled();
    await vi.waitFor(() => expect(hoisted.calls).toContain('quit'));
    expect(hoisted.calls).toContain('modulesDestroy');
    expect(hoisted.calls.indexOf('modulesDestroy')).toBeLessThan(hoisted.calls.indexOf('quit'));
    expect(hoisted.logger.flush).toHaveBeenCalled();
  });

  it('非 macOS 上所有窗口关闭后退出', async () => {
    await new App().init();

    hoisted.appHandlers.get('window-all-closed')?.();

    if (process.platform !== 'darwin') {
      expect(hoisted.calls).toContain('quit');
    }
  });

  it('无窗口时 activate 会重建主窗口', async () => {
    await new App().init();
    hoisted.calls.length = 0;
    hoisted.windows.length = 0;

    hoisted.appHandlers.get('activate')?.();

    expect(hoisted.calls).toContain('createMainWindow');
  });
});
