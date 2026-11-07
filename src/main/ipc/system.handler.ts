import { IpcMainInvokeEvent } from 'electron';
import os from 'os';
import { SystemInfo } from '@shared/types';

export class SystemInfoHandler {
  async getSystemInfo(_event: IpcMainInvokeEvent): Promise<SystemInfo> {
    const userInfo = os.userInfo();

    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      userInfo: {
        username: userInfo.username,
        homeDir: userInfo.homedir,
        osVersion: os.version(),
      },
    };
  }
}
