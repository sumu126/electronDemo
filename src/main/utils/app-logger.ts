import { Logger } from './logger';

export interface LogSink {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

// 未初始化前（例如单实例锁判定、测试环境）回退到控制台，日志不会静默丢失
function createConsoleSink(): LogSink {
  return {
    info: (message, meta) => console.log(message, ...(meta === undefined ? [] : [meta])),
    warn: (message, meta) => console.warn(message, ...(meta === undefined ? [] : [meta])),
    error: (message, meta) => console.error(message, ...(meta === undefined ? [] : [meta])),
  };
}

let current: LogSink = createConsoleSink();

/**
 * 主进程日志入口：应用启动时调用一次，此后各模块通过 getLogger() 记录，
 * 不必把 Logger 实例层层注入，也不会漏掉模块内部的错误。
 */
export function initLogger(filePath: string): Logger {
  const instance = new Logger(filePath);
  current = instance;
  return instance;
}

export function getLogger(): LogSink {
  return current;
}
