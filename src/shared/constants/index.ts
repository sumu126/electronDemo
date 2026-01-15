// 应用常量
export const APP_CONSTANTS = {
  NAME: 'Electron-Vue3 Framework',
  VERSION: '1.0.0',
  COMPANY: 'Electron-Vue3 Team',
};

// IPC通道常量
export const IPC_CHANNELS = {
  // 通用通道
  PING: 'ping',
  
  // 应用信息通道
  APP_GET_INFO: 'app:get-info',
  
  // 文件操作通道
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_SELECT: 'file:select',
  
  // 系统信息通道
  SYSTEM_INFO: 'system:info',
  
  // 窗口操作通道
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  
  // 配置管理通道
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_UPDATE: 'config:update',
  
  // 模块管理通道
  MODULE_LOAD: 'module:load',
  MODULE_UNLOAD: 'module:unload',
  MODULE_LIST: 'module:list',
};

// 系统常量
export const SYSTEM_CONSTANTS = {
  SUPPORTED_PLATFORMS: ['win32', 'darwin', 'linux'] as const,
  DEFAULT_LANGUAGE: 'zh-CN',
  THEMES: ['light', 'dark', 'auto'] as const,
};