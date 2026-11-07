import { computed } from 'vue';
import { getMessages, normalizeLocale } from '@shared/i18n';
import { useConfigStore } from '../stores/config.store';

/**
 * 语言由配置项 language 驱动：切换后所有使用 useI18n 的组件会立即重渲染。
 * 返回的 t 是 computed，模板里可直接 `t.home.fetchSystemInfo`，脚本里需要 `.value`。
 */
export const useI18n = () => {
  const configStore = useConfigStore();

  const locale = computed(() => normalizeLocale(configStore.config.language));
  const t = computed(() => getMessages(locale.value));

  return { locale, t };
};
