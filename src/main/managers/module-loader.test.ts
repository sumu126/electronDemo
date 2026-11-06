import fs from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModuleRegistry } from './module-registry';
import { loadModulesFromDirectory } from './module-loader';

const requireFromTest = createRequire(import.meta.url);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-modules-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('loadModulesFromDirectory', () => {
  it('加载合法的 CommonJS 模块', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'demo.cjs'),
      "module.exports = { name: 'Demo', version: '1.0.0', init() {} };\n",
    );
    const registry = new ModuleRegistry();

    const loaded = await loadModulesFromDirectory(tempDir, registry, requireFromTest);

    expect(loaded).toEqual(['Demo']);
    expect(registry.get('Demo')).toBeDefined();
  });

  it('跳过非法模块，且单个模块异常不影响其它模块', async () => {
    fs.writeFileSync(path.join(tempDir, 'bad.cjs'), 'module.exports = { name: 123 };\n');
    fs.writeFileSync(path.join(tempDir, 'boom.cjs'), 'throw new Error("boom");\n');
    fs.writeFileSync(
      path.join(tempDir, 'good.cjs'),
      "module.exports = { name: 'Good', init() {} };\n",
    );
    const registry = new ModuleRegistry();

    const loaded = await loadModulesFromDirectory(tempDir, registry, requireFromTest);

    expect(loaded).toEqual(['Good']);
  });

  it('目录不存在时返回空数组', async () => {
    const registry = new ModuleRegistry();

    await expect(
      loadModulesFromDirectory(path.join(tempDir, 'missing'), registry, requireFromTest),
    ).resolves.toEqual([]);
  });
});
