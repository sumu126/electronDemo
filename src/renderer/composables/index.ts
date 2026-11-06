import { ref } from 'vue';

/**
 * 使用系统信息
 */
export const useSystemInfo = () => {
  const systemInfo = ref<any>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchSystemInfo = async () => {
    try {
      loading.value = true;
      error.value = null;
      systemInfo.value = await window.electronAPI.invoke('system:info');
    } catch (err: any) {
      error.value = err.message || '获取系统信息失败';
      console.error('获取系统信息失败:', err);
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
