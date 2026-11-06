import { describe, expect, it } from 'vitest';
import { deepMerge, formatDate, validateEmail } from './helpers';

describe('deepMerge', () => {
  it('递归合并对象且不丢失同级字段', () => {
    const target = { features: { a: true, b: false }, name: 'x' };
    const source = { features: { b: true } };

    expect(deepMerge(target, source)).toEqual({
      features: { a: true, b: true },
      name: 'x',
    });
  });

  it('不修改原对象', () => {
    const target = { nested: { a: 1 } };
    deepMerge(target, { nested: { b: 2 } });

    expect(target).toEqual({ nested: { a: 1 } });
  });
});

describe('formatDate', () => {
  it('按默认格式输出日期', () => {
    expect(formatDate(new Date(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02 03:04:05');
  });
});

describe('validateEmail', () => {
  it('校验邮箱格式', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('user@example')).toBe(false);
  });
});
