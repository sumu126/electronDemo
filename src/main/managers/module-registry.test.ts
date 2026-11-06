import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModuleRegistry } from './module-registry';
import type { Module } from './module.types';

const createModule = (name: string): Module => ({
  name,
  version: '1.0.0',
  description: `${name} module`,
  init: vi.fn(async () => undefined),
  destroy: vi.fn(async () => undefined),
});

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ModuleRegistry', () => {
  it('注册成功后可通过 get 获取', async () => {
    const registry = new ModuleRegistry();
    const module = createModule('Demo');

    await expect(registry.register(module)).resolves.toBe(true);
    expect(registry.get('Demo')).toBe(module);
    expect(module.init).toHaveBeenCalledOnce();
  });

  it('重复注册被忽略', async () => {
    const registry = new ModuleRegistry();
    const first = createModule('Demo');
    const second = createModule('Demo');

    await registry.register(first);
    await expect(registry.register(second)).resolves.toBe(false);
    expect(second.init).not.toHaveBeenCalled();
    expect(registry.get('Demo')).toBe(first);
  });

  it('普通模块初始化失败时隔离自身', async () => {
    const registry = new ModuleRegistry();
    const broken = createModule('Broken');
    broken.init = vi.fn(async () => {
      throw new Error('init failed');
    });

    await expect(registry.register(broken)).resolves.toBe(false);
    expect(registry.get('Broken')).toBeUndefined();

    await expect(registry.register(createModule('Good'))).resolves.toBe(true);
  });

  it('required 模块初始化失败时向上抛出', async () => {
    const registry = new ModuleRegistry();
    const broken = createModule('Core');
    broken.init = vi.fn(async () => {
      throw new Error('init failed');
    });

    await expect(registry.register(broken, { required: true })).rejects.toThrow('init failed');
  });

  it('卸载时调用 destroy 并移除', async () => {
    const registry = new ModuleRegistry();
    const module = createModule('Demo');
    await registry.register(module);

    await expect(registry.unregister('Demo')).resolves.toBe(true);
    expect(module.destroy).toHaveBeenCalledOnce();
    expect(registry.get('Demo')).toBeUndefined();
  });

  it('destroy 会清理全部模块', async () => {
    const registry = new ModuleRegistry();
    const first = createModule('A');
    const second = createModule('B');
    await registry.register(first);
    await registry.register(second);

    await registry.destroy();

    expect(first.destroy).toHaveBeenCalledOnce();
    expect(second.destroy).toHaveBeenCalledOnce();
    expect(registry.list()).toEqual([]);
  });

  it('list 返回模块元信息', async () => {
    const registry = new ModuleRegistry();
    await registry.register(createModule('Demo'));

    expect(registry.list()).toEqual([
      { name: 'Demo', version: '1.0.0', description: 'Demo module', enabled: true },
    ]);
  });
});
