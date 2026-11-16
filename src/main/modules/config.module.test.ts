import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigModule } from './config.module';

const state = vi.hoisted(() => ({
  appName: 'test-app',
  appVersion: '9.9.9',
}));

vi.mock('electron', () => ({
  app: {
    getName: () => state.appName,
    getVersion: () => state.appVersion,
  },
}));

vi.mock('../utils/app-logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('ConfigModule', () => {
  let dir: string;
  let envPath: string;
  const previousEnvFile = process.env.ELECTRON_ENV_FILE;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'config-module-'));
    envPath = join(dir, '.env');
    process.env.ELECTRON_ENV_FILE = envPath;
  });

  afterEach(() => {
    if (previousEnvFile === undefined) {
      delete process.env.ELECTRON_ENV_FILE;
    } else {
      process.env.ELECTRON_ENV_FILE = previousEnvFile;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  const createModule = async (content?: string) => {
    if (content !== undefined) {
      writeFileSync(envPath, content, 'utf-8');
    }

    const module = new ConfigModule();
    await module.init();
    return module;
  };

  it('从 .env 读取完整配置，并带上真实应用名与版本', async () => {
    const module = await createModule(
      [
        'APP_NAME=Demo',
        'THEME=dark',
        'LANGUAGE=en-US',
        'WINDOW_WIDTH=1000',
        'WINDOW_HEIGHT=700',
        'WINDOW_X=10',
        'WINDOW_Y=20',
        'WINDOW_MAXIMIZED=true',
        'FEATURE_DEVELOPER_TOOLS=true',
        'TRAY_BALLOON_NOTIFICATION_ENABLED=true',
        'SECURITY_SANDBOX_ENABLED=false',
      ].join('\n'),
    );

    const config = module.getConfig();
    expect(config.appName).toBe('Demo');
    expect(config.version).toBe('9.9.9');
    expect(config.theme).toBe('dark');
    expect(config.language).toBe('en-US');
    expect(config.window).toEqual({
      width: 1000,
      height: 700,
      x: 10,
      y: 20,
      maximized: true,
    });
    expect(config.features.developerTools).toBe(true);
    expect(config.tray.balloonNotificationEnabled).toBe(true);
    expect(config.security.sandboxEnabled).toBe(false);
  });

  it('.env 不存在时使用默认值', async () => {
    const module = await createModule();

    const config = module.getConfig();
    expect(config.appName).toBe('test-app');
    expect(config.version).toBe('9.9.9');
    expect(config.theme).toBe('auto');
    expect(config.security.sandboxEnabled).toBe(true);
  });

  it('非法值回退到默认值，不阻断启动', async () => {
    const module = await createModule(
      ['THEME=blue', 'WINDOW_WIDTH=abc', 'SECURITY_SANDBOX_ENABLED=maybe'].join('\n'),
    );

    const config = module.getConfig();
    expect(config.theme).toBe('auto');
    expect(config.window.width).toBe(1200);
    expect(config.security.sandboxEnabled).toBe(true);
  });

  it('getValue 支持键路径', async () => {
    const module = await createModule('WINDOW_WIDTH=1280');

    expect(module.getValue<number>('window.width')).toBe(1280);
    expect(module.getValue<unknown>('window.unknown')).toBeUndefined();
  });

  it('只声明 config:get 通道，运行时不可写', async () => {
    const module = await createModule();

    expect(module.ipcHandlers().map((item) => item.channel)).toEqual(['config:get']);
  });
});
