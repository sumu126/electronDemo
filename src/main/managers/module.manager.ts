import { app } from 'electron';
import { createRequire } from 'module';
import { join } from 'path';
import { ConfigModule } from '../modules/config.module';
import { loadModulesFromDirectory } from './module-loader';
import { ModuleRegistry } from './module-registry';
import type { IpcHandlerContribution } from '../ipc/ipc-contribution';
import { getLogger } from '../utils/app-logger';
import type { LogSink } from '../utils/app-logger';
import type { Module } from './module.types';

export type { Module } from './module.types';

export class ModuleManager {
  private registry = new ModuleRegistry();
  // 仅核心模块可以贡献 IPC：磁盘上的插件不能注册/覆盖渲染进程可调用的通道
  private coreModules: Module[] = [];

  public async init(): Promise<void> {
    this.coreModules = [];
    await this.loadCoreModules();
    await this.loadUserModules();
  }

  private async loadCoreModules(): Promise<void> {
    getLogger().info('Loading core modules...');

    // 核心模块失败需要中断启动
    const configModule = new ConfigModule();
    this.coreModules.push(configModule);
    await this.registry.register(configModule, { required: true });
  }

  private async loadUserModules(): Promise<void> {
    const modulesDir = join(app.getPath('userData'), 'modules');
    const requireModule = createRequire(__filename);

    // 插件不能 import 框架代码，用一个全局入口把日志通道交出去
    (globalThis as { __frameworkLogger?: LogSink }).__frameworkLogger = getLogger();

    const loaded = await loadModulesFromDirectory(modulesDir, this.registry, requireModule);

    getLogger().info(`Loaded user modules: ${loaded.length > 0 ? loaded.join(', ') : 'none'}`);
  }

  public getModule<T extends Module = Module>(name: string): T | undefined {
    return this.registry.get<T>(name);
  }

  /** 收集核心模块贡献的 IPC 通道；用户插件不参与，避免越权注册 */
  public collectIpcHandlers(): IpcHandlerContribution[] {
    return this.coreModules.flatMap((module) => module.ipcHandlers?.() ?? []);
  }

  public destroy(): Promise<void> {
    return this.registry.destroy();
  }
}
