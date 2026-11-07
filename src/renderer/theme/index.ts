import type { AppConfig } from '@shared/types';

export type ResolvedTheme = 'light' | 'dark';

type ThemeSetting = AppConfig['theme'];

const DARK_QUERY = '(prefers-color-scheme: dark)';

const getDarkQuery = (): MediaQueryList | null => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(DARK_QUERY);
};

/** 把配置里的 theme（含 auto）解析成实际生效的主题 */
export function resolveTheme(setting: ThemeSetting): ResolvedTheme {
  if (setting === 'light' || setting === 'dark') {
    return setting;
  }
  return getDarkQuery()?.matches ? 'dark' : 'light';
}

/** 应用主题：只改 <html data-theme>，具体颜色由 styles/theme.css 的变量决定 */
export function applyTheme(setting: ThemeSetting): ResolvedTheme {
  const resolved = resolveTheme(setting);

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
  }

  return resolved;
}

/**
 * 跟随系统配色变化：仅当配置为 auto 时才响应。
 * 返回取消监听函数，便于在测试或热更新时清理。
 */
export function watchSystemTheme(getSetting: () => ThemeSetting): () => void {
  const query = getDarkQuery();

  if (!query) {
    return () => undefined;
  }

  const handleChange = () => {
    if (getSetting() === 'auto') {
      applyTheme('auto');
    }
  };

  query.addEventListener('change', handleChange);

  return () => query.removeEventListener('change', handleChange);
}
