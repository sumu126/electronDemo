import { IpcMainInvokeEvent } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { BaseIpcHandler } from '../ipc/base.handler';
import { IPC_CHANNELS } from '@shared/constants';

export class FileHandler extends BaseIpcHandler {
  async readFile(event: IpcMainInvokeEvent, filePath: string): Promise<string> {
    return this.handleAsync<string>(async () => {
      const data = await fs.readFile(filePath, 'utf-8');
      return data;
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error!);
      }
      return response.data!;
    });
  }

  async writeFile(event: IpcMainInvokeEvent, filePath: string, data: string): Promise<void> {
    return this.handleAsync<void>(async () => {
      // 确保目录存在
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, data, 'utf-8');
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error!);
      }
      return response.data!;
    });
  }

  async selectFile(event: IpcMainInvokeEvent, options?: Electron.OpenDialogOptions): Promise<string | null> {
    return this.handleAsync<string | null>(async () => {
      // 这里需要通过主窗口访问dialog，简化处理
      // 实际实现中可能需要通过windowManager访问主窗口
      console.warn('File selection not fully implemented in this handler');
      return null;
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error!);
      }
      return response.data!;
    });
  }
}