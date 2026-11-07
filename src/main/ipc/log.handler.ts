import { IpcMainInvokeEvent } from 'electron';
import { getLogger } from '../utils/app-logger';

type Level = 'info' | 'warn' | 'error';

const LEVELS: readonly Level[] = ['info', 'warn', 'error'];
const RATE_WINDOW_MS = 10_000;
const MAX_REPORTS_PER_WINDOW = 50;
const MAX_MESSAGE_LENGTH = 2000;

/**
 * 渲染进程日志上报：把 DevTools 里的异常也写进 main.log。
 *
 * 通道对渲染进程开放，因此这里必须自我约束：
 * - 只接受声明过的级别，级别非法时降级为 info
 * - 单条消息截断，避免超长字符串写爆日志
 * - 滑动窗口限流，防止异常循环刷盘
 */
export class LogReportHandler {
  private timestamps: number[] = [];
  private dropped = 0;

  async report(
    _event: IpcMainInvokeEvent,
    level: Level,
    message: string,
    meta?: string | Record<string, unknown>,
  ): Promise<void> {
    if (!this.accept()) {
      this.dropped += 1;

      // 每丢弃 50 条提示一次，免得告警本身把日志刷满
      if (this.dropped % 50 === 1) {
        getLogger().warn(`Renderer log rate limit reached, dropped ${this.dropped} entries`);
      }

      return;
    }

    const safeLevel: Level = LEVELS.includes(level) ? level : 'info';
    const safeMessage = String(message ?? '').slice(0, MAX_MESSAGE_LENGTH);

    getLogger()[safeLevel](`[renderer] ${safeMessage}`, meta);
  }

  private accept(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < RATE_WINDOW_MS);

    if (this.timestamps.length >= MAX_REPORTS_PER_WINDOW) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }
}
