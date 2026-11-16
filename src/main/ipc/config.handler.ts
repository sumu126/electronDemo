import { IpcMainInvokeEvent } from 'electron';
import { AppConfig } from '@shared/types';
import type { ConfigModule } from '../modules/config.module';

export class ConfigHandler {
  constructor(private readonly configModule: ConfigModule) {}

  async getConfig(_event: IpcMainInvokeEvent): Promise<AppConfig> {
    return this.configModule.getConfig();
  }

  // 入参来自渲染进程，类型不可信：交给 ConfigModule 用 schema 校验
  async updateConfig(_event: IpcMainInvokeEvent, updates: unknown): Promise<void> {
    return this.configModule.updateConfig(updates);
  }
}
