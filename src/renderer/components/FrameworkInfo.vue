<template>
  <div class="framework-info-card">
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <div class="features">
      <div v-for="feature in features" :key="feature.title" class="feature-item">
        <h4>{{ feature.title }}</h4>
        <p>{{ feature.description }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

interface Feature {
  title: string;
  description: string;
}

interface Props {
  title?: string;
  description?: string;
  features?: Feature[];
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Electron + Vue3 框架',
  description: '一个现代化的桌面应用程序框架',
  features: () => [
    { title: '模块化架构', description: '清晰的分层架构，便于维护和扩展' },
    { title: 'TypeScript 支持', description: '完整的类型安全，提升开发体验' },
    { title: '状态管理', description: '使用 Pinia 进行高效的状态管理' },
    { title: '跨进程通信', description: '安全高效的主进程与渲染进程通信' }
  ]
});
</script>

<style scoped>
.framework-info-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 20px;
}

.feature-item {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.feature-item h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.feature-item p {
  margin: 0;
  color: #666;
  font-size: 14px;
}
</style>