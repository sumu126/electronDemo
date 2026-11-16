import { describe, expect, it } from 'vitest';
import { buildConfigFromEnv } from './from-env';
import { createDefaultConfig } from './defaults';

const base = { appName: 'fallback-app', version: '1.0.0' };

describe('buildConfigFromEnv', () => {
  it('把 .env 完整映射到 AppConfig', () => {
    const { config, warnings } = buildConfigFromEnv(
      {
        APP_NAME: 'Demo',
        THEME: 'dark',
        LANGUAGE: 'en-US',
        WINDOW_WIDTH: '1000',
        WINDOW_HEIGHT: '700',
        WINDOW_X: '10',
        WINDOW_Y: '20',
        WINDOW_MAXIMIZED: 'true',
        FEATURE_DEVELOPER_TOOLS: 'true',
        TRAY_BALLOON_NOTIFICATION_ENABLED: 'true',
        SECURITY_SANDBOX_ENABLED: 'false',
      },
      base,
    );

    expect(warnings).toEqual([]);
    expect(config).toEqual({
      appName: 'Demo',
      version: '1.0.0',
      theme: 'dark',
      language: 'en-US',
      window: { width: 1000, height: 700, x: 10, y: 20, maximized: true },
      features: { developerTools: true },
      tray: { balloonNotificationEnabled: true },
      security: { sandboxEnabled: false },
    });
  });

  it('空配置回退到默认值', () => {
    const defaults = createDefaultConfig(base);
    const { config, warnings } = buildConfigFromEnv({}, base);

    expect(warnings).toEqual([]);
    expect(config).toMatchObject(defaults);
    expect(config.window).toEqual({
      width: defaults.window.width,
      height: defaults.window.height,
      x: undefined,
      y: undefined,
      maximized: false,
    });
  });

  it('空白值视为未配置', () => {
    const defaults = createDefaultConfig(base);
    const { config } = buildConfigFromEnv(
      { THEME: '  ', WINDOW_WIDTH: ' ', SECURITY_SANDBOX_ENABLED: '' },
      base,
    );

    expect(config.theme).toBe(defaults.theme);
    expect(config.window.width).toBe(defaults.window.width);
    expect(config.security.sandboxEnabled).toBe(true);
  });

  it('非法枚举/数字/布尔都回退并给出 warning', () => {
    const defaults = createDefaultConfig(base);
    const { config, warnings } = buildConfigFromEnv(
      {
        THEME: 'blue',
        LANGUAGE: 'fr-FR',
        WINDOW_WIDTH: 'abc',
        WINDOW_X: 'left',
        WINDOW_MAXIMIZED: 'maybe',
        FEATURE_DEVELOPER_TOOLS: 'sure',
        SECURITY_SANDBOX_ENABLED: 'nope',
      },
      base,
    );

    expect(config.theme).toBe(defaults.theme);
    expect(config.language).toBe(defaults.language);
    expect(config.window.width).toBe(defaults.window.width);
    expect(config.window.x).toBeUndefined();
    expect(config.window.maximized).toBe(false);
    expect(config.features.developerTools).toBe(false);
    expect(config.security.sandboxEnabled).toBe(true);
    expect(warnings).toHaveLength(7);
    expect(warnings.join('\n')).toContain('THEME');
    expect(warnings.join('\n')).toContain('WINDOW_X');
  });

  it('布尔支持 1/0、yes/no、on/off', () => {
    const { config } = buildConfigFromEnv(
      {
        FEATURE_DEVELOPER_TOOLS: 'YES',
        TRAY_BALLOON_NOTIFICATION_ENABLED: 'on',
        SECURITY_SANDBOX_ENABLED: '0',
        WINDOW_MAXIMIZED: 'no',
      },
      base,
    );

    expect(config.features.developerTools).toBe(true);
    expect(config.tray.balloonNotificationEnabled).toBe(true);
    expect(config.security.sandboxEnabled).toBe(false);
    expect(config.window.maximized).toBe(false);
  });
});
