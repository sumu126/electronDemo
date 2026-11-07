import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import { IpcManager } from './ipc.manager';

const fake = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  removed: [] as string[],
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
      fake.handlers.set(channel, listener);
    },
    removeHandler: (channel: string) => {
      fake.removed.push(channel);
      fake.handlers.delete(channel);
    },
  },
  // WindowHandler 只用到静态方法；本文件不触发窗口操作
  BrowserWindow: { getAllWindows: () => [] },
}));

const configStub = {
  getConfig: vi.fn(() => ({ appName: 'app', theme: 'dark' })),
  updateConfig: vi.fn(async () => undefined),
};

const moduleManagerStub = {
  getModule: vi.fn(() => configStub),
};

const createManager = () => new IpcManager(ipcMain as never, moduleManagerStub as never);

const trustedEvent = (url = 'file:///app/resources/dist/index.html') => ({
  senderFrame: { url },
});

const invoke = (channel: string, event: unknown, ...args: unknown[]) => {
  const listener = fake.handlers.get(channel);
  if (!listener) {
    throw new Error(`channel not registered: ${channel}`);
  }
  return listener(event, ...args);
};

const defaultAppDescriptor = Object.getOwnPropertyDescriptor(process, 'defaultApp');

beforeEach(() => {
  fake.handlers.clear();
  fake.removed = [];
  configStub.getConfig.mockClear();
  configStub.updateConfig.mockClear();
  // Node 里没有 process.defaultApp，这里模拟「打包态」：只信任 file://
  Object.defineProperty(process, 'defaultApp', { configurable: true, value: false });
});

afterAll(() => {
  if (defaultAppDescriptor) {
    Object.defineProperty(process, 'defaultApp', defaultAppDescriptor);
  } else {
    delete (process as { defaultApp?: boolean }).defaultApp;
  }
});

describe('IpcManager', () => {
  it('setupHandlers 注册全部已声明通道', () => {
    createManager().setupHandlers();

    expect([...fake.handlers.keys()].sort()).toEqual([
      'config:get',
      'config:update',
      'log:report',
      'ping',
      'system:info',
      'window:close',
      'window:maximize',
      'window:minimize',
    ]);
  });

  it('可信来源可以正常调用', async () => {
    createManager().setupHandlers();

    await expect(invoke('ping', trustedEvent())).resolves.toBe('pong');
  });

  it('不可信来源被拦截，handler 不会执行', () => {
    const manager = createManager();
    const spy = vi.fn(async () => 'should-not-run');
    manager.registerHandler({ channel: 'ping', handler: spy });

    // 来源校验是同步抛错，不会走到 handler
    expect(() => invoke('ping', trustedEvent('https://evil.example.com/'))).toThrow(
      /Blocked IPC call/,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('config:update 把入参透传给 ConfigModule', async () => {
    createManager().setupHandlers();

    await invoke('config:update', trustedEvent(), { theme: 'light' });

    expect(configStub.updateConfig).toHaveBeenCalledWith({ theme: 'light' });
  });

  it('log:report 到达日志处理器（不抛错即视为成功）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createManager().setupHandlers();

    await expect(
      invoke('log:report', trustedEvent(), 'info', 'from renderer'),
    ).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it('unregisterHandler 移除通道', () => {
    const manager = createManager();
    manager.registerHandler({ channel: 'ping', handler: async () => 'pong' });

    manager.unregisterHandler('ping');

    expect(fake.removed).toContain('ping');
    expect(fake.handlers.has('ping')).toBe(false);
  });

  it('缺少 ConfigModule 时 setupHandlers 抛错（核心依赖不可缺失）', () => {
    const brokenManager = new IpcManager(ipcMain as never, { getModule: () => undefined } as never);

    expect(() => brokenManager.setupHandlers()).toThrow(/ConfigModule/);
  });
});
