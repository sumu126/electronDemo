import { computed, onMounted } from 'vue';
import { useConfigStore } from '../stores/config.store';
import type { AppConfig } from '@shared/types';

/**
 * 配置读取入口。配置来自项目 .env，主进程只读；
 * 修改配置请编辑 .env 后重启，不在渲染进程提供写入。
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
    getValue: <T>(keyPath: string): T | undefined => store.getValue<T>(keyPath),
  };
};
