/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, resolveTheme, watchSystemTheme } from './index';

type MatchMediaListener = () => void;

let darkMode = false;
let listeners: MatchMediaListener[] = [];

const installMatchMedia = () => {
  const matchMedia = vi.fn((query: string) => ({
    matches: darkMode,
    media: query,
    onchange: null,
    addEventListener: (_event: string, handler: MatchMediaListener) => {
      listeners.push(handler);
    },
    removeEventListener: (_event: string, handler: MatchMediaListener) => {
      listeners = listeners.filter((item) => item !== handler);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  });
};

beforeEach(() => {
  darkMode = false;
  listeners = [];
  installMatchMedia();
});

afterEach(() => {
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe('resolveTheme', () => {
  it('显式指定时直接用指定值', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('auto 跟随系统配色', () => {
    expect(resolveTheme('auto')).toBe('light');

    darkMode = true;
    expect(resolveTheme('auto')).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('只切换 <html data-theme>', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('auto 时写入解析后的具体主题', () => {
    darkMode = true;
    expect(applyTheme('auto')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('watchSystemTheme', () => {
  it('auto 下系统配色变化会重新应用主题', () => {
    applyTheme('light');
    const stop = watchSystemTheme(() => 'auto');

    darkMode = true;
    listeners.forEach((listener) => listener());

    expect(document.documentElement.dataset.theme).toBe('dark');

    stop();
    expect(listeners).toHaveLength(0);
  });

  it('固定主题时不响系统配色', () => {
    applyTheme('light');
    watchSystemTheme(() => 'light');

    darkMode = true;
    listeners.forEach((listener) => listener());

    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
