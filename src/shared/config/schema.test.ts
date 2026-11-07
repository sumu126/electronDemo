import { describe, expect, it } from 'vitest';
import {
  findUnknownConfigKeys,
  sanitizeConfigUpdate,
  stripUnknownConfigKeys,
} from './schema';

describe('sanitizeConfigUpdate', () => {
  it('接受合法的局部更新', () => {
    expect(sanitizeConfigUpdate({ theme: 'dark' })).toEqual({ theme: 'dark' });
    expect(sanitizeConfigUpdate({ window: { width: 1024 } })).toEqual({
      window: { width: 1024 },
    });
  });

  it('拒绝未知的顶层键', () => {
    expect(() => sanitizeConfigUpdate({ theme2: 'dark' })).toThrow(/theme2/);
  });

  it('拒绝未知的嵌套键', () => {
    expect(() => sanitizeConfigUpdate({ window: { opacity: 0.5 } })).toThrow(/window\.opacity/);
  });

  it('拒绝类型不符的值', () => {
    expect(() => sanitizeConfigUpdate({ window: { width: '1024' } })).toThrow(/必须是 number/);
    expect(() => sanitizeConfigUpdate({ appName: 123 })).toThrow(/必须是 string/);
    expect(() => sanitizeConfigUpdate({ window: { width: Number.POSITIVE_INFINITY } })).toThrow(
      /有限数字/,
    );
  });

  it('拒绝非法枚举值', () => {
    expect(() => sanitizeConfigUpdate({ theme: 'blue' })).toThrow(/light \/ dark \/ auto/);
  });

  it('拒绝原型链相关的键', () => {
    const payload = JSON.parse('{"__proto__":{"polluted":true}}');
    expect(() => sanitizeConfigUpdate(payload)).toThrow(/被禁止/);
  });

  it('拒绝非对象入参', () => {
    expect(() => sanitizeConfigUpdate(null)).toThrow(/必须是对象/);
    expect(() => sanitizeConfigUpdate([{ theme: 'dark' }])).toThrow(/必须是对象/);
  });
});

describe('findUnknownConfigKeys', () => {
  it('列出顶层与嵌套的未知键', () => {
    expect(
      findUnknownConfigKeys({
        theme: 'dark',
        network: { apiBase: '' },
        window: { width: 1200, opacity: 0.7 },
      }),
    ).toEqual(['network', 'window.opacity']);
  });

  it('合法配置返回空数组', () => {
    expect(findUnknownConfigKeys({ theme: 'light', window: { width: 800 } })).toEqual([]);
  });
});

describe('stripUnknownConfigKeys', () => {
  it('裁剪后只保留 schema 内的键', () => {
    const pruned = stripUnknownConfigKeys({
      theme: 'dark',
      network: { apiBase: '' },
      window: { width: 1200, opacity: 0.7 },
    });

    expect(pruned).toEqual({ theme: 'dark', window: { width: 1200 } });
  });
});
