import { contextBridge, ipcRenderer } from 'electron';

// 定义暴露给渲染进程的安全API
contextBridge.exposeInMainWorld('electronAPI', {
  // IPC通信API
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => ipcRenderer.on(channel, listener),
  removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => ipcRenderer.removeListener(channel, listener),
  
  // 获取应用信息
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  
  // 文件操作相关API
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, data: string) => ipcRenderer.invoke('file:write', filePath, data),
  
  // 系统信息相关API
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  
  // 窗口操作相关API
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
});