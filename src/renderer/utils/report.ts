type Level = 'info' | 'warn' | 'error';

const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { value: String(error) };
};

/**
 * 把渲染进程的日志送进主进程 main.log。
 * 纯浏览器环境（只跑 vite dev）没有 electronAPI，静默降级；
 * 上报本身失败也必须吞掉，不能因为日志把业务带走。
 */
const send = (level: Level, message: string, meta?: string | Record<string, unknown>): void => {
  try {
    void window.electronAPI?.invoke('log:report', level, message, meta).catch(() => undefined);
  } catch {
    // 忽略
  }
};

export const reportInfo = (message: string, meta?: Record<string, unknown>): void => {
  send('info', message, meta);
};

export const reportWarning = (message: string, meta?: Record<string, unknown>): void => {
  send('warn', message, meta);
};

export const reportError = (
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>,
): void => {
  send('error', message, error === undefined ? meta : { ...meta, error: serializeError(error) });
};
