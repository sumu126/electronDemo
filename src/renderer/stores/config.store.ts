import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createDefaultConfig } from '@shared/config/defaults';
import type { AppConfig } from '@shared/types';

const getByPath = (source: unknown, keyPath: string): unknown =>
  keyPath.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);

/**
 * 配置的渲染进程唯一数据源。
 * .env 是唯一来源，主进程只读；这里不再提供 updateConfig / setValue。
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

  const getValue = <T>(keyPath: string): T | undefined =>
    getByPath(config.value, keyPath) as T | undefined;

  return {
    config,
    loaded,
    loading,
    error,
    ensureLoaded,
    getValue,
  };
});
