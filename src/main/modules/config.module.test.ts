import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigModule } from './config.module';

const state = vi.hoisted(() => ({
  dir: '',
  appName: 'test-app',
  appVersion: '9.9.9',
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => state.dir,
    getName: () => state.appName,
    getVersion: () => state.appVersion,
  },
}));

const configPath = () => join(state.dir, 'config.json');
const readConfig = () => JSON.parse(readFileSync(configPath(), 'utf-8'));

const createModule = async () => {
  const module = new ConfigModule();
  await module.init();
  return module;
};

beforeEach(() => {
  state.dir = mkdtempSync(join(tmpdir(), 'config-module-'));
  // 静音配置模块自己的 warn/error
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(state.dir, { recursive: true, force: true });
});

describe('ConfigModule', () => {
  it('首次启动写入默认配置，并带上真实应用名与版本', async () => {
    const module = await createModule();

    const saved = readConfig();
    expect(saved.appName).toBe('test-app');
    expect(saved.version).toBe('9.9.9');
    expect(saved.theme).toBe('auto');
    expect(saved.features).toEqual({ developerTools: false });
    expect(module.getConfig().appName).toBe('test-app');
  });

  it('升级应用后刷新 version 字段（它不是用户配置）', async () => {
    writeFileSync(configPath(), JSON.stringify({ version: '0.0.1', theme: 'dark' }), 'utf-8');

    const module = await createModule();

    expect(module.getConfig().version).toBe('9.9.9');
    expect(readConfig().version).toBe('9.9.9');
    expect(readConfig().theme).toBe('dark');
  });

  it('加载时裁剪未知键，并把原文件备份为 config.json.bak', async () => {
    writeFileSync(
      configPath(),
      JSON.stringify({
        theme: 'dark',
        window: { width: 1000, opacity: 0.5 },
        network: { apiBase: 'http://localhost' },
      }),
      'utf-8',
    );

    await createModule();

    const saved = readConfig();
    expect(saved.theme).toBe('dark');
    expect(saved.window.width).toBe(1000);
    expect(saved.window.opacity).toBeUndefined();
    expect(saved.network).toBeUndefined();

    const backup = JSON.parse(readFileSync(`${configPath()}.bak`, 'utf-8')) as {
      network?: unknown;
    };
    expect(backup.network).toEqual({ apiBase: 'http://localhost' });
  });

  it('updateConfig 拒绝未知键，且不落盘', async () => {
    const module = await createModule();
    const before = readFileSync(configPath(), 'utf-8');

    await expect(module.updateConfig({ theme2: 'dark' })).rejects.toThrow(/theme2/);
    expect(readFileSync(configPath(), 'utf-8')).toBe(before);
  });

  it('updateConfig 深合并，未涉及的字段保持原值', async () => {
    const module = await createModule();
    await module.updateConfig({ theme: 'dark' });
    await module.updateConfig({ window: { width: 1280 } });

    const saved = readConfig();
    expect(saved.theme).toBe('dark');
    expect(saved.window.width).toBe(1280);
    expect(saved.window.height).toBe(800);
    expect(saved.features).toEqual({ developerTools: false });
  });

  it('setValue 走同一套校验并落盘', async () => {
    const module = await createModule();

    await module.setValue('tray.hasShownFirstTimeNotice', true);
    expect(readConfig().tray.hasShownFirstTimeNotice).toBe(true);

    await expect(module.setValue('tray.unknownFlag', true)).rejects.toThrow(/unknownFlag/);
  });

  it('并发更新按调用顺序串行落盘，最终包含全部改动', async () => {
    const module = await createModule();

    await Promise.all([
      module.updateConfig({ theme: 'dark' }),
      module.updateConfig({ language: 'en-US' }),
      module.updateConfig({ features: { developerTools: true } }),
    ]);

    const saved = readConfig();
    expect(saved.theme).toBe('dark');
    expect(saved.language).toBe('en-US');
    expect(saved.features.developerTools).toBe(true);
  });

  it('原子写不留下 .tmp 残留', async () => {
    const module = await createModule();
    await module.updateConfig({ theme: 'light' });

    expect(existsSync(`${configPath()}.tmp`)).toBe(false);
    expect(readConfig().theme).toBe('light');
  });

  it('配置文件损坏时回退到默认值并重写', async () => {
    writeFileSync(configPath(), '{ not json', 'utf-8');

    const module = await createModule();

    expect(module.getConfig().theme).toBe('auto');
    expect(readConfig().appName).toBe('test-app');
  });
});
