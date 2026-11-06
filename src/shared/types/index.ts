// 应用配置类型定义
export interface AppConfig {
  appName: string;
  version: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  window: WindowConfig;
  features: FeatureFlags;
  tray: TrayConfig;
}

export interface WindowConfig {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
}

export interface FeatureFlags {
  developerTools: boolean;
  analytics: boolean;
  autoUpdate: boolean;
}

export interface TrayConfig {
  hasShownFirstTimeNotice: boolean;
  balloonNotificationEnabled: boolean;
}

// IPC通信相关类型
export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 系统信息类型
export interface SystemInfo {
  platform: string;
  arch: string;
  release: string;
  totalMem: number;
  freeMem: number;
  userInfo: UserInfo;
}

export interface UserInfo {
  username: string;
  homeDir: string;
  osVersion: string;
}

// 模块类型定义
export interface ModuleInfo {
  name: string;
  version: string;
  description: string;
  enabled: boolean;
}

// 渲染进程允许调用的 IPC 通道及其返回类型
export interface IpcInvokeMap {
  ping: string;
  'system:info': SystemInfo;
  'config:get': AppConfig;
  'config:update': void;
  'file:read': string;
  'file:write': void;
  'window:minimize': void;
  'window:maximize': void;
  'window:close': void;
}

export type IpcChannel = keyof IpcInvokeMap;

// preload 通过 contextBridge 暴露给渲染进程的 API
export interface ElectronAPI {
  invoke<K extends IpcChannel>(channel: K, ...args: unknown[]): Promise<IpcInvokeMap[K]>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, data: string): Promise<void>;
  getSystemInfo(): Promise<SystemInfo>;
  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
}
