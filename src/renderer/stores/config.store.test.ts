import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isProxy, reactive } from 'vue';
import type { AppConfig } from '@shared/types';
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
      features: { developerTools: false },
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
      features: { developerTools: false },
      tray: { hasShownFirstTimeNotice: false },
    });

    const store = useConfigStore();
    await store.updateConfig({ theme: 'light' });

    expect(invoke).toHaveBeenCalledWith('config:update', { theme: 'light' });
    expect(invoke).toHaveBeenCalledWith('config:get');
    expect(store.config.theme).toBe('light');
  });

  it('响应式入参在发 IPC 前被转成纯数据（Proxy 无法结构化克隆）', async () => {
    invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      appName: 'Plain',
      version: '1.0.0',
      theme: 'dark',
      language: 'zh-CN',
      window: { width: 1000, height: 700 },
      features: { developerTools: false },
      tray: { hasShownFirstTimeNotice: false, balloonNotificationEnabled: false },
    });

    const store = useConfigStore();
    // 组件里传进来的就是 ref/reactive 的 Proxy（localConfig.value）
    const updates = reactive({ theme: 'dark', window: { width: 1000 } });

    await store.updateConfig(updates as Partial<AppConfig>);

    const payload = invoke.mock.calls[0][1] as Record<string, unknown>;

    expect(isProxy(payload)).toBe(false);
    expect(isProxy(payload.window)).toBe(false);
    // Electron IPC 用结构化克隆，Proxy 会抛 "An object could not be cloned."
    expect(() => structuredClone(payload)).not.toThrow();
    expect(payload).toEqual({ theme: 'dark', window: { width: 1000 } });
  });
});
