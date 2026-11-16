import { readFileSync } from 'fs';
import { join } from 'path';

interface RawConfig {
  security?: {
    sandboxEnabled?: unknown;
  };
}

/**
 * 在 app ready 之前读取沙箱开关。
 *
 * 沙箱必须在 Chromium 初始化前决定，不能等 ConfigModule 异步加载；
 * 因此这里直接同步读 userData/config.json。
 * 只有显式写入 false 才关闭；文件缺失、JSON 损坏、字段类型不对时一律保持开启。
 */
export function readSandboxEnabled(userDataDir: string): boolean {
  try {
    const raw = readFileSync(join(userDataDir, 'config.json'), 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) {
      return true;
    }

    const security = (parsed as RawConfig).security;

    if (typeof security !== 'object' || security === null) {
      return true;
    }

    return security.sandboxEnabled !== false;
  } catch {
    return true;
  }
}
