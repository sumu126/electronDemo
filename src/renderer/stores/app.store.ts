import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  const isDeveloperMode = ref<boolean>(false);

  const toggleDeveloperMode = () => {
    isDeveloperMode.value = !isDeveloperMode.value;
  };

  return {
    isDeveloperMode,
    toggleDeveloperMode,
  };
});
