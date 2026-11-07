import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getLogger, initLogger } from './app-logger';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'app-logger-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('app-logger', () => {
  it('未初始化前回退到控制台，日志不会丢', () => {
    getLogger().warn('before init', { stage: 'bootstrap' });

    expect(console.warn).toHaveBeenCalledWith('before init', { stage: 'bootstrap' });
  });

  it('initLogger 之后的日志写入文件', async () => {
    const filePath = join(tempDir, 'logs', 'main.log');
    const logger = initLogger(filePath);

    getLogger().info('after init');

    await logger.flush();
    expect(readFileSync(filePath, 'utf-8')).toContain('[INFO] after init');
  });

  it('initLogger 返回的实例与 getLogger 指向同一个 sink', async () => {
    const filePath = join(tempDir, 'same.log');
    const logger = initLogger(filePath);

    getLogger().error('shared sink');

    await logger.flush();
    expect(readFileSync(filePath, 'utf-8')).toContain('[ERROR] shared sink');
  });
});
