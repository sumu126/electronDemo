import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from './defaults';
import { findUnknownConfigKeys, sanitizeConfigUpdate } from './schema';

/**
 * 默认值与 schema 是两份手写清单，最容易出现的漂移是：
 * 加了配置项却忘了加 schema 白名单（于是写入被拒绝），或默认值本身不符合 schema。
 * 这两条用例把漂移挡在提交前。
 */
describe('默认配置与 schema 一致性', () => {
  it('默认配置里没有 schema 之外的键', () => {
    expect(findUnknownConfigKeys(createDefaultConfig())).toEqual([]);
  });

  it('默认配置本身能通过 schema 校验（类型与枚举都合法）', () => {
    expect(() => sanitizeConfigUpdate(createDefaultConfig())).not.toThrow();
  });
});
