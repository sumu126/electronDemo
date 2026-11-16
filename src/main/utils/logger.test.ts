import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from './logger';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-log-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('Logger', () => {
  it('按级别写入日志文件', async () => {
    const filePath = path.join(tempDir, 'logs', 'main.log');
    const logger = new Logger(filePath);

    logger.info('started');
    logger.warn('slow');
    logger.error('boom');

    await logger.flush();
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('[INFO] started');
    expect(content).toContain('[WARN] slow');
    expect(content).toContain('[ERROR] boom');
  });

  it('序列化对象类型的附加信息', async () => {
    const filePath = path.join(tempDir, 'meta.log');
    const logger = new Logger(filePath);

    logger.info('with meta', { module: 'ConfigModule' });

    await logger.flush();
    expect(fs.readFileSync(filePath, 'utf-8')).toContain('with meta {"module":"ConfigModule"}');
  });

  it('并发写入保持调用顺序', async () => {
    const filePath = path.join(tempDir, 'order.log');
    const logger = new Logger(filePath);

    for (let index = 0; index < 20; index += 1) {
      logger.info(`line-${index}`);
    }

    await logger.flush();
    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');

    expect(lines).toHaveLength(20);
    expect(lines[0]).toContain('line-0');
    expect(lines[19]).toContain('line-19');
  });

  it('超过大小上限时轮转并只保留指定份数', async () => {
    const filePath = path.join(tempDir, 'rotate.log');
    const logger = new Logger(filePath, { maxSizeBytes: 200, maxFiles: 2 });

    for (let index = 0; index < 12; index += 1) {
      logger.info(`line-${index}-${'x'.repeat(40)}`);
    }

    await logger.flush();

    expect(fs.existsSync(`${filePath}.1`)).toBe(true);
    expect(fs.existsSync(`${filePath}.2`)).toBe(true);
    expect(fs.existsSync(`${filePath}.3`)).toBe(false);
    expect(fs.readFileSync(filePath, 'utf-8')).toContain('line-11');
  });
});
