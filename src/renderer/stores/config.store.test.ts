import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfigStore } from './config.store';

const invoke = vi.fn();

const remoteConfig = {
  appName: 'Remote',
  version: '1.0.0',
  theme: 'dark',
  language: 'zh-CN',
  window: { width: 1000, height: 700 },
  features: { developerTools: false },
  tray: { balloonNotificationEnabled: false },
  security: { sandboxEnabled: true },
};

beforeEach(() => {
  setActivePinia(createPinia());
  invoke.mockReset();
  vi.stubGlobal('window', { electronAPI: { invoke } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useConfigStore', () => {
  it('从主进程加载 .env 配置', async () => {
    invoke.mockResolvedValueOnce(remoteConfig);

    const store = useConfigStore();
    await store.ensureLoaded();

    expect(invoke).toHaveBeenCalledWith('config:get');
    expect(store.config.appName).toBe('Remote');
    expect(store.config.security.sandboxEnabled).toBe(true);
    expect(store.loaded).toBe(true);
  });

  it('已加载后不重复请求', async () => {
    invoke.mockResolvedValueOnce(remoteConfig);

    const store = useConfigStore();
    await store.ensureLoaded();
    await store.ensureLoaded();

    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('getValue 支持键路径', async () => {
    invoke.mockResolvedValueOnce(remoteConfig);

    const store = useConfigStore();
    await store.ensureLoaded();

    expect(store.getValue<number>('window.width')).toBe(1000);
    expect(store.getValue<unknown>('window.unknown')).toBeUndefined();
  });
});
