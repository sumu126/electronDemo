import { app } from 'electron';
import { APP_CONSTANTS, IPC_CHANNELS } from '@shared/constants';
import { buildConfigFromEnv } from '@shared/config/from-env';
import type { AppConfig } from '@shared/types';
import { ConfigHandler } from '../ipc/config.handler';
import type { IpcHandlerContribution } from '../ipc/ipc-contribution';
import { getLogger } from '../utils/app-logger';
import { loadProjectEnv, resolveEnvPath } from '../utils/env';

/**
 * 配置只从项目 .env 读取，不再写 config.json。
 * 设置页只读；用户改配置需要编辑 .env 并重启。
 */
export class ConfigModule {
  public readonly name = 'ConfigModule';
  private readonly config: AppConfig;
  private readonly warnings: string[];

  constructor() {
    const env = loadProjectEnv();
    const result = buildConfigFromEnv(env, {
      appName: app.getName() || APP_CONSTANTS.NAME,
      version: app.getVersion() || APP_CONSTANTS.VERSION,
    });

    this.config = result.config;
    this.warnings = result.warnings;
  }

  public async init(): Promise<void> {
    const envPath = resolveEnvPath();

    if (Object.keys(loadProjectEnv()).length === 0) {
      getLogger().warn(`Project config not found at ${envPath}, using defaults`);
    } else {
      getLogger().info(`Project config loaded from ${envPath}`);
    }

    for (const warning of this.warnings) {
      getLogger().warn(warning);
    }
  }

  public async destroy(): Promise<void> {
    // 配置是只读的，没有需要清理的资源
  }

  /** 只暴露 config:get；config:update 已移除 */
  public ipcHandlers(): IpcHandlerContribution[] {
    const handler = new ConfigHandler(this);

    return [{ channel: IPC_CHANNELS.CONFIG_GET, handler: (event) => handler.getConfig(event) }];
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public getValue<T>(keyPath: string): T | undefined {
    // 简单的键路径解析（例如 'window.width'）
    return keyPath.split('.').reduce((obj: any, prop) => obj?.[prop], this.config) as T;
  }
}

/** 运行时类型守卫：供 ModuleManager.getModule 使用，避免按名字强转 */
export function isConfigModule(value: unknown): value is ConfigModule {
  return value instanceof ConfigModule;
}
