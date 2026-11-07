import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, IpcChannel } from '@shared/types';

// 渲染进程允许调用的通道白名单。
// 必须内联而不是从共享模块导入：开启 sandbox 后 preload 无法 require 相对路径的分块文件。
const ALLOWED_CHANNELS = [
  'ping',
  'system:info',
  'config:get',
  'config:update',
  'file:read',
  'file:write',
  'window:minimize',
  'window:maximize',
  'window:close',
] as const satisfies readonly IpcChannel[];

// 完整性校验：新增 IpcChannel 却漏加白名单时，下面这行会直接报类型错误，
// 而不是等到运行时才看到 "Blocked IPC channel"。
type UncoveredChannel = Exclude<IpcChannel, (typeof ALLOWED_CHANNELS)[number]>;
const _allChannelsCovered: UncoveredChannel extends never ? true : never = true;
void _allChannelsCovered;

const allowedChannels = new Set<string>(ALLOWED_CHANNELS);

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
