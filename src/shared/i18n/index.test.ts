import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getMessages, normalizeLocale } from './index';

const collectPaths = (value: unknown, prefix = ''): string[] => {
  if (value === null || typeof value !== 'object') {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectPaths(child, prefix ? `${prefix}.${key}` : key),
  );
};

describe('normalizeLocale', () => {
  it('支持的语言原样返回', () => {
    SUPPORTED_LOCALES.forEach((locale) => {
      expect(normalizeLocale(locale)).toBe(locale);
    });
  });

  it('未知或空值回退到默认语言', () => {
    expect(normalizeLocale('fr-FR')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale('')).toBe(DEFAULT_LOCALE);
  });
});

describe('messages', () => {
  it('两种语言的键结构保持一致', () => {
    const base = collectPaths(getMessages('zh-CN')).sort();
    const other = collectPaths(getMessages('en-US')).sort();

    expect(other).toEqual(base);
  });

  it('按语言返回对应文案', () => {
    expect(getMessages('zh-CN').home.config).toBe('配置');
    expect(getMessages('en-US').home.config).toBe('Settings');
  });

  it('未知语言回退到中文文案', () => {
    expect(getMessages('ja-JP').home.config).toBe(getMessages('zh-CN').home.config);
  });
});
