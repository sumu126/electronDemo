import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useConfigStore } from './stores/config.store';

// 创建应用实例
const app = createApp(App);

// 使用Pinia状态管理
app.use(createPinia());

// 使用路由
app.use(router);

// 全局异常兜底：先记录，后续可通过 IPC 上报到主进程日志
app.config.errorHandler = (error, _instance, info) => {
  console.error('[renderer] Unhandled component error:', info, error);
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer] Unhandled promise rejection:', event.reason);
});

// 窗口标题以配置中的 appName 为准（构建脚本不再改写 index.html）
const configStore = useConfigStore();
void configStore.ensureLoaded().finally(() => {
  if (configStore.config.appName) {
    document.title = configStore.config.appName;
  }
});

// 挂载应用
app.mount('#app');
