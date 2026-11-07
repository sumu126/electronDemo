<template>
  <slot v-if="!hasError" />
  <div v-else class="error-boundary" role="alert">
    <h2>{{ t.errorBoundary.title }}</h2>
    <p class="message">{{ message || t.errorBoundary.description }}</p>
    <button class="reload" type="button" @click="reload">{{ t.errorBoundary.reload }}</button>
  </div>
</template>

<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import { reportError } from '../utils/report';

const { t } = useI18n();

const hasError = ref(false);
const message = ref('');

// 捕获子组件渲染/生命周期里的异常，避免整页白屏
onErrorCaptured((error) => {
  hasError.value = true;
  message.value = error instanceof Error ? error.message : String(error);
  console.error('[renderer] Captured by AppErrorBoundary:', error);
  reportError('Captured by AppErrorBoundary', error);
  return false;
});

const reload = () => {
  window.location.reload();
};
</script>

<style scoped>
.error-boundary {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  background: var(--color-bg);
  color: var(--color-text);
}

h2 {
  margin: 0;
  font-size: 22px;
}

.message {
  margin: 0;
  max-width: 640px;
  color: var(--color-text-muted);
  word-break: break-word;
}

.reload {
  margin-top: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #fff;
  background-color: var(--color-primary);
}

.reload:hover {
  background-color: var(--color-primary-hover);
}
</style>
