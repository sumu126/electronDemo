import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfigStore } from './config.store';

const invoke = vi.fn();

beforeEach(() => {
  setActivePinia(createPinia());
  invoke.mockReset();
  vi.stubGlobal('window', { electronAPI: { invoke } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useConfigStore', () => {
  it('从主进程加载配置', async () => {
    const remoteConfig = {
      appName: 'Remote',
      version: '1.0.0',
      theme: 'dark',
      language: 'zh-CN',
      window: { width: 1000, height: 700 },
      features: { developerTools: false, analytics: true, autoUpdate: true },
      tray: { hasShownFirstTimeNotice: false },
    };
    invoke.mockResolvedValueOnce(remoteConfig);

    const store = useConfigStore();
    await store.ensureLoaded();

    expect(invoke).toHaveBeenCalledWith('config:get');
    expect(store.config.appName).toBe('Remote');
    expect(store.loaded).toBe(true);
  });

  it('更新配置后从主进程回读，不写 localStorage', async () => {
    invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      appName: 'Updated',
      version: '1.0.0',
      theme: 'light',
      language: 'zh-CN',
      window: { width: 1000, height: 700 },
      features: { developerTools: false, analytics: true, autoUpdate: true },
      tray: { hasShownFirstTimeNotice: false },
    });

    const store = useConfigStore();
    await store.updateConfig({ theme: 'light' });

    expect(invoke).toHaveBeenCalledWith('config:update', { theme: 'light' });
    expect(invoke).toHaveBeenCalledWith('config:get');
    expect(store.config.theme).toBe('light');
  });
});
