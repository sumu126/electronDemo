import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createDefaultConfig } from '@shared/config/defaults';
import type { AppConfig } from '@shared/types';
import { toPlain } from '../utils/plain';
import { reportError } from '../utils/report';

const getByPath = (source: unknown, keyPath: string): unknown =>
  keyPath.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);

const buildNestedUpdate = (keyPath: string, value: unknown): Partial<AppConfig> => {
  const keys = keyPath.split('.');
  let result: unknown = value;

  for (let index = keys.length - 1; index >= 0; index -= 1) {
    result = { [keys[index]]: result };
  }

  return result as Partial<AppConfig>;
};

/**
 * 配置的渲染进程唯一数据源：全部读写走主进程，不再使用 localStorage。
 */
export const useConfigStore = defineStore('config', () => {
  const config = ref<AppConfig>(createDefaultConfig());
  const loaded = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const ensureLoaded = async (): Promise<void> => {
    if (loaded.value || loading.value) {
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      config.value = await window.electronAPI.invoke('config:get');
      loaded.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取配置失败';
    } finally {
      loading.value = false;
    }
  };

  const updateConfig = async (updates: Partial<AppConfig>): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      // 入参通常是 ref/reactive 里的 Proxy，必须先转纯数据，否则结构化克隆直接失败
      await window.electronAPI.invoke('config:update', toPlain(updates));
      config.value = await window.electronAPI.invoke('config:get');
      loaded.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新配置失败';
      console.error('[config] update failed:', err);
      reportError('Failed to update config', err);
    } finally {
      loading.value = false;
    }
  };

  const setValue = async <T>(keyPath: string, value: T): Promise<void> => {
    await updateConfig(buildNestedUpdate(keyPath, value));
  };

  const getValue = <T>(keyPath: string): T | undefined =>
    getByPath(config.value, keyPath) as T | undefined;

  return {
    config,
    loaded,
    loading,
    error,
    ensureLoaded,
    updateConfig,
    setValue,
    getValue,
  };
});
