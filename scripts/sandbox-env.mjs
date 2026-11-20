/**
 * 开发启动器在 spawn Electron 之前就要知道沙箱是否关闭：
 * 外置盘等环境下 Chromium 可能在主进程 JS 执行前就以 0x80000003 崩溃，
 * 此时 `app.commandLine.appendSwitch('no-sandbox')`（src/main/index.ts）根本来不及执行。
 *
 * 只读 SECURITY_SANDBOX_ENABLED 一个键；完整解析规则以 src/main/utils/env.ts 为准。
 */
import { existsSync, readFileSync } from 'fs';

export const readSandboxDisabled = (filePath) => {
  if (!existsSync(filePath)) {
    return false;
  }

  let content;

  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return false;
  }

  for (const rawLine of content.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?SECURITY_SANDBOX_ENABLED\s*=\s*(.*)$/);

    if (!match) {
      continue;
    }

    let value = match[1].trim();

    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0];
      const closingIndex = value.indexOf(quote, 1);
      value = closingIndex > 0 ? value.slice(1, closingIndex) : value.slice(1);
    } else {
      const commentIndex = value.indexOf(' #');
      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    return ['false', '0', 'no', 'off'].includes(value.toLowerCase());
  }

  return false;
};
