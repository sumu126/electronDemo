import type { ModuleInfo } from '@shared/types';
import type { Module } from './module.types';
import { getLogger } from '../utils/app-logger';

/**
 * 模块注册表：负责生命周期、失败隔离与卸载。
 * 不依赖 electron，便于单元测试；目录扫描由 module-loader 负责。
 */
export class ModuleRegistry {
  private modules = new Map<string, Module>();

  public async register(module: Module, options: { required?: boolean } = {}): Promise<boolean> {
    if (this.modules.has(module.name)) {
      getLogger().warn(`Module ${module.name} already registered, skipped`);
      return false;
    }

    try {
      await module.init();
      this.modules.set(module.name, module);
      getLogger().info(`Module ${module.name} registered successfully`);
      return true;
    } catch (error) {
      getLogger().error(`Failed to register module ${module.name}`, error);
      // 核心模块失败需要中断启动，用户模块失败只隔离自身
      if (options.required) {
        throw error;
      }
      return false;
    }
  }

  public async unregister(name: string): Promise<boolean> {
    const module = this.modules.get(name);

    if (!module) {
      return false;
    }

    this.modules.delete(name);

    if (module.destroy) {
      try {
        await module.destroy();
      } catch (error) {
        getLogger().error(`Failed to destroy module ${name}`, error);
      }
    }

    return true;
  }

  public get(name: string): Module | undefined {
    return this.modules.get(name);
  }

  public list(): ModuleInfo[] {
    return Array.from(this.modules.values()).map((module) => ({
      name: module.name,
      version: module.version ?? '0.0.0',
      description: module.description ?? '',
      enabled: true,
    }));
  }

  public async destroy(): Promise<void> {
    for (const [name, module] of this.modules) {
      if (!module.destroy) {
        continue;
      }

      try {
        await module.destroy();
        getLogger().info(`Module ${name} destroyed successfully`);
      } catch (error) {
        getLogger().error(`Failed to destroy module ${name}`, error);
      }
    }

    this.modules.clear();
  }
}
