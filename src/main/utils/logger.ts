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
 *
 * 落盘走异步串行队列：同步 appendFileSync 会在日志量上来后阻塞事件循环。
 * 进程退出前调用 flush() 等待队列清空，保证崩溃原因不会丢在缓冲区里。
 */
export class Logger {
  private queue: Promise<void> = Promise.resolve();

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

  /** 等待队列中所有日志写入完成 */
  public flush(): Promise<void> {
    return this.queue;
  }

  private write(level: LogLevel, message: string, meta: unknown): void {
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${stringifyMeta(meta)}`;

    // 单次写失败不打断后续日志：catch 收敛掉异常，队列始终保持 resolved
    this.queue = this.queue
      .then(() => fs.promises.appendFile(this.filePath, `${line}\n`, 'utf-8'))
      .catch((error) => {
        console.error('Failed to write log file:', error);
      });

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}
