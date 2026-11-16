import { join } from 'path';
import type { AppConfig } from '@shared/types';

export type CloseAction = 'hide' | 'close';

/**
 * 关闭窗口时该「藏到托盘」还是「真正关闭」。
 *
 * 两种情况都不能拦：退出流程中、以及托盘建不起来的时候——否则窗口被藏起来，
 * 用户既看不到托盘、也没有入口唤回。
 */
export function resolveCloseAction(state: {
  quitting: boolean;
  trayAvailable: boolean;
}): CloseAction {
  if (state.quitting || !state.trayAvailable) {
    return 'close';
  }

  return 'hide';
}

export type LoadTarget = { kind: 'url'; url: string } | { kind: 'file'; file: string };

/**
 * 窗口该加载开发服务器还是打包产物。
 *
 * 用 `process.defaultApp` 判断开发态：Electron 45 下用 `electron .` 启动时
 * `app.isPackaged` 也可能返回 true，不能拿它判断。
 */
export function resolveLoadTarget(input: {
  isDevelopment: boolean;
  devServerUrl: string;
  resourcesPath: string;
}): LoadTarget {
  if (input.isDevelopment) {
    return { kind: 'url', url: input.devServerUrl };
  }

  return { kind: 'file', file: join(input.resourcesPath, 'dist', 'index.html') };
}

/** 与 styles/theme.css 的 --color-bg 对齐，避免深色主题启动时先闪一帧白底 */
export function resolveWindowBackgroundColor(
  theme: AppConfig['theme'] | undefined,
  systemPrefersDark: boolean,
): string {
  const isDark = theme === 'dark' || (theme !== 'light' && systemPrefersDark);

  return isDark ? '#16181d' : '#f5f5f5';
}

/** 窗口图标的候选顺序：Linux 优先真 PNG（ICO 可能解不出来），其余平台优先 ICO */
export function resolveWindowIconCandidates(platform: NodeJS.Platform): readonly string[] {
  return platform === 'linux'
    ? ['assets/icon.png', 'assets/icon.ico']
    : ['assets/icon.ico', 'assets/icon.png'];
}
