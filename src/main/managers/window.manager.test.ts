import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nativeImage } from 'electron';
import { WindowManager } from './window.manager';
import type { ConfigModule } from '../modules/config.module';
import type { WindowConfig } from '@shared/types';

const hoisted = vi.hoisted(() => ({
  windows: [] as any[],
  trays: [] as any[],
  openExternal: vi.fn(),
}));

vi.mock('electron', () => {
  class EventHub {
    private handlers = new Map<string, Array<{ fn: (...args: any[]) => void; once: boolean }>>();

    on(event: string, fn: (...args: any[]) => void): void {
      const list = this.handlers.get(event) ?? [];
      list.push({ fn, once: false });
      this.handlers.set(event, list);
    }

    once(event: string, fn: (...args: any[]) => void): void {
      const list = this.handlers.get(event) ?? [];
      list.push({ fn, once: true });
      this.handlers.set(event, list);
    }

    emit(event: string, ...args: unknown[]): void {
      for (const entry of [...(this.handlers.get(event) ?? [])]) {
        entry.fn(...args);
        if (entry.once) {
          this.handlers.set(
            event,
            (this.handlers.get(event) ?? []).filter((item) => item !== entry),
          );
        }
      }
    }
  }

  class FakeBrowserWindow extends EventHub {
    static getAllWindows(): unknown[] {
      return hoisted.windows;
    }

    public readonly options: Record<string, unknown>;
    public readonly webContents = Object.assign(new EventHub(), {
      setWindowOpenHandler: vi.fn(),
      openDevTools: vi.fn(),
      closeDevTools: vi.fn(),
    });
    public destroyed = false;
    public show = vi.fn();
    public hide = vi.fn();
    public maximize = vi.fn();
    public isMaximized = vi.fn(() => false);
    public isDestroyed = vi.fn(() => this.destroyed);
    public getNormalBounds = vi.fn(() => ({ x: 10, y: 20, width: 1000, height: 700 }));
    public loadFile = vi.fn();
    public loadURL = vi.fn();

    constructor(options: Record<string, unknown>) {
      super();
      this.options = options;
      hoisted.windows.push(this);
    }
  }

  class FakeTray extends EventHub {
    public setToolTip = vi.fn();
    public setContextMenu = vi.fn();
    public destroy = vi.fn();
    public displayBalloon = vi.fn();

    constructor(public readonly image: unknown) {
      super();
      hoisted.trays.push(this);
    }
  }

  return {
    BrowserWindow: FakeBrowserWindow,
    Tray: FakeTray,
    screen: {
      getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }),
      getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
    },
    Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
    nativeImage: { createFromPath: vi.fn(() => ({ isEmpty: () => false })) },
    nativeTheme: { shouldUseDarkColors: false },
    app: {
      getAppPath: () => process.cwd(),
      getName: () => 'test-app',
      getVersion: () => '1.0.0',
    },
    shell: { openExternal: hoisted.openExternal },
  };
});

