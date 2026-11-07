import { app } from 'electron';
import { createRequire } from 'module';
import { join } from 'path';
import { ConfigModule } from '../modules/config.module';
import { loadModulesFromDirectory } from './module-loader';
import { ModuleRegistry } from './module-registry';
import { getLogger } from '../utils/app-logger';
import type { LogSink } from '../utils/app-logger';
import type { Module } from './module.types';
import type { ModuleInfo } from '@shared/types';

export type { Module } from './module.types';

export class ModuleManager {
  private registry = new ModuleRegistry();

  public async init(): Promise<void> {
    await this.loadCoreModules();
    await this.loadUserModules();
  }

  private async loadCoreModules(): Promise<void> {
    getLogger().info('Loading core modules...');

    // 核心模块失败需要中断启动
    await this.registry.register(new ConfigModule(), { required: true });
  }

  private async loadUserModules(): Promise<void> {
    const modulesDir = join(app.getPath('userData'), 'modules');
    const requireModule = createRequire(__filename);

    // 插件不能 import 框架代码，用一个全局入口把日志通道交出去
    (globalThis as { __frameworkLogger?: LogSink }).__frameworkLogger = getLogger();

    const loaded = await loadModulesFromDirectory(modulesDir, this.registry, requireModule);

    getLogger().info(`Loaded user modules: ${loaded.length > 0 ? loaded.join(', ') : 'none'}`);
  }

  public registerModule(module: Module, options?: { required?: boolean }): Promise<boolean> {
    return this.registry.register(module, options);
  }

  public unregisterModule(name: string): Promise<boolean> {
    return this.registry.unregister(name);
  }

  public getModule<T extends Module = Module>(name: string): T | undefined {
    return this.registry.get<T>(name);
  }

  public listModules(): ModuleInfo[] {
    return this.registry.list();
  }

  public destroy(): Promise<void> {
    return this.registry.destroy();
  }
}
