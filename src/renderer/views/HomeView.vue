<template>
  <div class="app-container">
    <header class="app-header">
      <h1>{{ title }}</h1>
      <div class="header-actions">
        <button @click="fetchSystemInfo" class="btn btn-secondary" :disabled="systemInfoLoading">
          {{ systemInfoLoading ? '加载中...' : '获取系统信息' }}
        </button>
        <button @click="toggleDevMode" class="btn btn-primary">
          {{ isDeveloperMode ? '退出开发者模式' : '开发者模式' }}
        </button>
        <button @click="showConfigPanel = true" class="btn btn-success">配置</button>
      </div>
    </header>

    <main class="app-main">
      <FrameworkInfo />

      <div class="info-section" v-if="systemInfo">
        <h2>系统信息</h2>
        <pre>{{ JSON.stringify(systemInfo, null, 2) }}</pre>
      </div>

      <div class="info-section" v-if="isDeveloperMode">
        <h2>开发者工具</h2>
        <p>当前应用运行在开发者模式下</p>
        <button @click="pingBackend" class="btn btn-info">测试后端通信</button>
        <p v-if="pingResult">{{ pingResult }}</p>
      </div>
    </main>

    <!-- 配置面板 -->
    <Modal v-model:visible="showConfigPanel" title="应用配置" :centered="true" width="600px">
      <ConfigPanel />
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useSystemInfo } from '../composables';
import { useAppStore } from '../stores/app.store';
import { useConfigStore } from '../stores/config.store';
import FrameworkInfo from '../components/FrameworkInfo.vue';
import Modal from '../components/Modal.vue';
import ConfigPanel from '../components/ConfigPanel.vue';

const title = ref('Electron + Vue3 应用框架'); // 默认标题

// 使用composables
const { systemInfo, loading: systemInfoLoading, fetchSystemInfo } = useSystemInfo();

// 使用store
const appStore = useAppStore();
const configStore = useConfigStore();
const isDeveloperMode = computed(() => appStore.isDeveloperMode);

const toggleDevMode = () => {
  appStore.toggleDeveloperMode();
};

const pingBackend = async () => {
  try {
    pingResult.value = await window.electronAPI.invoke('ping');
    console.log('Ping result:', pingResult.value);
  } catch (error) {
    console.error('Ping failed:', error);
  }
};

// 配置面板显示控制
const showConfigPanel = ref(false);

// 保存 ping 结果并在开发者工具区域展示
const pingResult = ref<string | null>(null);

// 在组件挂载时获取应用配置
onMounted(async () => {
  await configStore.ensureLoaded();
  if (configStore.config.appName) {
    title.value = configStore.config.appName;
  }
});
</script>

<style>
.app-container {
  font-family: Arial, sans-serif;
  padding: 20px;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 1px solid #ddd;
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
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #218838;
}

.btn-info {
  background-color: #17a2b8;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background-color: #117a8b;
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
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.info-section h2 {
  margin-top: 0;
  color: #333;
}

pre {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
