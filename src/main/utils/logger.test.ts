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
  it('按级别写入日志文件', () => {
    const filePath = path.join(tempDir, 'logs', 'main.log');
    const logger = new Logger(filePath);

    logger.info('started');
    logger.warn('slow');
    logger.error('boom');

    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('[INFO] started');
    expect(content).toContain('[WARN] slow');
    expect(content).toContain('[ERROR] boom');
  });

  it('序列化对象类型的附加信息', () => {
    const filePath = path.join(tempDir, 'meta.log');
    const logger = new Logger(filePath);

    logger.info('with meta', { module: 'ConfigModule' });

    expect(fs.readFileSync(filePath, 'utf-8')).toContain('with meta {"module":"ConfigModule"}');
  });
});
