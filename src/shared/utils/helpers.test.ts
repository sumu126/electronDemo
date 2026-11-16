import { describe, expect, it } from 'vitest';
import { deepMerge } from './helpers';

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
