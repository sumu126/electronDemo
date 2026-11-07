<template>
  <div class="framework-info-card">
    <h3>{{ componentTitle }}</h3>
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
import { computed, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useConfigStore } from '../stores/config.store';
import type { FrameworkFeature } from '@shared/i18n';

interface Props {
  title?: string;
  description?: string;
  features?: FrameworkFeature[];
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  features: () => [],
});

const { t } = useI18n();
const configStore = useConfigStore();

// 传入的 props 优先，否则取配置与当前语言的默认文案
const componentTitle = computed(() => {
  if (props.title) {
    return props.title;
  }

  return configStore.config.appName
    ? `${configStore.config.appName} ${t.value.app.titleSuffix}`
    : t.value.app.defaultTitle;
});

const description = computed(() => props.description || t.value.framework.description);

const features = computed<readonly FrameworkFeature[]>(() =>
  props.features.length > 0 ? props.features : t.value.framework.features,
);

onMounted(async () => {
  await configStore.ensureLoaded();
});
</script>

<style scoped>
.framework-info-card {
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--shadow-card);
  margin-bottom: 20px;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 20px;
}

.feature-item {
  background: var(--color-surface-muted);
  padding: 15px;
  border-radius: 6px;
  border-left: 4px solid var(--color-primary);
}

.feature-item h4 {
  margin: 0 0 8px 0;
  color: var(--color-text);
}

.feature-item p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
}
</style>
