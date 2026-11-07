import { createApp, watch } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useConfigStore } from './stores/config.store';
import { applyTheme, watchSystemTheme } from './theme';
import { reportError } from './utils/report';
import './styles/theme.css';

// 创建应用实例
const app = createApp(App);

// 使用Pinia状态管理
app.use(createPinia());

// 使用路由
app.use(router);

// 全局异常兜底：控制台留一份，同时上报到主进程日志（限流由主进程负责）
app.config.errorHandler = (error, _instance, info) => {
  console.error('[renderer] Unhandled component error:', info, error);
  reportError('Unhandled component error', error, { info });
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer] Unhandled promise rejection:', event.reason);
  reportError('Unhandled promise rejection', event.reason);
});

// 配置驱动的外观与标题：theme 决定 <html data-theme>，appName 决定窗口标题
const configStore = useConfigStore();

watch(
  () => configStore.config.theme,
  (theme) => applyTheme(theme),
  { immediate: true },
);
watchSystemTheme(() => configStore.config.theme);

void configStore.ensureLoaded().finally(() => {
  if (configStore.config.appName) {
    document.title = configStore.config.appName;
  }
});

// 挂载应用
app.mount('#app');
