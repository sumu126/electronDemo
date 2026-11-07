import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogReportHandler } from './log.handler';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('../utils/app-logger', () => ({ getLogger: () => log }));

// 事件对象在 handler 里没被用到，给个空壳即可
const event = {} as never;

beforeEach(() => {
  log.info.mockReset();
  log.warn.mockReset();
  log.error.mockReset();
});

describe('LogReportHandler', () => {
  it('把上报写入主进程日志，并加上来源前缀', async () => {
    const handler = new LogReportHandler();

    await handler.report(event, 'error', 'boom', { module: 'HomeView' });

    expect(log.error).toHaveBeenCalledWith('[renderer] boom', { module: 'HomeView' });
  });

  it('非法级别降级为 info，避免写入不存在的日志方法', async () => {
    const handler = new LogReportHandler();

    await handler.report(event, 'debug' as never, 'weird');

    expect(log.info).toHaveBeenCalledWith('[renderer] weird', undefined);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('截断超长消息，避免渲染端把日志写爆', async () => {
    const handler = new LogReportHandler();

    await handler.report(event, 'info', 'x'.repeat(5000));

    const [message] = log.info.mock.calls[0];
    expect(message.length).toBeLessThanOrEqual(2000 + '[renderer] '.length);
  });

  it('滑动窗口限流：超出配额的上报被丢弃并告警一次', async () => {
    const handler = new LogReportHandler();

    for (let index = 0; index < 60; index += 1) {
      await handler.report(event, 'info', `line-${index}`);
    }

    expect(log.info).toHaveBeenCalledTimes(50);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).toContain('rate limit');
  });
});
