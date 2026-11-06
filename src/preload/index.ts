import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, IpcChannel } from '@shared/types';

// 渲染进程允许调用的通道白名单。
// 必须内联而不是从共享模块导入：开启 sandbox 后 preload 无法 require 相对路径的分块文件。
// 类型约束保证这里的每一项都存在于 IpcInvokeMap 中。
const allowedChannels = new Set<string>([
  'ping',
  'system:info',
  'config:get',
  'config:update',
  'file:read',
  'file:write',
  'window:minimize',
  'window:maximize',
  'window:close',
] as const satisfies readonly IpcChannel[]);

const invoke = (channel: string, ...args: unknown[]): Promise<any> => {
  if (!allowedChannels.has(channel)) {
    return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
};

const electronAPI: ElectronAPI = {
  invoke,

  // 文件操作相关API
  readFile: (filePath: string) => invoke('file:read', filePath),
  writeFile: (filePath: string, data: string) => invoke('file:write', filePath, data),

  // 系统信息相关API
  getSystemInfo: () => invoke('system:info'),

  // 窗口操作相关API
  minimizeWindow: () => invoke('window:minimize'),
  maximizeWindow: () => invoke('window:maximize'),
  closeWindow: () => invoke('window:close'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
