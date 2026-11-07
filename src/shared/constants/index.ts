// 应用常量
export const APP_CONSTANTS = {
  NAME: 'Electron-Vue3 Framework',
  VERSION: '1.0.0',
  COMPANY: 'Electron-Vue3 Team',
  // 需与 package.json 的 build.appId 保持一致；Windows 通知与任务栏身份依赖它
  APP_ID: 'com.electron-vue3.demo',
};

// IPC通道常量（仅保留已实现并注册的通道）
// as const 让通道名保持字面量类型，注册处才能被 IpcChannel 约束住
export const IPC_CHANNELS = {
  // 通用通道
  PING: 'ping',

  // 系统信息通道
  SYSTEM_INFO: 'system:info',

  // 窗口操作通道
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // 配置管理通道
  CONFIG_GET: 'config:get',
  CONFIG_UPDATE: 'config:update',

  // 渲染进程日志上报（限流）
  LOG_REPORT: 'log:report',
} as const;

// 系统常量
export const SYSTEM_CONSTANTS = {
  SUPPORTED_PLATFORMS: ['win32', 'darwin', 'linux'] as const,
  DEFAULT_LANGUAGE: 'zh-CN',
  THEMES: ['light', 'dark', 'auto'] as const,
};
