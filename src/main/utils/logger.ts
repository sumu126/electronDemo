import fs from 'fs';
import { dirname } from 'path';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LoggerOptions {
  /** 单文件大小上限，超过后轮转 */
  maxSizeBytes?: number;
  /** 保留的轮转文件份数（main.log.1 … main.log.N） */
  maxFiles?: number;
}

const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_FILES = 3;

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
  private readonly maxSizeBytes: number;
  private readonly maxFiles: number;
  private bytesWritten: number;

  constructor(
    private readonly filePath: string,
    options: LoggerOptions = {},
  ) {
    fs.mkdirSync(dirname(filePath), { recursive: true });
    this.maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
    this.maxFiles = Math.max(1, options.maxFiles ?? DEFAULT_MAX_FILES);
    this.bytesWritten = this.currentSize();
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
    const payload = `${line}\n`;
    const bytes = Buffer.byteLength(payload);

    // 单次写失败不打断后续日志：catch 收敛掉异常，队列始终保持 resolved
    this.queue = this.queue
      .then(async () => {
        // 轮转判断放在队列里做：并发写入按顺序看到同一个 bytesWritten，不会连环触发
        if (this.bytesWritten > 0 && this.bytesWritten + bytes > this.maxSizeBytes) {
          try {
            await this.rotate();
            this.bytesWritten = 0;
          } catch (error) {
            // 轮转失败不应吞掉这条日志，继续追加
            console.error('Failed to rotate log file:', error);
          }
        }

        await fs.promises.appendFile(this.filePath, payload, 'utf-8');
        this.bytesWritten += bytes;
      })
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

  private currentSize(): number {
    try {
      return fs.statSync(this.filePath).size;
    } catch {
      return 0;
    }
  }

  /** 按大小轮转：main.log → main.log.1 → … → main.log.N，最旧的丢弃 */
  private async rotate(): Promise<void> {
    await fs.promises.rm(`${this.filePath}.${this.maxFiles}`, { force: true });

    for (let index = this.maxFiles - 1; index >= 1; index -= 1) {
      await this.renameIfExists(`${this.filePath}.${index}`, `${this.filePath}.${index + 1}`);
    }

    await this.renameIfExists(this.filePath, `${this.filePath}.1`);
  }

  private async renameIfExists(from: string, to: string): Promise<void> {
    try {
      await fs.promises.rename(from, to);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
