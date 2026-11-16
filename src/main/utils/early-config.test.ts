import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readSandboxEnabled } from './early-config';

describe('readSandboxEnabled', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'early-config-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  const writeConfig = (content: string): void => {
    writeFileSync(join(userDataDir, 'config.json'), content, 'utf-8');
  };

  it('配置文件不存在时默认开启', () => {
    expect(readSandboxEnabled(userDataDir)).toBe(true);
  });

  it('显式写入 false 时关闭', () => {
    writeConfig(JSON.stringify({ security: { sandboxEnabled: false } }));

    expect(readSandboxEnabled(userDataDir)).toBe(false);
  });

  it('显式写入 true 时保持开启', () => {
    writeConfig(JSON.stringify({ security: { sandboxEnabled: true } }));

    expect(readSandboxEnabled(userDataDir)).toBe(true);
  });

  it('JSON 损坏时保持开启', () => {
    writeConfig('{ not-json');

    expect(readSandboxEnabled(userDataDir)).toBe(true);
  });

  it('字段类型不对时保持开启', () => {
    writeConfig(JSON.stringify({ security: { sandboxEnabled: 'false' } }));

    expect(readSandboxEnabled(userDataDir)).toBe(true);
  });

  it('security 不是对象时保持开启', () => {
    writeConfig(JSON.stringify({ security: false }));

    expect(readSandboxEnabled(userDataDir)).toBe(true);
  });
});