vi.mock('../utils/app-logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

type FakeWindow = {
  options: Record<string, unknown>;
  webContents: {
    emit: (event: string, ...args: unknown[]) => void;
    setWindowOpenHandler: ReturnType<typeof vi.fn>;
    closeDevTools: ReturnType<typeof vi.fn>;
  };
  show: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
  maximize: ReturnType<typeof vi.fn>;
  isMaximized: ReturnType<typeof vi.fn>;
  getNormalBounds: ReturnType<typeof vi.fn>;
  loadFile: ReturnType<typeof vi.fn>;
  loadURL: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
};

interface ConfigOptions {
  window?: WindowConfig;
  theme?: 'light' | 'dark' | 'auto';
  developerTools?: boolean;
  balloon?: boolean;
  firstTimeNoticeShown?: boolean;
}

const createConfig = (options: ConfigOptions = {}) => ({
  getValue: vi.fn((key: string) => {
    switch (key) {
      case 'window':
        return options.window ?? { width: 1000, height: 700, x: 100, y: 100, maximized: false };
      case 'theme':
        return options.theme ?? 'light';
      case 'language':
        return 'zh-CN';
      case 'features.developerTools':
        return options.developerTools ?? false;
      case 'tray.balloonNotificationEnabled':
        return options.balloon ?? false;
      case 'tray.hasShownFirstTimeNotice':
        return options.firstTimeNoticeShown ?? false;
      default:
        return undefined;
    }
  }),
  updateConfig: vi.fn(async () => undefined),
  setValue: vi.fn(async () => undefined),
});

const createManager = (config: ReturnType<typeof createConfig>) => {
  const manager = new WindowManager();
  manager.setConfigModule(config as unknown as ConfigModule);
  const window = manager.createMainWindow() as unknown as FakeWindow;
  return { manager, window };
};

beforeEach(() => {
  hoisted.windows.length = 0;
  hoisted.trays.length = 0;
  hoisted.openExternal.mockClear();
  vi.mocked(nativeImage.createFromPath).mockReturnValue({ isEmpty: () => false } as never);
  // Node 测试环境没有 Electron 注入的这两个值，补成打包态
  Object.defineProperty(process, 'defaultApp', { configurable: true, value: false });
  Object.defineProperty(process, 'resourcesPath', { configurable: true, value: process.cwd() });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WindowManager 窗口事件', () => {
  it('首帧就绪后显示窗口，最大化状态按配置恢复', () => {
    const config = createConfig({ window: { width: 1000, height: 700, maximized: true } });
    const { window } = createManager(config);

    window.emit('ready-to-show');

    expect(window.maximize).toHaveBeenCalled();
    expect(window.show).toHaveBeenCalled();
    expect(window.options.width).toBe(1000);
    expect(window.options.backgroundColor).toBe('#f5f5f5');
  });

  it('加载失败时兜底显示窗口', () => {
    const { window } = createManager(createConfig());

    window.webContents.emit('did-fail-load');

    expect(window.show).toHaveBeenCalled();
  });

  it('关闭时藏到托盘、阻止默认关闭并立即落盘窗口状态', async () => {
    const config = createConfig();
    const { window } = createManager(config);
    const event = { preventDefault: vi.fn() };

    window.emit('close', event);
    await vi.waitFor(() => expect(config.setValue).toHaveBeenCalled());

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.hide).toHaveBeenCalled();
    expect(hoisted.trays).toHaveLength(1);
    expect(config.updateConfig).toHaveBeenCalledWith({
      window: { width: 1000, height: 700, x: 10, y: 20, maximized: false },
    });
  });

  it('退出流程中不再拦截关闭', () => {
    const { manager, window } = createManager(createConfig());
    const event = { preventDefault: vi.fn() };

    manager.markQuitting();
    window.emit('close', event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('托盘图标不可解码时允许直接关闭，避免窗口藏起来无法唤回', () => {
    vi.mocked(nativeImage.createFromPath).mockReturnValue({ isEmpty: () => true } as never);
    const { window } = createManager(createConfig());
    const event = { preventDefault: vi.fn() };

    window.emit('close', event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(hoisted.trays).toHaveLength(0);
  });

  it('resize 防抖 300ms 后落盘，期间的连续事件只写一次', () => {
    vi.useFakeTimers();
    const config = createConfig();
    const { window } = createManager(config);

    window.emit('resize');
    window.emit('resize');
    vi.advanceTimersByTime(299);
    expect(config.updateConfig).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(config.updateConfig).toHaveBeenCalledTimes(1);
  });

  it('窗口真正关闭时取消未执行的防抖计时器', () => {
    vi.useFakeTimers();
    const config = createConfig();
    const { window } = createManager(config);

    window.emit('resize');
    window.emit('closed');
    vi.advanceTimersByTime(300);

    expect(config.updateConfig).not.toHaveBeenCalled();
  });

  it('站外导航被拦截，file:// 应用页面放行', () => {
    const { window } = createManager(createConfig());
    const blocked = { preventDefault: vi.fn() };
    const allowed = { preventDefault: vi.fn() };

    window.webContents.emit('will-navigate', blocked, 'https://evil.example.com/');
    window.webContents.emit('will-navigate', allowed, 'file:///app/resources/dist/index.html');

    expect(blocked.preventDefault).toHaveBeenCalled();
    expect(allowed.preventDefault).not.toHaveBeenCalled();
  });

  it('新窗口一律拒绝，仅 https 外链交给系统浏览器', () => {
    const { window } = createManager(createConfig());
    const handler = window.webContents.setWindowOpenHandler.mock.calls[0][0] as (input: {
      url: string;
    }) => { action: string };

    expect(handler({ url: 'https://example.com' })).toEqual({ action: 'deny' });
    expect(hoisted.openExternal).toHaveBeenCalledWith('https://example.com');

    expect(handler({ url: 'http://example.com' })).toEqual({ action: 'deny' });
    expect(hoisted.openExternal).toHaveBeenCalledTimes(1);
  });

  it('生产态拦截 DevTools 快捷键并关闭已打开的 DevTools', () => {
    const { window } = createManager(createConfig());
    const event = { preventDefault: vi.fn() };

    window.webContents.emit('before-input-event', event, { key: 'F12' });
    expect(event.preventDefault).toHaveBeenCalled();

    window.webContents.emit('devtools-opened');
    expect(window.webContents.closeDevTools).toHaveBeenCalled();
  });

  it('配置允许开发者工具时不注册拦截', () => {
    const { window } = createManager(createConfig({ developerTools: true }));
    const event = { preventDefault: vi.fn() };

    window.webContents.emit('before-input-event', event, { key: 'F12' });
    window.webContents.emit('devtools-opened');

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(window.webContents.closeDevTools).not.toHaveBeenCalled();
  });
});
