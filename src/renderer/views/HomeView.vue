<template>
  <div class="app-container">
    <header class="app-header">
      <h1>{{ title }}</h1>
      <div class="header-actions">
        <button class="btn btn-secondary" :disabled="systemInfoLoading" @click="fetchSystemInfo">
          {{ systemInfoLoading ? t.home.loading : t.home.fetchSystemInfo }}
        </button>
        <button class="btn btn-primary" @click="debugPanelOpen = !debugPanelOpen">
          {{ debugPanelOpen ? t.home.hideDebugTools : t.home.debugTools }}
        </button>
        <button class="btn btn-success" @click="showConfigPanel = true">{{ t.home.config }}</button>
      </div>
    </header>

    <main class="app-main">
      <FrameworkInfo />

      <section v-if="systemInfo" class="info-section">
        <h2>{{ t.home.systemInfo }}</h2>
        <pre>{{ JSON.stringify(systemInfo, null, 2) }}</pre>
      </section>

      <section v-if="debugPanelOpen" class="info-section">
        <h2>{{ t.home.debugTools }}</h2>
        <p>{{ t.home.debugHint }}</p>
        <button class="btn btn-info" @click="pingBackend">{{ t.home.testBackend }}</button>
        <p v-if="pingResult">{{ t.home.pingResult }}: {{ pingResult }}</p>
      </section>
    </main>

    <!-- 配置面板 -->
    <Modal v-model:visible="showConfigPanel" :title="t.config.title" :centered="true" width="600px">
      <ConfigPanel />
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSystemInfo } from '../composables';
import { useI18n } from '../composables/useI18n';
import { useConfigStore } from '../stores/config.store';
import FrameworkInfo from '../components/FrameworkInfo.vue';
import Modal from '../components/Modal.vue';
import ConfigPanel from '../components/ConfigPanel.vue';

const { t } = useI18n();
const { systemInfo, loading: systemInfoLoading, fetchSystemInfo } = useSystemInfo();
const configStore = useConfigStore();

// 调试面板只是首页的演示状态，不需要进全局 store（持久化的开关是 features.developerTools）
const debugPanelOpen = ref(false);
const showConfigPanel = ref(false);
const pingResult = ref<string | null>(null);

const title = computed(() =>
  configStore.config.appName
    ? `${configStore.config.appName} ${t.value.app.titleSuffix}`
    : t.value.app.defaultTitle,
);

const pingBackend = async () => {
  try {
    pingResult.value = await window.electronAPI.invoke('ping');
  } catch (error) {
    console.error('Ping failed:', error);
  }
};

// 配置决定标题与文案，挂载时确保已从主进程加载
onMounted(async () => {
  await configStore.ensureLoaded();
});
</script>

<style>
.app-container {
  font-family: Arial, sans-serif;
  padding: 20px;
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--color-border);
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary {
  background-color: var(--color-secondary);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-secondary-hover);
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.btn-success {
  background-color: var(--color-success);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: var(--color-success-hover);
}

.btn-info {
  background-color: var(--color-info);
  color: white;
}

.btn-info:hover:not(:disabled) {
  background-color: var(--color-info-hover);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-section {
  background: var(--color-surface);
  padding: 20px;
  border-radius: 8px;
  box-shadow: var(--shadow-card);
}

.info-section h2 {
  margin-top: 0;
  color: var(--color-text);
}

pre {
  background: var(--color-surface-muted);
  color: var(--color-text);
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
