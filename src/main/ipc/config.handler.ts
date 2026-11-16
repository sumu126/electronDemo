import { IpcMainInvokeEvent } from 'electron';
import { AppConfig } from '@shared/types';
import type { ConfigModule } from '../modules/config.module';

export class ConfigHandler {
  constructor(private readonly configModule: ConfigModule) {}

  async getConfig(_event: IpcMainInvokeEvent): Promise<AppConfig> {
    return this.configModule.getConfig();
  }
}
