import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';

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

window.addEventListener('unhandledrejection', event => {
  console.error('[renderer] Unhandled promise rejection:', event.reason);
});

// 挂载应用
app.mount('#app');