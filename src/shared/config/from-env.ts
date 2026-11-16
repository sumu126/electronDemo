import { createDefaultConfig } from './defaults';
import { SUPPORTED_LOCALES } from '../i18n';
import type { AppConfig } from '../types';

type Env = Record<string, string | undefined>;

export interface EnvConfigResult {
  config: AppConfig;
  warnings: string[];
}

const readString = (env: Env, key: string, fallback: string): string => {
  const value = env[key]?.trim();
  return value ? value : fallback;
};

const readEnum = <T extends string>(
  env: Env,
  key: string,
  allowed: readonly T[],
  fallback: T,
  warnings: string[],
): T => {
  const value = env[key]?.trim();

  if (!value) {
    return fallback;
  }

  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }

  warnings.push(
    `${key} 必须是 ${allowed.join(' / ')} 之一，收到 "${value}"，已使用默认值 ${fallback}`,
  );
  return fallback;
};

const readBoolean = (env: Env, key: string, fallback: boolean, warnings: string[]): boolean => {
  const value = env[key]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (['true', '1', 'yes', 'on'].includes(value)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(value)) {
    return false;
  }

  warnings.push(`${key} 必须是布尔值（true / false），收到 "${value}"，已使用默认值 ${fallback}`);
  return fallback;
};

const readNumber = (env: Env, key: string, fallback: number, warnings: string[]): number => {
  const value = env[key]?.trim();

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    warnings.push(`${key} 必须是数字，收到 "${value}"，已使用默认值 ${fallback}`);
    return fallback;
  }

  return parsed;
};

const readOptionalNumber = (env: Env, key: string, warnings: string[]): number | undefined => {
  const value = env[key]?.trim();

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    warnings.push(`${key} 必须是数字，收到 "${value}"，已忽略`);
    return undefined;
  }

  return parsed;
};

/**
 * 把 .env 映射为 AppConfig。
 * 非法值不会让应用启动失败：记录 warning 并回退到默认值。
 */
export function buildConfigFromEnv(
  env: Env,
  base: { appName: string; version: string },
): EnvConfigResult {
  const warnings: string[] = [];
  const defaults = createDefaultConfig({ appName: base.appName, version: base.version });
  const config: AppConfig = {
    ...defaults,
    appName: readString(env, 'APP_NAME', defaults.appName),
    theme: readEnum(env, 'THEME', ['light', 'dark', 'auto'] as const, defaults.theme, warnings),
    language: readEnum(env, 'LANGUAGE', SUPPORTED_LOCALES, defaults.language, warnings),
    window: {
      width: readNumber(env, 'WINDOW_WIDTH', defaults.window.width, warnings),
      height: readNumber(env, 'WINDOW_HEIGHT', defaults.window.height, warnings),
      x: readOptionalNumber(env, 'WINDOW_X', warnings),
      y: readOptionalNumber(env, 'WINDOW_Y', warnings),
      maximized: readBoolean(env, 'WINDOW_MAXIMIZED', Boolean(defaults.window.maximized), warnings),
    },
    features: {
      developerTools: readBoolean(
        env,
        'FEATURE_DEVELOPER_TOOLS',
        defaults.features.developerTools,
        warnings,
      ),
    },
    tray: {
      balloonNotificationEnabled: readBoolean(
        env,
        'TRAY_BALLOON_NOTIFICATION_ENABLED',
        defaults.tray.balloonNotificationEnabled,
        warnings,
      ),
    },
    security: {
      sandboxEnabled: readBoolean(
        env,
        'SECURITY_SANDBOX_ENABLED',
        defaults.security.sandboxEnabled,
        warnings,
      ),
    },
  };

  return { config, warnings };
}
