import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from './defaults';

describe('createDefaultConfig', () => {
  it('返回完整的默认配置', () => {
    const config = createDefaultConfig();

    expect(config.window.width).toBe(1200);
    expect(config.features.developerTools).toBe(false);
    expect(config.tray.hasShownFirstTimeNotice).toBe(false);
    expect(config.tray.balloonNotificationEnabled).toBe(false);
  });

  it('深合并覆盖项且不丢失同级字段', () => {
    const config = createDefaultConfig({
      appName: 'Demo',
      window: { width: 800, height: 600 },
    });

    expect(config.appName).toBe('Demo');
    expect(config.window).toEqual({ width: 800, height: 600 });
    expect(config.features).toEqual({ developerTools: false });
  });
});
