import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ModuleManager } from './module.manager';

const state = vi.hoisted(() => ({ userDataDir: '' }));

vi.mock('electron', () => ({
  app: {
    getPath: () => state.userDataDir,
    getName: () => 'test-app',
    getVersion: () => '1.2.3',
  },
}));

let userDataDir: string;

const modulesDir = () => join(userDataDir, 'modules');

const writeModule = (fileName: string, source: string) => {
  writeFileSync(join(modulesDir(), fileName), source, 'utf-8');
};

beforeEach(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'module-manager-'));
  state.userDataDir = userDataDir;
  mkdirSync(modulesDir(), { recursive: true });

  // 主进程产物是 CJS，`createRequire(__filename)` 依赖这个自由变量；ESM 测试环境里补上
  vi.stubGlobal('__filename', join(process.cwd(), 'dist-electron', 'main.cjs'));

  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  rmSync(userDataDir, { recursive: true, force: true });
});

describe('ModuleManager 用户模块（插件）集成', () => {
  it('加载 userData/modules 下的真实模块，并调用 init 与 destroy', async () => {
    writeModule(
      'hello.cjs',
      `const fs = require('fs');
       const path = require('path');
       module.exports = {
         name: 'HelloModule',
         version: '1.0.0',
         async init() { fs.writeFileSync(path.join(__dirname, 'init.txt'), 'ok'); },
         async destroy() { fs.writeFileSync(path.join(__dirname, 'destroy.txt'), 'ok'); },
       };`,
    );

    const manager = new ModuleManager();
    await manager.init();

    expect(manager.getModule('HelloModule')).toBeDefined();
    expect(existsSync(join(modulesDir(), 'init.txt'))).toBe(true);
    // 插件拿不到框架代码，日志入口必须通过全局暴露
    expect((globalThis as { __frameworkLogger?: unknown }).__frameworkLogger).toBeDefined();

    await manager.destroy();

    expect(existsSync(join(modulesDir(), 'destroy.txt'))).toBe(true);
    expect(manager.getModule('HelloModule')).toBeUndefined();
  });

  it('坏模块只隔离自身，不影响其它模块', async () => {
    writeModule('broken.cjs', 'throw new Error("boom");');
    writeModule('invalid.cjs', 'module.exports = { name: 123 };');
    writeModule('good.cjs', "module.exports = { name: 'GoodModule', async init() {} };");

    const manager = new ModuleManager();
    await manager.init();

    expect(manager.getModule('GoodModule')).toBeDefined();
    expect(manager.getModule('BrokenModule')).toBeUndefined();
    expect(manager.getModule('InvalidModule')).toBeUndefined();
  });

  it('工厂函数与 default 导出都能被识别', async () => {
    writeModule(
      'factory.cjs',
      "module.exports = () => ({ name: 'FactoryModule', async init() {} });",
    );
    writeModule(
      'default-export.cjs',
      "module.exports = { default: { name: 'DefaultModule', async init() {} } };",
    );

    const manager = new ModuleManager();
    await manager.init();

    expect(manager.getModule('FactoryModule')).toBeDefined();
    expect(manager.getModule('DefaultModule')).toBeDefined();
  });

  it('目录不存在时静默跳过', async () => {
    rmSync(modulesDir(), { recursive: true, force: true });

    const manager = new ModuleManager();

    await expect(manager.init()).resolves.toBeUndefined();
    expect(manager.getModule('HelloModule')).toBeUndefined();
  });

  it('只收集核心模块的 IPC 贡献，磁盘插件不能注册通道', async () => {
    writeModule(
      'evil.cjs',
      `module.exports = {
         name: 'EvilModule',
         async init() {},
         ipcHandlers() { return [{ channel: 'ping', handler: () => 'hijacked' }]; },
       };`,
    );

    const manager = new ModuleManager();
    await manager.init();

    expect(manager.getModule('EvilModule')).toBeDefined();
    expect(manager.collectIpcHandlers().map((item) => item.channel)).toEqual([
      'config:get',
      'config:update',
    ]);
  });
});
