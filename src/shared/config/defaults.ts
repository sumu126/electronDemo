import { APP_CONSTANTS } from '../constants';
import { deepMerge } from '../utils/helpers';
import type { AppConfig } from '../types';

/**
 * 框架唯一的默认配置来源。
 * 主进程与渲染进程都从这里取值，避免两份默认值漂移。
 */
export function createDefaultConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const defaults: AppConfig = {
    appName: APP_CONSTANTS.NAME,
    version: APP_CONSTANTS.VERSION,
    theme: 'auto',
    language: 'zh-CN',
    window: {
      width: 1200,
      height: 800,
    },
    features: {
      developerTools: false,
      analytics: true,
      autoUpdate: true,
    },
    tray: {
      hasShownFirstTimeNotice: false,
    },
  };

  return deepMerge(defaults, overrides) as AppConfig;
}
