import { IpcMainInvokeEvent } from 'electron';
import os from 'os';
import { BaseIpcHandler } from './base.handler';
import { SystemInfo } from '@shared/types';

export class SystemInfoHandler extends BaseIpcHandler {
  async getSystemInfo(_event: IpcMainInvokeEvent): Promise<SystemInfo> {
    return this.handleAsync<SystemInfo>(() => {
      return Promise.resolve({
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        userInfo: {
          username: os.userInfo().username,
          homeDir: os.userInfo().homedir,
          osVersion: os.version(),
        },
      });
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    });
  }
}