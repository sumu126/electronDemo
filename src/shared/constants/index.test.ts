import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { APP_CONSTANTS } from './index';

const packageJson = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8'),
) as { version: string; build: { appId: string } };

describe('APP_CONSTANTS', () => {
  it('版本号与 package.json 保持一致', () => {
    expect(APP_CONSTANTS.VERSION).toBe(packageJson.version);
  });

  it('APP_ID 与打包配置的 appId 保持一致', () => {
    expect(APP_CONSTANTS.APP_ID).toBe(packageJson.build.appId);
  });
});
