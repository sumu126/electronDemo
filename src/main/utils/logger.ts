import fs from 'fs';
import { dirname } from 'path';

export type LogLevel = 'info' | 'warn' | 'error';

const stringifyMeta = (meta: unknown): string => {
  if (meta === undefined) {
    return '';
  }
  if (typeof meta === 'string') {
    return ` ${meta}`;
  }
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ` ${String(meta)}`;
  }
};

/**
 * 主进程文件日志：同时写入 userData/logs 与标准输出。
 */
export class Logger {
  constructor(private readonly filePath: string) {
    fs.mkdirSync(dirname(filePath), { recursive: true });
  }

  public info(message: string, meta?: unknown): void {
    this.write('info', message, meta);
  }

  public warn(message: string, meta?: unknown): void {
    this.write('warn', message, meta);
  }

  public error(message: string, meta?: unknown): void {
    this.write('error', message, meta);
  }

  private write(level: LogLevel, message: string, meta: unknown): void {
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${stringifyMeta(meta)}`;

    try {
      fs.appendFileSync(this.filePath, `${line}\n`, 'utf-8');
    } catch (error) {
      console.error('Failed to write log file:', error);
    }

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}
