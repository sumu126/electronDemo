import { join } from 'path';
import type { WindowConfig } from '@shared/types';

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

/** 把窗口当前状态拍成配置快照（用于落盘） */
export function createWindowStateSnapshot(
  bounds: { width: number; height: number; x: number; y: number },
  maximized: boolean,
): WindowConfig {
  return {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    maximized,
  };
}
