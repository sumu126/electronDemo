import { IpcMainInvokeEvent } from 'electron';
import { BaseIpcHandler } from '../ipc/base.handler';
import { AppConfig } from '@shared/types';
import { ConfigModule } from '../modules/config.module';

export class ConfigHandler extends BaseIpcHandler {
  private configModule: ConfigModule;

  constructor(configModule: ConfigModule) {
    super();
    this.configModule = configModule;
  }

  async getConfig(_event: IpcMainInvokeEvent): Promise<AppConfig> {
    return this.handleAsync<AppConfig>(() => {
      return Promise.resolve(this.configModule.getConfig());
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error!);
      }
      return response.data!;
    });
  }

  // 入参来自渲染进程，类型不可信：交给 ConfigModule 用 schema 校验
  async updateConfig(_event: IpcMainInvokeEvent, updates: unknown): Promise<void> {
    return this.handleAsync<void>(() => {
      return this.configModule.updateConfig(updates);
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error!);
      }
      return response.data!;
    });
  }
}
