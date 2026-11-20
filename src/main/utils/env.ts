import { existsSync, readFileSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';

export type ProjectEnv = Record<string, string>;

/**
 * 解析 .env：支持空行、# 注释、export 前缀、单/双引号。
 * 只做项目配置需要的简单语法，不引入 dotenv 依赖。
 */
export function parseEnvContent(content: string): ProjectEnv {
  const env: ProjectEnv = {};

  for (const rawLine of content.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (value.startsWith('"') || value.startsWith("'")) {
      // 引号值允许后面跟行内注释：THEME="dark" # 深色
      const quote = value[0];
      const closingIndex = value.indexOf(quote, 1);
      value = closingIndex > 0 ? value.slice(1, closingIndex) : value.slice(1);
    } else {
      const commentIndex = value.indexOf(' #');
      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    env[key] = value;
  }

  return env;
}

/** 项目根目录 / 打包 resources 下的 .env；可用 ELECTRON_ENV_FILE 覆盖 */
export function resolveEnvPath(): string {
  const override = process.env.ELECTRON_ENV_FILE;

  if (override) {
    return isAbsolute(override) ? override : resolve(override);
  }

  if (process.defaultApp) {
    return join(process.cwd(), '.env');
  }

  if (process.resourcesPath) {
    return join(process.resourcesPath, '.env');
  }

  return join(process.cwd(), '.env');
}

export function loadProjectEnv(): ProjectEnv {
  const envPath = resolveEnvPath();

  if (!existsSync(envPath)) {
    return {};
  }

  try {
    return parseEnvContent(readFileSync(envPath, 'utf-8'));
  } catch {
    return {};
  }
}

/** 只有显式 false / 0 / no / off 才关闭沙箱；缺省、空值、异常值都保持开启 */
export function readSandboxEnabled(env: ProjectEnv = loadProjectEnv()): boolean {
  const value = env.SECURITY_SANDBOX_ENABLED?.trim().toLowerCase();

  return !(value && ['false', '0', 'no', 'off'].includes(value));
}
