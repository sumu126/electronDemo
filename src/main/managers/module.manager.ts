import { app } from 'electron';
import { createRequire } from 'module';
import { join } from 'path';
import { ConfigModule } from '../modules/config.module';
import { loadModulesFromDirectory } from './module-loader';
import { ModuleRegistry } from './module-registry';
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
    console.log('Loading core modules...');

    // 核心模块失败需要中断启动
    await this.registry.register(new ConfigModule(), { required: true });
  }

  private async loadUserModules(): Promise<void> {
    const modulesDir = join(app.getPath('userData'), 'modules');
    const requireModule = createRequire(__filename);
    const loaded = await loadModulesFromDirectory(modulesDir, this.registry, requireModule);

    console.log(`Loaded user modules: ${loaded.length > 0 ? loaded.join(', ') : 'none'}`);
  }

  public registerModule(
    module: Module,
    options?: { required?: boolean },
  ): Promise<boolean> {
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
