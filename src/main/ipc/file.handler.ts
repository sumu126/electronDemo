import { IpcMainInvokeEvent, app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { BaseIpcHandler } from '../ipc/base.handler';
import { IPC_CHANNELS } from '@shared/constants';

export class FileHandler extends BaseIpcHandler {
  // 将渲染进程传入的路径限制在 userData 目录内，防止任意文件读写
  private resolveUserDataPath(filePath: string): string {
    const root = path.resolve(app.getPath('userData'));
    const target = path.resolve(root, filePath);
    const relativePath = path.relative(root, target);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('Access denied: file path is outside the user data directory');
    }

    return target;
  }

  async readFile(event: IpcMainInvokeEvent, filePath: string): Promise<string> {
    return this.handleAsync<string>(async () => {
      const safePath = this.resolveUserDataPath(filePath);
      const data = await fs.readFile(safePath, 'utf-8');
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
      const safePath = this.resolveUserDataPath(filePath);

      // 确保目录存在
      const dir = path.dirname(safePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(safePath, data, 'utf-8');
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error!);
      }
      return response.data!;
    });
  }
}