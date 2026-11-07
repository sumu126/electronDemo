import type { Rectangle } from 'electron';
import type { WindowConfig } from '@shared/types';

export const MIN_WINDOW_WIDTH = 800;
export const MIN_WINDOW_HEIGHT = 600;

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const EDGE_PADDING = 50;

export interface InitialWindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, Math.max(min, max)));

const overlaps = (a: Rectangle, b: Rectangle): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/**
 * 根据保存的窗口状态计算初始尺寸/位置。
 * 尺寸被限制在最小尺寸与当前工作区之间；位置如果不在任何显示器可见区域内则丢弃，避免窗口跑到屏幕外。
 */
export function resolveInitialWindowState(
  saved: WindowConfig | undefined,
  workArea: Rectangle,
  visibleAreas: Rectangle[],
): InitialWindowState {
  const width = clamp(
    saved?.width ?? DEFAULT_WIDTH,
    MIN_WINDOW_WIDTH,
    workArea.width - EDGE_PADDING,
  );
  const height = clamp(
    saved?.height ?? DEFAULT_HEIGHT,
    MIN_WINDOW_HEIGHT,
    workArea.height - EDGE_PADDING,
  );

  const x = saved?.x;
  const y = saved?.y;
  const hasPosition = typeof x === 'number' && typeof y === 'number';
  const candidate = hasPosition ? { x, y, width, height } : null;
  const isVisible = candidate !== null && visibleAreas.some((area) => overlaps(candidate, area));

  return {
    width,
    height,
    x: isVisible ? x : undefined,
    y: isVisible ? y : undefined,
    maximized: Boolean(saved?.maximized),
  };
}
