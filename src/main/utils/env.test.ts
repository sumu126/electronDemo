import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { loadProjectEnv, parseEnvContent, readSandboxEnabled, resolveEnvPath } from './env';

describe('parseEnvContent', () => {
  it('支持 BOM、注释、空行、export、引号与行内注释', () => {
    const env = parseEnvContent(
      [
        '\uFEFF# 配置文件',
        '',
        'PLAIN=value',
        'export EXPORTED=1',
        'QUOTED="a b"',
        "SINGLE='c d'",
        'QUOTED_COMMENT="dark" # 深色',
        "SINGLE_COMMENT='x y' # trailing",
        'INLINE=value # trailing',
        'HASH=value#not-comment',
        'EMPTY=',
        'NOT_A_PAIR',
      ].join('\r\n'),
    );

    expect(env).toEqual({
      PLAIN: 'value',
      EXPORTED: '1',
      QUOTED: 'a b',
      SINGLE: 'c d',
      QUOTED_COMMENT: 'dark',
      SINGLE_COMMENT: 'x y',
      INLINE: 'value',
      HASH: 'value#not-comment',
      EMPTY: '',
    });
  });

  it('忽略不合法的键名', () => {
    expect(parseEnvContent('1KEY=x\nKEY-NAME=y\nOK=z')).toEqual({ OK: 'z' });
  });
});

describe('resolveEnvPath', () => {
  const originalEnvFile = process.env.ELECTRON_ENV_FILE;

  afterEach(() => {
    if (originalEnvFile === undefined) {
      delete process.env.ELECTRON_ENV_FILE;
    } else {
      process.env.ELECTRON_ENV_FILE = originalEnvFile;
    }
    Reflect.deleteProperty(process, 'defaultApp');
    Reflect.deleteProperty(process, 'resourcesPath');
  });

  it('ELECTRON_ENV_FILE 优先，相对路径按 cwd 解析', () => {
    process.env.ELECTRON_ENV_FILE = 'config/.env';
    expect(resolveEnvPath()).toBe(resolve('config/.env'));

    process.env.ELECTRON_ENV_FILE = join(tmpdir(), 'absolute.env');
    expect(resolveEnvPath()).toBe(join(tmpdir(), 'absolute.env'));
  });

  it('开发态读 cwd/.env，打包态读 resources/.env', () => {
    delete process.env.ELECTRON_ENV_FILE;

    Object.defineProperty(process, 'defaultApp', { configurable: true, value: true });
    expect(resolveEnvPath()).toBe(join(process.cwd(), '.env'));

    Object.defineProperty(process, 'defaultApp', { configurable: true, value: false });
    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: join(tmpdir(), 'resources'),
    });
    expect(resolveEnvPath()).toBe(join(tmpdir(), 'resources', '.env'));

    Reflect.deleteProperty(process, 'resourcesPath');
    expect(resolveEnvPath()).toBe(join(process.cwd(), '.env'));
  });
});

describe('loadProjectEnv', () => {
  let dir: string;
  const originalEnvFile = process.env.ELECTRON_ENV_FILE;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'project-env-'));
    process.env.ELECTRON_ENV_FILE = join(dir, '.env');
  });

  afterEach(() => {
    if (originalEnvFile === undefined) {
      delete process.env.ELECTRON_ENV_FILE;
    } else {
      process.env.ELECTRON_ENV_FILE = originalEnvFile;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('.env 不存在时返回空对象', () => {
    expect(loadProjectEnv()).toEqual({});
  });

  it('读取并解析 .env', () => {
    writeFileSync(join(dir, '.env'), 'THEME=dark\nWINDOW_WIDTH=1000\n', 'utf-8');

    expect(loadProjectEnv()).toEqual({ THEME: 'dark', WINDOW_WIDTH: '1000' });
  });
});

describe('readSandboxEnabled', () => {
  it('只有显式关闭值才关闭沙箱', () => {
    expect(readSandboxEnabled({})).toBe(true);
    expect(readSandboxEnabled({ SECURITY_SANDBOX_ENABLED: '' })).toBe(true);
    expect(readSandboxEnabled({ SECURITY_SANDBOX_ENABLED: 'true' })).toBe(true);
    expect(readSandboxEnabled({ SECURITY_SANDBOX_ENABLED: 'maybe' })).toBe(true);
    expect(readSandboxEnabled({ SECURITY_SANDBOX_ENABLED: ' FALSE ' })).toBe(false);
    expect(readSandboxEnabled({ SECURITY_SANDBOX_ENABLED: '0' })).toBe(false);
    expect(readSandboxEnabled({ SECURITY_SANDBOX_ENABLED: 'no' })).toBe(false);
    expect(readSandboxEnabled({ SECURITY_SANDBOX_ENABLED: 'off' })).toBe(false);
  });
});
