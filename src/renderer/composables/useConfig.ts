import { computed, onMounted } from 'vue';
import { useConfigStore } from '../stores/config.store';
import type { AppConfig } from '@shared/types';

/**
 * 配置读取/更新的组合式入口。
 * 数据源统一为 ConfigStore，ConfigStore 再走主进程，不再读写 localStorage。
 */
export const useConfig = () => {
  const store = useConfigStore();

  onMounted(() => {
    void store.ensureLoaded();
  });

  return {
    config: computed<AppConfig>(() => store.config),
    loading: computed(() => store.loading),
    error: computed(() => store.error),
    updateConfig: (updates: Partial<AppConfig>) => store.updateConfig(updates),
    setValue: <T>(keyPath: string, value: T) => store.setValue(keyPath, value),
    getValue: <T>(keyPath: string): T | undefined => store.getValue<T>(keyPath),
  };
};
