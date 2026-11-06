import { describe, expect, it } from 'vitest';
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, resolveInitialWindowState } from './window-state';

const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
const displays = [workArea];

describe('resolveInitialWindowState', () => {
  it('没有保存状态时使用默认尺寸且不指定位置', () => {
    const state = resolveInitialWindowState(undefined, workArea, displays);

    expect(state.width).toBe(1200);
    expect(state.height).toBe(800);
    expect(state.x).toBeUndefined();
    expect(state.maximized).toBe(false);
  });

  it('保留保存的尺寸与可见位置', () => {
    const state = resolveInitialWindowState(
      { width: 1000, height: 700, x: 100, y: 80 },
      workArea,
      displays,
    );

    expect(state.width).toBe(1000);
    expect(state.height).toBe(700);
    expect(state.x).toBe(100);
    expect(state.y).toBe(80);
  });

  it('把过小的尺寸提升到最小尺寸', () => {
    const state = resolveInitialWindowState({ width: 320, height: 240 }, workArea, displays);

    expect(state.width).toBe(MIN_WINDOW_WIDTH);
    expect(state.height).toBe(MIN_WINDOW_HEIGHT);
  });

  it('丢弃已不在任何显示器内的位置', () => {
    const state = resolveInitialWindowState(
      { width: 1000, height: 700, x: 3000, y: 2000 },
      workArea,
      displays,
    );

    expect(state.x).toBeUndefined();
    expect(state.y).toBeUndefined();
  });

  it('保留最大化标记', () => {
    const state = resolveInitialWindowState(
      { width: 1000, height: 700, maximized: true },
      workArea,
      displays,
    );

    expect(state.maximized).toBe(true);
  });
});
