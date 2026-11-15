import { ref } from 'vue';
import type { SystemInfo } from '@shared/types';
import { reportError } from '../utils/report';

/**
 * 使用系统信息
 */
export const useSystemInfo = () => {
  const systemInfo = ref<SystemInfo | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchSystemInfo = async () => {
    try {
      loading.value = true;
      error.value = null;
      systemInfo.value = await window.electronAPI.invoke('system:info');
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '获取系统信息失败';
      console.error('获取系统信息失败:', err);
      reportError('Failed to fetch system info', err);
    } finally {
      loading.value = false;
    }
  };

  return {
    systemInfo,
    loading,
    error,
    fetchSystemInfo,
  };
};
