import type { Locale } from '../i18n';

// 应用配置类型定义
export interface AppConfig {
  appName: string;
  version: string;
  theme: 'light' | 'dark' | 'auto';
  language: Locale;
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
  /** 控制开发态自动打开 DevTools，以及生产态是否放行开发者工具 */
  developerTools: boolean;
}

export interface TrayConfig {
  hasShownFirstTimeNotice: boolean;
  balloonNotificationEnabled: boolean;
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

/**
 * 渲染进程允许调用的 IPC 通道契约：参数元组 + 返回类型。
 * 参数也在这里声明，`invoke` 才能同时校验通道名和实参形状。
 * 注意：file:read / file:write 已移除——它会写进 userData/modules，
 * 与动态模块加载叠加等于给渲染进程留了一条提权链。
 */
export interface IpcInvokeMap {
  ping: { args: []; returns: string };
  'system:info': { args: []; returns: SystemInfo };
  'config:get': { args: []; returns: AppConfig };
  'config:update': { args: [updates: Partial<AppConfig>]; returns: void };
  'log:report': {
    args: [
      level: 'info' | 'warn' | 'error',
      message: string,
      meta?: string | Record<string, unknown>,
    ];
    returns: void;
  };
  'window:minimize': { args: []; returns: void };
  'window:maximize': { args: []; returns: void };
  'window:close': { args: []; returns: void };
}

export type IpcChannel = keyof IpcInvokeMap;

export type IpcArgs<K extends IpcChannel> = IpcInvokeMap[K]['args'];

export type IpcResult<K extends IpcChannel> = IpcInvokeMap[K]['returns'];

// preload 通过 contextBridge 暴露给渲染进程的 API
export interface ElectronAPI {
  invoke<K extends IpcChannel>(channel: K, ...args: IpcArgs<K>): Promise<IpcResult<K>>;
  getSystemInfo(): Promise<SystemInfo>;
  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
}
